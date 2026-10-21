/**
 * Esqueleto genérico de pantalla para los `loading.tsx`: el encabezado
 * (como `PageHeader`) y unas filas de tarjeta. Es deliberadamente neutro
 * — no imita ninguna pantalla en particular — porque el mismo límite de
 * carga puede cubrir pantallas distintas de una sección (el de
 * `/compras` también aparece al entrar a una lista). Lo que importa es
 * que al tocar algo la pantalla cambie al instante, en vez de quedarse
 * quieta hasta que responda el servidor. Ver "Latencia percibida" en
 * CLAUDE.md.
 */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center gap-3">
        <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
