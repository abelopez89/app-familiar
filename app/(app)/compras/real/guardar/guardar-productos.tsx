"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { decodificarPaquete, type ProductoElegido } from "@/lib/shopping/real";
import { Button } from "@/components/ui/button";
import { guardarProductosReal } from "../actions";

type Estado =
  | { tipo: "leyendo" }
  | { tipo: "vacio" }
  | { tipo: "listo"; datos: unknown; productos: ProductoElegido[] }
  | { tipo: "guardado"; cantidad: number };

/** Muestra solo lo que tiene forma de producto; la validación de verdad la hace el servidor. */
function productosParaMostrar(datos: unknown): ProductoElegido[] {
  if (!datos || typeof datos !== "object" || !("productos" in datos) || !Array.isArray(datos.productos)) return [];
  return datos.productos.filter(
    (p): p is ProductoElegido =>
      !!p && typeof p === "object" && typeof p.nombre === "string" && typeof p.nombreTienda === "string",
  );
}

export function GuardarProductos() {
  const [estado, setEstado] = useState<Estado>({ tipo: "leyendo" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const fragmento = window.location.hash.slice(1);
    const datos = fragmento ? decodificarPaquete(fragmento) : null;
    const productos = productosParaMostrar(datos);
    // El fragmento no se manda al servidor; igual se saca de la barra para no guardarlo de nuevo al recargar.
    if (fragmento) window.history.replaceState(null, "", window.location.pathname);
    setEstado(productos.length > 0 ? { tipo: "listo", datos, productos } : { tipo: "vacio" });
  }, []);

  function guardar(datos: unknown) {
    startTransition(async () => {
      const resultado = await guardarProductosReal(datos);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      setEstado({ tipo: "guardado", cantidad: resultado.guardados ?? 0 });
    });
  }

  if (estado.tipo === "leyendo") return null;

  if (estado.tipo === "vacio") {
    return (
      <p className="hoja px-4 py-10 text-center text-sm text-muted-foreground">
        No llegó ningún producto para guardar. Esta pantalla se abre sola al terminar de llenar el carrito con el
        marcador.
      </p>
    );
  }

  if (estado.tipo === "guardado") {
    return (
      <div className="hoja flex flex-col items-center gap-3 px-4 py-10 text-center">
        <Check className="size-8 text-success" />
        <p className="font-bold">
          {estado.cantidad === 1 ? "Se guardó 1 producto." : `Se guardaron ${estado.cantidad} productos.`}
        </p>
        <p className="text-sm text-muted-foreground">La próxima vez van directo al carrito.</p>
        <Button asChild variant="outline">
          <Link href="/compras/real">Ver productos de Real</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border hoja px-4">
        {estado.productos.map((p, i) => (
          <li key={i} className="flex flex-col py-3">
            <span className="font-bold">{p.nombre}</span>
            <span className="text-sm text-muted-foreground">
              {p.nombreTienda}
              {typeof p.unidad === "string" ? ` · ${p.unidad}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => guardar(estado.datos)} disabled={pending}>
          {pending ? "Guardando…" : "Guardar productos"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/compras">Descartar</Link>
        </Button>
      </div>
    </div>
  );
}
