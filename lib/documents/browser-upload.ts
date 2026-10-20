import { createClient } from "@/lib/supabase/client";
import { DOCUMENTS_BUCKET } from "@/lib/documents/constants";

/**
 * Sube un archivo a Storage directo desde el navegador, con la sesión de
 * quien está usando la app (cliente de navegador, anon key + cookies):
 * aplican las mismas políticas de storage.objects que en el servidor, así
 * que no se puede escribir fuera de la carpeta de la propia familia. La
 * ruta la arma siempre el servidor (`buildStoragePath`) y el archivo se
 * registra después con `attachDocumentFile`.
 *
 * Existe para no hacer pasar la imagen dos veces (celular → Vercel →
 * Storage) dentro de una Server Action que la persona tiene que esperar.
 */
export async function uploadDocumentFileFromBrowser(
  path: string,
  file: Blob,
  contentType: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { contentType, upsert: false });
  return { error: error ? error.message : null };
}
