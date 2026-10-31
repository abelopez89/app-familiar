import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filtrarPromos, type PromoFiltrada } from "@/lib/promos/filtrado";
import { beneficioDelDia, type TarjetaParaMatch } from "@/lib/promos/matching";
import type { Banco } from "@/lib/promos/constants";
import { mcClasicaFarmacenter, mcOroTarjetaB, FECHAS_ESPECIALES_FARMACENTER } from "../fixtures/promos/esperadas";

/**
 * Tests de extracción contra los PDF reales (`tests/fixtures/promos/`):
 * mandan cada PDF a Claude, igual que la carga manual, y verifican que lo
 * extraído se comporte como la transcripción de `esperadas.ts` al
 * cruzarlo con las tarjetas de la familia en fechas clave. Se compara el
 * comportamiento (qué beneficio le toca a qué tarjeta qué día), no el
 * texto literal, que puede variar entre corridas.
 *
 * Llaman a la API (cuestan plata y tardan): corren solo con
 * `ANTHROPIC_API_KEY` en el entorno, por ejemplo
 * `ANTHROPIC_API_KEY=… npx vitest run tests/promos/extraccion.test.ts`.
 */

const CON_API = !!process.env.ANTHROPIC_API_KEY;
const HOY = "2026-10-31";

async function extraer(banco: Banco, archivo: string): Promise<PromoFiltrada[]> {
  // env.ts exige las variables de Supabase al importarse; acá no se usan.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test";
  process.env.NEXT_PUBLIC_APP_URL ??= "https://test";
  const { normalizarPromo } = await import("@/lib/promos/normalizar");
  const base64 = readFileSync(new URL(`../fixtures/promos/${archivo}`, import.meta.url)).toString("base64");
  const normalizadas = await normalizarPromo({
    banco,
    origen: "manual",
    hoy: HOY,
    archivo: { mediaType: "application/pdf", base64 },
  });
  const filtrado = filtrarPromos(normalizadas);
  if (!filtrado.ok) throw new Error(`todo descartado: ${filtrado.motivo}`);
  return filtrado.promos;
}

/** La mejor capa que le toca a la tarjeta ese día, en cualquiera de las promos extraídas. */
function capaDelDia(promos: PromoFiltrada[], banco: Banco, tarjeta: TarjetaParaMatch, fecha: string) {
  for (const promo of promos) {
    const capa = beneficioDelDia({ ...promo, banco, activa: true }, tarjeta, fecha);
    if (capa) return capa;
  }
  return null;
}

const porcentajes = (capa: ReturnType<typeof capaDelDia>, tipo: string) =>
  (capa?.componentes ?? []).filter((c) => c.tipo === tipo).map((c) => c.porcentaje);

describe.skipIf(!CON_API)("extracción de los PDF reales con Claude", () => {
  it("BASA jueves de supermercado", { timeout: 180_000 }, async () => {
    const promos = await extraer("basa", "basa-jueves-supermercado.pdf");
    expect(promos.every((p) => p.rubro === "supermercado")).toBe(true);

    // MC Clásica Farmacenter: 20% de reintegro los jueves, tope Gs. 1.500.000 por mes.
    const jueves = capaDelDia(promos, "basa", mcClasicaFarmacenter, "2026-11-05");
    expect(porcentajes(jueves, "reintegro")).toContain(20);
    expect(jueves?.componentes.some((c) => c.tope_monto === 1_500_000 && c.tope_periodo === "mes")).toBe(true);
    expect(capaDelDia(promos, "basa", mcClasicaFarmacenter, "2026-11-04")).toBeNull();

    // MC Oro (Tarjeta B) está excluida explícitamente.
    expect(capaDelDia(promos, "basa", mcOroTarjetaB, "2026-11-05")).toBeNull();
  });

  it("BASA Farmacenter", { timeout: 180_000 }, async () => {
    const promos = await extraer("basa", "basa-farmacenter.pdf");
    expect(promos.every((p) => p.rubro === "farmacia")).toBe(true);

    // Martes común: 25% / 20% en caja + 10% de reintegro.
    const martes = capaDelDia(promos, "basa", mcClasicaFarmacenter, "2026-11-03");
    expect(porcentajes(martes, "descuento_caja")).toEqual(expect.arrayContaining([25, 20]));
    expect(porcentajes(martes, "reintegro")).toContain(10);

    // Fechas especiales: hasta 50% en caja, en lugar de la capa general.
    for (const fecha of FECHAS_ESPECIALES_FARMACENTER.filter((f) => f >= HOY)) {
      const especial = capaDelDia(promos, "basa", mcClasicaFarmacenter, fecha);
      expect(porcentajes(especial, "descuento_caja"), fecha).toContain(50);
    }

    // MC Oro (Tarjeta B) no está entre las incluidas.
    expect(capaDelDia(promos, "basa", mcOroTarjetaB, "2026-11-03")).toBeNull();
  });

  it("Sudameris Cadena Real", { timeout: 180_000 }, async () => {
    const promos = await extraer("sudameris", "sudameris-cadena-real.pdf");
    const visa: TarjetaParaMatch = { banco: "sudameris", marca: "visa", nivel: "clasica", afinidad: null, tipo: "credito" };

    // Solo el 20% de reintegro del primer viernes; el de 12 cuotas se descarta.
    const primerViernes = capaDelDia(promos, "sudameris", visa, "2026-11-06");
    expect(porcentajes(primerViernes, "reintegro")).toContain(20);
    expect(primerViernes?.componentes.some((c) => c.tope_monto === 1_500_000)).toBe(true);
    expect(capaDelDia(promos, "sudameris", visa, "2026-11-13")).toBeNull();
    expect(capaDelDia(promos, "sudameris", { ...visa, tipo: "debito" }, "2026-11-06")).toBeNull();
  });
});
