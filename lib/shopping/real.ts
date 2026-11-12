/**
 * Formato de lo que el marcador "Llenar carrito Real" le devuelve a la app:
 * los productos de Real que la persona eligió para los productos de su
 * lista. Viaja en el fragmento de la URL (`/compras/real/guardar#<datos>`),
 * que el navegador no manda al servidor ni queda en los logs: lo lee la
 * página en el cliente y lo pasa a la Server Action, que lo vuelve a
 * validar con Zod (`productosElegidosSchema` en `productos-tienda.ts`).
 *
 * Sin dependencias: lo usa una página de cliente y el marcador arma el
 * mismo formato a mano (`{ v: 1, productos: [...] }` en JSON, UTF-8 y
 * base64url).
 */

export type ProductoElegido = {
  /** El producto como figura en la lista de la app ("Leche"). */
  nombre: string;
  /** Código del producto en Real (`reference` en su API). */
  referencia: string;
  /** Nombre del producto en Real ("Leche Trébol entera 1 L"). */
  nombreTienda: string;
  /** Unidad del producto en Real ("Kg", "Un"…). */
  unidad: string;
};

export type PaqueteProductos = { v: 1; productos: ProductoElegido[] };

export function codificarPaquete(paquete: PaqueteProductos): string {
  const bytes = new TextEncoder().encode(JSON.stringify(paquete));
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Devuelve el objeto sin validar (lo valida el servidor), o null si no se puede leer. */
export function decodificarPaquete(texto: string): unknown {
  try {
    const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(base64 + "===".slice((base64.length + 3) % 4));
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
