import "server-only";
import { z } from "zod";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import { correrIngesta } from "./ingesta";
import { claveGnb, prefiltrarGnb, textoGnb, type GnbBenefit } from "./gnb";

/**
 * Importación del JSON de GNB bajado a mano en el navegador (GNB rechaza
 * los pedidos desde servidores, ver CLAUDE.md). El navegador lee el JSON y
 * lo manda en tandas chicas; cada tanda es una corrida de la ingesta común
 * (prefiltro, hash, Claude, filtrado), sin desactivar lo que no vino en la
 * tanda.
 */

export const TAMANO_TANDA_GNB = 8;

const beneficioSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().nullish(),
  miniDescription: z.string().nullish(),
  circleText: z.string().nullish(),
  description: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
});

export const loteGnbSchema = z.array(beneficioSchema).min(1).max(TAMANO_TANDA_GNB);

export function importarLoteGnb(db: Db, beneficios: GnbBenefit[], presupuestoMs: number) {
  return correrIngesta(db, {
    banco: "gnb",
    origen: "api",
    presupuestoMs,
    desactivarFaltantes: false,
    obtenerItems: async () =>
      beneficios.map((benefit) => {
        const texto = textoGnb(benefit);
        return {
          clave: claveGnb(benefit),
          firma: texto,
          obtenerTexto: async () => texto,
          urlFuente: "https://www.beneficiosbancognb.com.py/",
          raw: benefit as unknown as Json,
          prefiltro: prefiltrarGnb(benefit),
        };
      }),
  });
}
