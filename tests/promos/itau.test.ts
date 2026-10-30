import { describe, expect, it } from "vitest";
import { claveItau, parsearListadoItau, tienePorcentajeItau } from "@/lib/promos/itau";

// HTML sintético con la estructura descripta del listado de Itaú
// (`a.item-oferta` con `buscar('B','C','Comercio')`, `h6` y `small.badge`).
// No es una respuesta real del sitio: el parser se ajusta con la muestra
// que deja la prueba de conexión en `promo_ingestas`.
const html = `
<div class="row">
  <a href="#" class="item-oferta col-6" onclick="buscar('123','45','Superseis')">
    <img src="x.png"><h6>Superseis</h6>
    <small class="badge badge-primary">20 %</small>
    <small class="badge">6 Cuotas sin intereses</small>
  </a>
  <a class="item-oferta" onclick="buscar( '124' , '9' , 'Tienda &amp; Hogar' )">
    <h6> Tienda &amp; Hogar </h6>
    <small class="badge">10 Cuotas sin intereses</small>
  </a>
  <a class="otro">no es una promo</a>
</div>`;

describe("listado de Itaú", () => {
  it("lee b, c, comercio, nombre y badges de cada item-oferta", () => {
    const items = parsearListadoItau(html);
    expect(items).toEqual([
      { b: "123", c: "45", comercio: "Superseis", nombre: "Superseis", badges: ["20 %", "6 Cuotas sin intereses"] },
      { b: "124", c: "9", comercio: "Tienda &amp; Hogar", nombre: "Tienda & Hogar", badges: ["10 Cuotas sin intereses"] },
    ]);
    expect(claveItau(items[0])).toBe("itau:123:45");
  });

  it("prefiltro: sin % en ningún badge se descarta sin pedir el detalle", () => {
    const [con, sin] = parsearListadoItau(html);
    expect(tienePorcentajeItau(con)).toBe(true);
    expect(tienePorcentajeItau(sin)).toBe(false);
  });
});
