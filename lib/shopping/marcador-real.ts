/**
 * Marcador "Llenar carrito Real": código que corre DENTRO de la página de
 * Real (realonline.com.py), con la sesión de la persona, cuando toca el
 * marcador en su navegador. La app solo lo sirve como texto para instalar
 * (`/compras/real`); nunca le habla a Real desde el servidor.
 *
 * Qué hace:
 * 1. Pide pegar lo que copió "Copiar para Real" en la app (`ListaParaReal`
 *    de `lib/shopping/real.ts`).
 * 2. Lee de la propia página lo mismo que usa la página para hablar con su
 *    API: el token de la sesión (`_IL-token`), el carrito (`_IL-cartId`),
 *    la sucursal (`_IL-storeId` / `selectedStore`) y la `dpl-api-key`
 *    pública que viene en el HTML.
 * 3. Los productos con producto de Real ya elegido van directo; para los
 *    demás busca en la sucursal y muestra opciones para elegir o saltear.
 * 4. Agrega todo al carrito en un solo pedido y muestra qué no entró.
 * 5. Ofrece volver a la app con lo elegido nuevo, en el fragmento de la URL
 *    (`/compras/real/guardar#…`, mismo formato que `codificarPaquete`).
 *
 * Se escribe como texto (no se compila): ES2017 sin template literals (el
 * texto vive dentro de `String.raw`). Las líneas que empiezan con `//` se
 * sacan al armar el link; no usar `//` al final de una línea de código.
 */
