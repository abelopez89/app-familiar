import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/documents/constants";

/**
 * Abre o descarga una página de un documento (`?pagina=<n>`, desde 0;
 * `?descargar=1` para bajarla con nombre). Lo usa el panel de vista previa
 * de `/documentos` en escritorio: el panel puede quedar abierto más de los
 * 60 segundos que dura una URL firmada, así que el botón apunta acá y la
 * URL se firma recién al hacer clic. Mismo patrón que
 * `/promos/[id]/archivo`: **cliente de sesión** (regla 2 de la Fase 5),
 * así RLS y las políticas de `storage.objects` solo dejan abrir archivos
 * de la propia familia; Route Handler para que sea un `<a>` común.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pagina = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("pagina") ?? "0", 10) || 0);
  const descargar = request.nextUrl.searchParams.get("descargar") === "1";

  const supabase = await createClient();
  const [documentRes, filesRes] = await Promise.all([
    supabase.from("documents").select("title").eq("id", id).maybeSingle(),
    supabase
      .from("document_files")
      .select("storage_path")
      .eq("document_id", id)
      .order("sort_order", { ascending: true }),
  ]);
  const file = filesRes.data?.[pagina];
  if (!documentRes.data || !file) return new NextResponse("No se encontró el archivo.", { status: 404 });

  const extension = file.storage_path.includes(".") ? file.storage_path.split(".").pop() : null;
  const nombre = documentRes.data.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const total = filesRes.data?.length ?? 1;
  const sufijo = total > 1 ? `-${pagina + 1}` : "";
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(
      file.storage_path,
      SIGNED_URL_TTL_SECONDS,
      descargar ? { download: `${nombre || "documento"}${sufijo}${extension ? `.${extension}` : ""}` } : undefined,
    );
  if (error || !data) return new NextResponse("No se pudo abrir el archivo.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
