import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { listarProductosTienda } from "@/lib/shopping/productos-tienda";
import { PageHeader } from "@/components/app-shell/page-header";
import { ShoppingBasket } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { QuitarProducto } from "./quitar-producto";
import { InstalarMarcador } from "./instalar-marcador";
import { SectionTitle } from "@/components/app-shell/page-header";
import { hrefMarcadorReal } from "@/lib/shopping/marcador-real";

/**
 * Productos de Real: qué producto exacto de Real es cada producto de las
 * listas (migración 017). Se eligen en el marcador "Llenar carrito Real",
 * en la web de Real; acá solo se ven y se quitan (quitar uno hace que el
 * marcador lo vuelva a preguntar).
 */
export default async function ProductosRealPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const productos = await listarProductosTienda(supabase, context.family.id, "real");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Productos de Real"
        description="Qué producto de Real Online es cada producto de tus listas"
      />
      <section className="hoja flex flex-col gap-3 p-4">
        <SectionTitle>Llenar el carrito de Real desde tu lista</SectionTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Una sola vez: arrastrá el botón <strong>Llenar carrito Real</strong> a la barra de marcadores de tu
            navegador (en la computadora).
          </li>
          <li>
            En Compras, en tu lista abierta, tocá <strong>Copiar para Real</strong>.
          </li>
          <li>
            Abrí realonline.com.py con tu sesión iniciada y tocá el marcador. Pegá la lista, elegí el producto de
            Real de lo que todavía no tiene, y se agrega todo al carrito.
          </li>
          <li>Al final, “Guardar lo elegido en la app” te trae acá para que la próxima vez vaya directo.</li>
        </ol>
        <InstalarMarcador href={hrefMarcadorReal()} />
        <p className="text-xs text-muted-foreground">
          El marcador corre en la página de Real con tu sesión: la app nunca entra a tu cuenta de Real ni guarda tu
          contraseña. Revisá el carrito antes de confirmar.
        </p>
      </section>

      <SectionTitle>Productos elegidos</SectionTitle>
      {productos.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Todavía no elegiste productos"
          description="Cuando llenes el carrito de Real con el marcador, lo que elijas para cada producto de tu lista queda guardado acá."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border hoja px-4">
          {productos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.producto_nombre}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.nombre_tienda} · {p.unidad}
                </p>
              </div>
              <QuitarProducto id={p.id} nombre={p.producto_nombre} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