export const MARCADOR_REAL_FUENTE = String.raw`
(function () {
  var ID = "app-familiar-real";
  var viejo = document.getElementById(ID);
  if (viejo) { viejo.remove(); return; }
  if (!/(^|\.)realonline\.com\.py$/.test(location.hostname)) {
    alert("Este marcador se usa en realonline.com.py, con tu sesión de Real iniciada.");
    return;
  }

  var API = "https://nextgentheadless.instaleap.io/api/v3";
  var CLIENTE = "CADENA_REAL";

  function cookie(nombre) {
    var partes = document.cookie.split(";");
    for (var i = 0; i < partes.length; i++) {
      var c = partes[i].trim();
      if (c.indexOf(nombre + "=") === 0) return decodeURIComponent(c.slice(nombre.length + 1));
    }
    return null;
  }
  function guardado(clave) {
    try {
      var v = localStorage.getItem(clave);
      if (v && v.charAt(0) === '"') v = JSON.parse(v);
      return v;
    } catch (e) { return null; }
  }
  function sucursal() {
    var id = cookie("_IL-storeId");
    if (id) return id;
    try { var s = JSON.parse(localStorage.getItem("selectedStore") || "{}"); return s && s.id ? String(s.id) : null; }
    catch (e) { return null; }
  }
  function claveApi() {
    var m = document.documentElement.innerHTML.match(/dplApiKey\\*"\s*:\s*\\*"([0-9a-fA-F-]{36})/);
    return m ? m[1] : null;
  }

  var sesion = { token: cookie("_IL-token") || guardado("token"), carrito: cookie("_IL-cartId") || guardado("cartId"), sucursal: sucursal(), clave: claveApi() };

  function gql(operacion, consulta, variables) {
    return fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "token": sesion.token,
        "dpl-api-key": sesion.clave,
        "apollographql-client-name": "e-commerce Moira Engine client " + CLIENTE,
        "client-name": "e-commerce Moira Engine " + CLIENTE
      },
      body: JSON.stringify({ operationName: operacion, query: consulta, variables: variables })
    }).then(function (r) {
      return r.json().catch(function () { throw new Error("Real respondió " + r.status); });
    }).then(function (j) {
      if (j.errors && j.errors.length) throw new Error(j.errors[0].message || "Error de Real");
      return j.data;
    });
  }

  // ---- Búsqueda (la misma consulta que usa el buscador de la página) ----
  var CONSULTA_BUSCAR = "__CONSULTA_BUSCAR__";
  function buscar(texto) {
    return gql("SearchProducts", CONSULTA_BUSCAR, __VARIABLES_BUSCAR__).then(function (d) {
      var lista = (d && d.searchProducts && d.searchProducts.products) || [];
      return lista.filter(function (p) { return p && p.sku && p.isAvailable !== false; }).slice(0, 6);
    });
  }

  var CONSULTA_AGREGAR = "mutation AddProductsToEcommerceCart($addProductsToCartInput: AddProductsToCartInput!) { addProductsToEcommerceCart(addProductsToCartInput: $addProductsToCartInput) { cart { id products { reference name unitQuantity unit } } confirmationStatuses { reference validationIssues { reason productId type } } } }";
  function agregar(productos) {
    return gql("AddProductsToEcommerceCart", CONSULTA_AGREGAR, {
      addProductsToCartInput: { cartId: sesion.carrito, products: productos }
    }).then(function (d) { return d && d.addProductsToEcommerceCart; });
  }

  // Cantidad de la lista en la unidad del producto de Real. "revisar" si no se puede convertir sola.
  function convertir(p, unidadTienda) {
    var u = String(p.unidad || "").toLowerCase().replace(/\./g, "").trim();
    var q = Number(p.cantidad) || 1;
    if (/^(kg|kilo)/i.test(String(unidadTienda || ""))) {
      if (/^(g|gr|grs|gramo|gramos)$/.test(u)) return { cantidad: Math.round(q) / 1000, revisar: false };
      if (/^(kg|kgs|kilo|kilos)$/.test(u)) return { cantidad: q, revisar: false };
      return { cantidad: q, revisar: true };
    }
    if (/^(|u|un|und|unid|unidad|unidades)$/.test(u)) return { cantidad: Math.max(1, Math.ceil(q)), revisar: false };
    return { cantidad: 1, revisar: true };
  }

  function codificar(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  var guaranies = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 });
  function cuantos(n) { return n === 1 ? "1 producto" : n + " productos"; }

  // ---- Panel (en shadow DOM, para que el CSS de Real no lo toque) ----
  var host = document.createElement("div");
  host.id = ID;
  host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;";
  var raiz = host.attachShadow({ mode: "open" });
  var estilo = document.createElement("style");
  estilo.textContent = [
    ".p{font:14px/1.4 system-ui,sans-serif;color:#17321f;background:#fbfdf8;width:420px;max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.25);padding:16px 18px}",
    "h2{font-size:17px;margin:0 0 8px}h3{font-size:14px;margin:14px 0 6px}",
    "p{margin:6px 0}.m{color:#5b6b5e;font-size:12px}.e{color:#b3261e}.a{color:#a8336a}",
    "textarea,input[type=text]{width:100%;box-sizing:border-box;border:1px solid #c9d4c6;border-radius:10px;padding:8px;font:inherit}",
    "textarea{height:90px}",
    "button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:8px 14px;cursor:pointer;background:#2f6b3a;color:#fff;margin:4px 6px 0 0}",
    "button.s{background:#e5ece2;color:#17321f}button:disabled{opacity:.5;cursor:default}",
    ".prod{border-top:1px solid #e1e8de;padding:8px 0}",
    "label{display:flex;gap:8px;align-items:flex-start;padding:3px 0;cursor:pointer}",
    ".fila{display:flex;gap:6px}.fila input{flex:1}",
    ".x{position:absolute;top:10px;right:14px;background:none;color:#5b6b5e;font-size:20px;padding:0;margin:0}"
  ].join("");
  var panel = document.createElement("div");
  panel.className = "p";
  raiz.appendChild(estilo);
  raiz.appendChild(panel);
  document.body.appendChild(host);

  function el(tag, props, hijos) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === "texto") n.textContent = props[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    }
    (hijos || []).forEach(function (h) { if (h) n.appendChild(typeof h === "string" ? document.createTextNode(h) : h); });
    return n;
  }
  function mostrar(hijos) {
    panel.textContent = "";
    panel.appendChild(el("button", { "class": "x", "aria-label": "Cerrar", texto: "×", onclick: function () { host.remove(); } }));
    hijos.forEach(function (h) { if (h) panel.appendChild(h); });
  }

  // ---- Paso 1: pegar la lista ----
  function pedirLista() {
    var faltan = [];
    if (!sesion.token) faltan.push("tu sesión (iniciá sesión en Real)");
    if (!sesion.carrito) faltan.push("el carrito (agregá cualquier producto a mano una vez)");
    if (!sesion.sucursal) faltan.push("la sucursal (elegí sucursal o dirección en Real)");
    if (!sesion.clave) faltan.push("la clave de la página (recargá la página de Real)");
    if (faltan.length) {
      mostrar([el("h2", { texto: "Llenar carrito Real" }), el("p", { "class": "e", texto: "No encontré en esta página: " + faltan.join(", ") + "." })]);
      return;
    }
    var area = el("textarea", { placeholder: "Pegá acá (Ctrl+V) lo que copiaste con \"Copiar para Real\" en la app" });
    var error = el("p", { "class": "e" });
    function leer() {
      var datos;
      try { datos = JSON.parse(area.value); } catch (e) { datos = null; }
      if (!datos || datos.app !== "app-familiar" || !Array.isArray(datos.productos)) {
        if (area.value.trim()) error.textContent = "Eso no parece la lista de la app. Copiala de nuevo con \"Copiar para Real\".";
        return;
      }
      if (!datos.productos.length) { error.textContent = "La lista no tiene productos sin tildar."; return; }
      elegir(datos);
    }
    area.addEventListener("input", leer);
    mostrar([
      el("h2", { texto: "Llenar carrito Real" }),
      el("p", { "class": "m", texto: "1. En la app, en tu lista: \"Copiar para Real\". 2. Pegalo acá." }),
      area, error
    ]);
    area.focus();
  }

  // ---- Paso 2: elegir los productos que no tienen producto de Real ----
  function elegir(datos) {
    var listos = datos.productos.filter(function (p) { return p.referencia; });
    var nuevos = datos.productos.filter(function (p) { return !p.referencia; });
    var elegidos = {};
    var cajas = [];

    var boton = el("button", { texto: "Agregar al carrito", onclick: function () { confirmar(datos, listos, nuevos, elegidos); } });

    var bloques = nuevos.map(function (p, i) {
      var opciones = el("div", null, [el("p", { "class": "m", texto: "Buscando…" })]);
      var campo = el("input", { type: "text", value: p.nombre });
      function cargar() {
        opciones.textContent = "";
        opciones.appendChild(el("p", { "class": "m", texto: "Buscando…" }));
        return buscar(campo.value.trim() || p.nombre).then(function (lista) {
          opciones.textContent = "";
          var nombre = "op" + i;
          lista.forEach(function (prod) {
            var radio = el("input", { type: "radio", name: nombre });
            radio.addEventListener("change", function () { elegidos[i] = prod; });
            var precio = typeof prod.price === "number" ? " · " + guaranies.format(prod.price) : "";
            opciones.appendChild(el("label", null, [radio, el("span", null, [prod.name + (prod.brand ? " (" + prod.brand + ")" : "") + precio + " · " + (prod.unit || "")])]));
          });
          var saltear = el("input", { type: "radio", name: nombre, checked: "checked" });
          saltear.addEventListener("change", function () { delete elegidos[i]; });
          opciones.appendChild(el("label", null, [saltear, el("span", { texto: lista.length ? "No agregar" : "No encontré nada. No agregar" })]));
        }).catch(function (e) {
          opciones.textContent = "";
          opciones.appendChild(el("p", { "class": "e", texto: "No se pudo buscar: " + e.message }));
        });
      }
      cajas.push(cargar);
      return el("div", { "class": "prod" }, [
        el("strong", { texto: p.nombre + " · " + p.cantidad + " " + p.unidad }),
        el("div", { "class": "fila" }, [campo, el("button", { "class": "s", texto: "Buscar", onclick: cargar })]),
        opciones
      ]);
    });

    mostrar([
      el("h2", { texto: "Llenar carrito Real" }),
      el("p", { "class": "m", texto: datos.lista }),
      listos.length ? el("h3", { texto: "Ya elegidos (" + listos.length + ")" }) : null,
      listos.length ? el("p", { "class": "m", texto: listos.map(function (p) { return p.nombre + " → " + p.nombreTienda; }).join(" · ") }) : null,
      nuevos.length ? el("h3", { texto: "Elegí el producto de Real (" + nuevos.length + ")" }) : null
    ].concat(bloques).concat([boton]));

    // Las búsquedas van de a una, para no cargar a Real.
    cajas.reduce(function (cadena, cargar) { return cadena.then(cargar); }, Promise.resolve());
  }

  // ---- Paso 3: agregar al carrito ----
  function confirmar(datos, listos, nuevos, elegidos) {
    var aAgregar = [];
    var revisar = [];
    var guardar = [];
    listos.forEach(function (p) {
      var c = convertir(p, p.unidadTienda);
      aAgregar.push({ reference: p.referencia, unit: p.unidadTienda, unitQuantity: c.cantidad, nombre: p.nombre });
      if (c.revisar) revisar.push(p.nombre + " (" + p.cantidad + " " + p.unidad + " → " + c.cantidad + " " + p.unidadTienda + ")");
    });
    var salteados = [];
    nuevos.forEach(function (p, i) {
      var prod = elegidos[i];
      if (!prod) { salteados.push(p.nombre); return; }
      var c = convertir(p, prod.unit);
      aAgregar.push({ reference: prod.sku, unit: prod.unit, unitQuantity: c.cantidad, nombre: p.nombre });
      if (c.revisar) revisar.push(p.nombre + " (" + p.cantidad + " " + p.unidad + " → " + c.cantidad + " " + prod.unit + ")");
      guardar.push({ nombre: p.nombre, referencia: String(prod.sku), nombreTienda: prod.name, unidad: prod.unit || "Un" });
    });
    if (!aAgregar.length) { pedirLista(); return; }

    mostrar([el("h2", { texto: "Agregando " + cuantos(aAgregar.length) + "…" })]);
    agregar(aAgregar.map(function (a) { return { reference: String(a.reference), unit: a.unit, unitQuantity: a.unitQuantity }; }))
      .then(function (res) {
        var problemas = [];
        ((res && res.confirmationStatuses) || []).forEach(function (s) {
          (s.validationIssues || []).forEach(function (v) {
            var a = aAgregar.filter(function (x) { return String(x.reference) === String(s.reference); })[0];
            problemas.push((a ? a.nombre : s.reference) + ": " + (v.reason || v.type));
          });
        });
        terminar(datos, aAgregar.length - problemas.length, problemas, revisar, salteados, guardar);
      })
      .catch(function (e) {
        mostrar([el("h2", { texto: "No se pudo agregar" }), el("p", { "class": "e", texto: e.message }),
          el("p", { "class": "m", texto: "Si dice que la sesión venció, recargá la página de Real y volvé a tocar el marcador." })]);
      });
  }

  // ---- Paso 4: resumen y volver a la app ----
  function terminar(datos, agregados, problemas, revisar, salteados, guardar) {
    var volver = null;
    if (guardar.length && /^https:\/\//.test(datos.volver || "")) {
      volver = el("button", { texto: "Guardar lo elegido en la app (" + guardar.length + ")", onclick: function () {
        window.open(datos.volver + "#" + codificar({ v: 1, productos: guardar }), "_blank", "noopener");
      } });
    }
    mostrar([
      el("h2", { texto: "Listo: " + cuantos(Math.max(0, agregados)) + " en el carrito" }),
      el("p", { "class": "m", texto: "Revisá el carrito, sumá lo de último momento y confirmá en Real." }),
      problemas.length ? el("h3", { texto: "No entraron" }) : null,
      problemas.length ? el("p", { "class": "e", texto: problemas.join(" · ") }) : null,
      revisar.length ? el("h3", { texto: "Revisá la cantidad" }) : null,
      revisar.length ? el("p", { "class": "a", texto: revisar.join(" · ") }) : null,
      salteados.length ? el("h3", { texto: "Quedaron afuera" }) : null,
      salteados.length ? el("p", { "class": "m", texto: salteados.join(" · ") }) : null,
      volver,
      el("button", { "class": "s", texto: "Cerrar", onclick: function () { host.remove(); } })
    ]);
  }

  pedirLista();
})();
`;

/** El link del marcador: sin comentarios de línea ni sangría, codificado para `href`. */
export function hrefMarcadorReal(): string {
  const codigo = MARCADOR_REAL_FUENTE.split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea && !linea.startsWith("//"))
    .join("\n");
  return "javascript:" + encodeURIComponent(codigo);
}
