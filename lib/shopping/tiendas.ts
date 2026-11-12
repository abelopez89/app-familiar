/**
 * Supermercados online donde la familia arma el carrito. La app no toca el
 * carrito (vive en la sesión de la persona en la web del súper, y Salemma
 * rechaza los pedidos desde servidores): solo abre la búsqueda de la tienda
 * con el nombre del producto, para agregarlo desde ahí. En el orden en que
 * se muestran (la más usada primero).
 */
export const TIENDAS_ONLINE = [
  { key: "real", nombre: "Real", nombreCompleto: "Real Online", buscar: "https://www.realonline.com.py/search?name=" },
  { key: "salemma", nombre: "Salemma", nombreCompleto: "Salemma Online", buscar: "https://www.salemmaonline.com.py/buscar?q=" },
] as const;

export type TiendaOnline = (typeof TIENDAS_ONLINE)[number];

export function urlBusquedaTienda(tienda: TiendaOnline, producto: string): string {
  return tienda.buscar + encodeURIComponent(producto.trim());
}
