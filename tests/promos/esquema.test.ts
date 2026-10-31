import { describe, expect, it } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { deSalidaModelo, normalizacionSchema, salidaModeloSchema, type SalidaModelo } from "@/lib/promos/esquema";

/** Parámetros con unión de tipos (`type: [...]` o `anyOf`) en el JSON Schema. */
function contarUniones(nodo: unknown): number {
  if (Array.isArray(nodo)) return nodo.reduce((n, x) => n + contarUniones(x), 0);
  if (!nodo || typeof nodo !== "object") return 0;
  const o = nodo as Record<string, unknown>;
  const propia = Array.isArray(o.type) || Array.isArray(o.anyOf) ? 1 : 0;
  return propia + Object.values(o).reduce<number>((n, v) => n + contarUniones(v), 0);
}

describe("esquema de salida para Claude", () => {
  it("no pasa el límite de 16 parámetros con unión de structured outputs", () => {
    // Pasó en producción: 19 nullables y la API rechazó todas las llamadas con 400.
    expect(contarUniones(betaZodOutputFormat(salidaModeloSchema).schema)).toBeLessThanOrEqual(16);
    // La forma interna sí los tiene: por eso no se manda al modelo.
    expect(contarUniones(betaZodOutputFormat(normalizacionSchema).schema)).toBeGreaterThan(16);
  });

  it('convierte "", 0, [] y los valores de "no dice" a null', () => {
    const salida: SalidaModelo = {
      promociones: [
        {
          titulo: "Areté",
          resumen: "15% de reintegro los domingos",
          rubro: "supermercado",
          canal: "",
          acumulable: "no_dice",
          vigencia_desde: "2026-01-04",
          vigencia_hasta: "",
          comercios: [{ nombre: "Areté", desde: "", hasta: "" }],
          beneficios: [
            {
              nombre: "General",
              dias_semana: [0],
              fechas: [],
              prioridad: 0,
              componentes: [
                {
                  tipo: "reintegro",
                  porcentaje: 15,
                  monto: 0,
                  cuotas: 0,
                  es_hasta: false,
                  alcance: "",
                  tope_monto: 0,
                  tope_periodo: "sin_tope",
                  tope_alcance: "",
                },
              ],
              tarjetas: [{ regla: "incluye", marca: "", nivel: "", afinidad: "", tipo: "credito" }],
            },
          ],
        },
      ],
    };
    const [promo] = deSalidaModelo(salida);
    expect(promo.canal).toBeNull();
    expect(promo.acumulable).toBeNull();
    expect(promo.vigencia_hasta).toBeNull();
    expect(promo.comercios[0]).toEqual({ nombre: "Areté", desde: null, hasta: null });
    expect(promo.beneficios[0].fechas).toBeNull();
    expect(promo.beneficios[0].dias_semana).toEqual([0]);
    expect(promo.beneficios[0].componentes[0]).toMatchObject({
      porcentaje: 15,
      monto: null,
      cuotas: null,
      alcance: null,
      tope_monto: null,
      tope_periodo: null,
    });
    expect(promo.beneficios[0].tarjetas[0]).toEqual({
      regla: "incluye",
      marca: null,
      nivel: null,
      afinidad: null,
      tipo: "credito",
    });
  });
});
