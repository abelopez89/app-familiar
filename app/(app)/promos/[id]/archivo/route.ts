import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents/constants";

/**
 * Descarga el PDF o la captura de una promo cargada a mano. Redirige a una
 * URL firmada de 60 segundos, generada con el **cliente de sesión** (como
 * los documentos, regla 2 de la Fase 5): las políticas de
 * `storage.objects` dejan bajar solo los archivos de la propia familia
 * (`{family_id}/promos/…`). Es un Route Handler y no una Server Action
 * para que el link funcione como un `<a>` común, sin que el navegador del
 * celular bloquee una pestaña abierta después de un `await`.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: promo } = await supabase
    .from("promociones")
    .select("banco, titulo, archivo_path")
    .eq("id", id)
    .maybeSingle();
  if (!promo?.archivo_path) return new NextResponse("Esta promo no tiene archivo.", { status: 404 });

  const extension = promo.archivo_path.split(".").pop() ?? "pdf";
  const nombre = `${promo.banco}-${promo.titulo}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(promo.archivo_path, 60, { download: `${nombre || "promo"}.${extension}` });
  if (error || !data) return new NextResponse("No se pudo abrir el archivo (puede ser de otra familia).", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
