import "server-only";
import type { Db } from "@/lib/services/types";
import { env } from "@/lib/env";
import { dayOfWeekOfDateOnly, hourInFamilyTimezone, todayInFamilyTimezone } from "@/lib/dates";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { HORA_AVISO_DIARIO, HORA_AVISO_VISPERA, PROMOS_AVISOS } from "./constants";
import {
  avisoVencimientos,
  avisoVispera,
  promosPorVencer,
  resumenDelDia,
  resumenSemanal,
  type TarjetaAviso,
} from "./avisos";
import { leerPromos } from "./queries";

/**
 * Envío de los avisos de promos (Fase 5), lo llama `/api/cron/promos-avisos`
 * cada hora. Cada aviso tiene su hora mínima (diario y vencimientos desde
 * las 07:00, víspera desde las 20:00, semanal los lunes desde las 07:00)
 * y se manda una vez por día y por miembro: si el cron corre de más o se
 * atrasa, no repite ni se pierde.
 *
 * Idempotencia sin migración: antes de mandar se "reclama" la clave
 * `aviso:<tipo>:<memberId>:<fecha>` (o `aviso:vence:<memberId>:<promoId>`)
 * en `promo_descartadas`, el registro de "ya visto" del módulo; si el
 * insert choca contra la primary key, ya se mandó. Si Telegram falla, se
 * borra la clave y se reintenta en la corrida siguiente. Las claves de más
 * de 45 días se limpian acá mismo.
 *
 * Admin client: no hay sesión. Las tarjetas y los miembros se agrupan por
 * `family_id` y cada familia recibe solo lo calculado con sus tarjetas.
 */

export type ResumenAvisos = { enviados: number; fallidos: number; tipos: string[] };

const DIAS_LIMPIEZA = 45;

async function reclamar(db: Db, clave: string): Promise<boolean> {
  const { error } = await db
    .from("promo_descartadas")
    .insert({ clave_externa: clave, hash: clave, motivo: "aviso de promos enviado" });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function liberar(db: Db, claves: string[]): Promise<void> {
  if (claves.length > 0) await db.from("promo_descartadas").delete().in("clave_externa", claves);
}

export async function enviarAvisosPromos(db: Db): Promise<ResumenAvisos> {
  const hoy = todayInFamilyTimezone();
  const hora = hourInFamilyTimezone();
  const tipos = {
    diario: PROMOS_AVISOS.diario && hora >= HORA_AVISO_DIARIO,
    vispera: PROMOS_AVISOS.vispera && hora >= HORA_AVISO_VISPERA,
    vence: PROMOS_AVISOS.vencimiento && hora >= HORA_AVISO_DIARIO,
    semanal: PROMOS_AVISOS.semanal && dayOfWeekOfDateOnly(hoy) === 1 && hora >= HORA_AVISO_DIARIO,
  };
  const resumen: ResumenAvisos = {
    enviados: 0,
    fallidos: 0,
    tipos: Object.entries(tipos)
      .filter(([, v]) => v)
      .map(([k]) => k),
  };

  const limite = new Date(Date.now() - DIAS_LIMPIEZA * 86_400_000).toISOString();
  await db.from("promo_descartadas").delete().like("clave_externa", "aviso:%").lt("descartada_en", limite);
  if (resumen.tipos.length === 0) return resumen;

  const { data: tarjetas, error: tarjetasError } = await db
    .from("tarjetas_familia")
    .select("id, family_id, member_id, banco, marca, nivel, afinidad, tipo, alias")
    .eq("activa", true);
  if (tarjetasError) throw tarjetasError;
  const familias = [...new Set((tarjetas ?? []).map((t) => t.family_id))];
  if (familias.length === 0) return resumen;

  const [{ data: miembros, error: miembrosError }, promos] = await Promise.all([
    db
      .from("family_members")
      .select("id, family_id, display_name, telegram_user_id")
      .in("family_id", familias)
      .eq("is_active", true),
    leerPromos(db, hoy, true),
  ]);
  if (miembrosError) throw miembrosError;

  const pie = `Más en ${env.NEXT_PUBLIC_APP_URL}/promos`;

  for (const familyId of familias) {
    const deLaFamilia: TarjetaAviso[] = (tarjetas ?? []).filter((t) => t.family_id === familyId);
    const integrantes = (miembros ?? []).filter((m) => m.family_id === familyId);
    const nombres = new Map(integrantes.map((m) => [m.id, m.display_name]));
    const porVencer = tipos.vence ? promosPorVencer(promos, deLaFamilia, hoy) : [];

    // Lo mismo para toda la familia: se calcula una vez.
    const mensajes = {
      diario: tipos.diario ? resumenDelDia(promos, deLaFamilia, hoy, nombres, pie) : null,
      vispera: tipos.vispera ? avisoVispera(promos, deLaFamilia, hoy, nombres, pie) : null,
      semanal: tipos.semanal ? resumenSemanal(promos, deLaFamilia, hoy, pie) : null,
    };

    for (const miembro of integrantes) {
      if (!miembro.telegram_user_id) continue;
      const chatId = miembro.telegram_user_id;

      for (const [tipo, texto] of Object.entries(mensajes)) {
        if (!texto) continue;
        const clave = `aviso:${tipo}:${miembro.id}:${hoy}`;
        if (!(await reclamar(db, clave))) continue;
        if (await sendTelegramMessage(chatId, texto)) resumen.enviados++;
        else {
          resumen.fallidos++;
          await liberar(db, [clave]);
        }
      }

      // Vencimientos: una vez por promo y por miembro, no todos los días.
      const nuevas = [];
      const claves: string[] = [];
      for (const promo of porVencer) {
        const clave = `aviso:vence:${miembro.id}:${promo.id}`;
        if (await reclamar(db, clave)) {
          nuevas.push(promo);
          claves.push(clave);
        }
      }
      const texto = avisoVencimientos(nuevas, hoy, pie);
      if (!texto) continue;
      if (await sendTelegramMessage(chatId, texto)) resumen.enviados++;
      else {
        resumen.fallidos++;
        await liberar(db, claves);
      }
    }
  }
  return resumen;
}
