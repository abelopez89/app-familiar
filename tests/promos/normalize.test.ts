import { describe, expect, it } from "vitest";
import {
  normalizarAfinidad,
  normalizarBanco,
  normalizarMarca,
  normalizarNivel,
  normalizarTipo,
  nombreTarjeta,
} from "@/lib/promos/normalize";

describe("normalización con sinónimos", () => {
  it("marca", () => {
    expect(normalizarMarca("MasterCard")).toBe("mastercard");
    expect(normalizarMarca("Master Card")).toBe("mastercard");
    expect(normalizarMarca("American Express")).toBe("amex");
    expect(normalizarMarca(" VISA ")).toBe("visa");
    expect(normalizarMarca("")).toBeNull();
  });

  it("nivel", () => {
    expect(normalizarNivel("Clásica")).toBe("clasica");
    expect(normalizarNivel("Classic")).toBe("clasica");
    expect(normalizarNivel("Gold")).toBe("oro");
    expect(normalizarNivel("Platino")).toBe("platinum");
    expect(normalizarNivel("Empresarial")).toBe("empresarial");
  });

  it("afinidad", () => {
    expect(normalizarAfinidad("Afinidad Farmacenter")).toBe("farmacenter");
    expect(normalizarAfinidad("Tarjeta B")).toBe("tarjeta b");
    expect(normalizarAfinidad("   ")).toBeNull();
    expect(normalizarAfinidad(null)).toBeNull();
  });

  it("tipo y banco", () => {
    expect(normalizarTipo("Crédito")).toBe("credito");
    expect(normalizarTipo("Débito")).toBe("debito");
    expect(normalizarBanco("Banco Itaú")).toBe("itau");
    expect(normalizarBanco("BASA")).toBe("basa");
  });
});

describe("nombre de la tarjeta para los avisos", () => {
  it("MC Clásica Farmacenter", () => {
    expect(nombreTarjeta({ marca: "mastercard", nivel: "clasica", afinidad: "farmacenter" })).toBe(
      "MC Clásica Farmacenter",
    );
    expect(nombreTarjeta({ marca: "visa", nivel: "infinite", afinidad: null })).toBe("Visa Infinite");
  });
});
