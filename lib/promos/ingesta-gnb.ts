import "server-only";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import { correrIngesta } from "./ingesta";
import { claveGnb, fetchGnbBenefits, prefiltrarGnb, textoGnb } from "./gnb";

/** Ingesta diaria de GNB (API JSON pública). */
export function ingestarGnb(db: Db, presupuestoMs: number) {
  return correrIngesta(db, {
    banco: "gnb",
    origen: "api",
    presupuestoMs,
    obtenerItems: async () =>
      (await fetchGnbBenefits()).map((benefit) => ({
        clave: claveGnb(benefit),
        texto: textoGnb(benefit),
        // La API no publica el link de cada beneficio: se guarda el del sitio.
        urlFuente: "https://www.beneficiosbancognb.com.py/",
        raw: benefit as unknown as Json,
        prefiltro: prefiltrarGnb(benefit),
      })),
  });
}
