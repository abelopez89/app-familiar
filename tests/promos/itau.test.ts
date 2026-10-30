import { describe, expect, it } from "vitest";
import { claveItau, firmaItau, parsearListadoItau, textoItau, tienePorcentajeItau } from "@/lib/promos/itau";

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
      { b: "124", c: "9", comercio: "Tienda & Hogar", nombre: "Tienda & Hogar", badges: ["10 Cuotas sin intereses"] },
    ]);
    expect(claveItau(items[0])).toBe("itau:123:45");
  });

  it("prefiltro: sin % en ningún badge se descarta sin pedir el detalle", () => {
    const [con, sin] = parsearListadoItau(html);
    expect(tienePorcentajeItau(con)).toBe(true);
    expect(tienePorcentajeItau(sin)).toBe(false);
  });
});

// Fragmentos de la respuesta real de Itaú (prueba de conexión del
// 30/10/2026, guardada en promo_ingestas), recortados.
const listadoReal = `<a href="#" onclick="buscar('16929','31447','Aret&#233;')" class="item-oferta mb-4" data-toggle="modal" data-target="#detalleComercio">
                    <span class="img-mask"><img src="x.png" alt="Logo Aret&#233;" class="w-100"></span>
                    <div class="descripcion">
                        <h6>Aret&#233;</h6>
                            <small class="badge badge-secondary">
                                15 %
                                                                                            </small>
                            <small class="badge badge-secondary"><i class='icon-itaufonts_cartao'></i>tarjeta de crédito</small>
                    </div>
                </a>`;

const detalleReal = `    <style>
        li { margin-left:0 !important; }
    </style>
    <div class="row mb-3">
        <!------>
        <div class="col-md-8">
            <h2>Areté</h2>
            <p>Desde el 1 de marzo hasta el 31 de diciembre de 2026. Pagando con tus tarjetas de cr&#233;dito de Ita&#250;. Tenes 15% de reintegro. Aplica los domingos.</p>
        </div>
    </div>
    <ul class="list-unstyled item-caracteristicas">
        <li><span class='icon'></span> <strong>vigencia:</strong> 2026-01-04 hasta 2026-12-31</li>
    </ul>`;

describe("respuesta real de Itaú", () => {
  it("decodifica las entidades del listado", () => {
    const [item] = parsearListadoItau(listadoReal);
    expect(item).toEqual({
      b: "16929",
      c: "31447",
      comercio: "Areté",
      nombre: "Areté",
      badges: ["15 %", "tarjeta de crédito"],
    });
    expect(firmaItau(item)).toBe("Areté|15 %|tarjeta de crédito");
  });

  it("el texto para Claude no lleva CSS y sí la descripción y la vigencia", () => {
    const [item] = parsearListadoItau(listadoReal);
    const texto = textoItau(item, detalleReal);
    expect(texto).not.toContain("margin-left");
    expect(texto).toContain("tarjetas de crédito de Itaú");
    expect(texto).toContain("Aplica los domingos");
    expect(texto).toContain("vigencia: 2026-01-04 hasta 2026-12-31");
  });
});
