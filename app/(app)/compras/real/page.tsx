import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { listarProductosTienda } from "@/lib/shopping/productos-tienda";
import { PageHeader } from "@/components/app-shell/page-header";
import { ShoppingBasket } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { QuitarProducto } from "./quitar-producto";

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
