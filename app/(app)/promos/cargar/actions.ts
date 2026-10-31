"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { todayInFamilyTimezone } from "@/lib/dates";
import { DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { buildStoragePath } from "@/lib/documents/storage";
import { promoNormalizadaSchema } from "@/lib/promos/esquema";
import { filtrarPromo, type PromoFiltrada } from "@/lib/promos/filtrado";
import { importarLoteGnb, loteGnbSchema } from "@/lib/promos/importar-gnb";
import type { ResumenIngesta } from "@/lib/promos/ingesta";
import { normalizarPromo, type ArchivoPromo } from "@/lib/promos/normalizar";
import { buscarReemplazos, guardarPromoManual, type PromoExistente } from "@/lib/promos/persistencia";
import { existenteEsMasNueva } from "@/lib/promos/versiones";

/**
 * Carga manual de promos (Fase 4): PDF o captura de Sudameris y BASA, que
 * no se pueden leer automáticamente, y el JSON de GNB bajado a mano.
 *
 * El archivo lo sube el navegador directo a Storage con la sesión de la
 * persona (mismo bucket y políticas que el Centro de Documentos, ruta
 * `{family_id}/promos/…`); el servidor lo lee con el cliente de sesión y
 * se lo pasa a Claude. Las promos se escriben con el admin client porque
 * son globales (migración 014). Nada de lo que vuelve del navegador se da
 * por bueno: al guardar se valida y se filtra de nuevo.
 */

const BANCOS_MANUALES = ["sudameris", "basa"] as const;
const bancoManualSchema = z.enum(BANCOS_MANUALES);
const MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

type Contexto = NonNullable<Awaited<ReturnType<typeof getCurrentFamilyContext>>>;

function prefijoPromos(context: Contexto): string {
  return `${context.family.id}/promos/`;
}

export async function prepararSubidaPromo(nombreArchivo: string): Promise<{ path?: string; error?: string }> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  return { path: buildStoragePath(context.family.id, "promos", nombreArchivo) };
}

export type Reemplazo = PromoExistente & { esMasNueva: boolean };
export type PromoLeida = { promo: PromoFiltrada; reemplazos: Reemplazo[] };
export type LecturaResult =
  | { error: string }
  | { promos: PromoLeida[]; descartadas: Array<{ titulo: string; motivo: string }> };

export async function leerPromoManual(input: {
  banco: string;
  path: string;
  mediaType: string;
}): Promise<LecturaResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };

  const banco = bancoManualSchema.safeParse(input.banco);
  if (!banco.success) return { error: "Elegí Sudameris o BASA." };
  const mediaType = z.enum(MEDIA_TYPES).safeParse(input.mediaType);
  if (!mediaType.success) return { error: "Subí un PDF o una foto en JPG, PNG o WebP." };
  if (!input.path.startsWith(prefijoPromos(context))) return { error: "Archivo inválido." };

  const supabase = await createClient();
  const { data: blob, error: descargaError } = await supabase.storage.from(DOCUMENTS_BUCKET).download(input.path);
  if (descargaError || !blob) return { error: "No se pudo leer el archivo subido." };

  const archivo: ArchivoPromo = {
    mediaType: mediaType.data,
    base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
  };

  let normalizadas;
  try {
    normalizadas = await normalizarPromo({ banco: banco.data, origen: "manual", hoy: todayInFamilyTimezone(), archivo });
  } catch (error) {
    console.error("[leerPromoManual]", error);
    return { error: "No se pudo leer la promo del archivo. Probá de nuevo o con una foto más nítida." };
  }

  const db = createAdminClient();
  const promos: PromoLeida[] = [];
  const descartadas: Array<{ titulo: string; motivo: string }> = [];
  for (const normalizada of normalizadas) {
    const filtrado = filtrarPromo(normalizada);
    if (!filtrado.ok) {
      descartadas.push({ titulo: normalizada.titulo, motivo: filtrado.motivo });
      continue;
    }
    const promo = filtrado.promos[0];
    const existentes = await buscarReemplazos(db, banco.data, promo);
    promos.push({
      promo,
      reemplazos: existentes.map((e) => ({ ...e, esMasNueva: existenteEsMasNueva(e, promo) })),
    });
  }
  return { promos, descartadas };
}

const guardarSchema = z.object({
  banco: bancoManualSchema,
  path: z.string(),
  items: z
    .array(z.object({ promo: promoNormalizadaSchema, reemplaza: z.array(z.string().uuid()) }))
    .min(1, "No hay promos para guardar."),
});

export async function guardarPromosManuales(input: unknown): Promise<{ error?: string; guardadas?: number }> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };

  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { banco, path, items } = parsed.data;
  if (!path.startsWith(prefijoPromos(context))) return { error: "Archivo inválido." };

  // Lo editado en la vista previa pasa por el mismo filtro que la ingesta.
  const filtradas: Array<{ promo: PromoFiltrada; reemplaza: string[] }> = [];
  for (const item of items) {
    const filtrado = filtrarPromo(item.promo);
    if (!filtrado.ok) return { error: `"${item.promo.titulo}": ${filtrado.motivo}.` };
    filtradas.push({ promo: filtrado.promos[0], reemplaza: item.reemplaza });
  }

  const db = createAdminClient();
  try {
    for (const item of filtradas) {
      await guardarPromoManual(db, { banco, archivoPath: path, promo: item.promo, reemplaza: item.reemplaza });
    }
  } catch (error) {
    console.error("[guardarPromosManuales]", error);
    return { error: "No se pudieron guardar todas las promos." };
  }

  revalidatePath("/promos");
  return { guardadas: filtradas.length };
}

const PRESUPUESTO_TANDA_MS = 200_000;

/** Una tanda del JSON de GNB (ver `lib/promos/importar-gnb.ts`). */
export async function importarTandaGnb(beneficios: unknown): Promise<{ error?: string; resumen?: ResumenIngesta }> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };

  const parsed = loteGnbSchema.safeParse(beneficios);
  if (!parsed.success) return { error: "El JSON no tiene el formato de GNB." };

  const { resumen } = await importarLoteGnb(createAdminClient(), parsed.data, PRESUPUESTO_TANDA_MS);
  return { resumen };
}
