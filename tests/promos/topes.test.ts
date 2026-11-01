import { describe, expect, it } from "vitest";
import { estadoTopes, type UsoParaTope } from "@/lib/promos/topes";

function uso(id: string, fecha: string, descuento: number, base: number, extra: Partial<UsoParaTope> = {}): UsoParaTope {
  return {
    id,
    fecha,
    promo_id: "p1",
    tarjeta_id: "t1",
    promo_titulo: "Enex",
    tarjeta_alias: "Visa",
    detalle: {
      beneficio: "General",
      aplicados: [
        {
          clave: "reintegro||mes",
          tipo: "reintegro",
          porcentaje: 10,
          monto: null,
          alcance: null,
          base,
          descuento,
          tope_monto: 600_000,
          tope_tipo: "descuento",
          tope_periodo: "mes",
          restante: null,
          topeAlcanzado: false,
          topeDudoso: false,
        },
      ],
    },
    ...extra,
  };
}

describe("estadoTopes", () => {
  it("suma lo usado del mes por promo y tarjeta", () => {
    const estados = estadoTopes(
      [
        uso("a", "2026-11-02", 200_000, 2_000_000),
        uso("b", "2026-11-20", 150_000, 1_500_000),
        uso("c", "2026-10-30", 600_000, 6_000_000),
        uso("d", "2026-11-05", 50_000, 500_000, { tarjeta_id: "t2", tarjeta_alias: "Master" }),
      ],
      "2026-11-25",
    );
    expect(estados).toHaveLength(2);
    expect(estados[0]).toMatchObject({ tarjetaAlias: "Visa", usado: 350_000, tope: 600_000 });
    expect(estados[1]).toMatchObject({ tarjetaAlias: "Master", usado: 50_000 });
  });
});
