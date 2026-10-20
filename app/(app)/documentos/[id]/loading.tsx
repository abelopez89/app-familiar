/**
 * Esqueleto del visor mientras llegan el documento y sus URLs firmadas.
 * Next prefetchea este límite de carga junto con el link de la lista, así
 * que al tocar un documento la pantalla cambia al instante (antes no
 * pasaba nada visible hasta que respondía el servidor). Mismo marco que
 * `DocumentViewer`: título arriba y el área de la imagen.
 */
export default function DocumentoLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando documento">
      <div className="h-7 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="aspect-[3/4] max-h-[70vh] w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
