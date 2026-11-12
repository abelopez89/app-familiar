import { PageHeader } from "@/components/app-shell/page-header";
import { GuardarProductos } from "./guardar-productos";

/**
 * Adonde vuelve el marcador "Llenar carrito Real" con los productos que la
 * persona eligió (en el fragmento de la URL: ver `lib/shopping/real.ts`).
 * Se muestran y se guardan con un toque, nunca solos: cualquiera podría
 * armar este link.
 */
export default function GuardarProductosRealPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Guardar productos de Real" description="Lo que elegiste en el carrito de Real Online" />
      <GuardarProductos />
    </div>
  );
}
