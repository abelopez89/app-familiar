import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/documents/constants";

/**
 * Ruta de Storage: {family_id}/{document_id}/{nombre_archivo}. El primer
 * segmento no es decorativo — es contra lo que comparan las políticas de
 * storage.objects (ver migración 010). El nombre de archivo se genera acá
 * (uuid + extensión) para no depender del nombre original del celular,
 * que puede traer espacios, tildes o repetirse entre subidas.
 */
export function buildStoragePath(familyId: string, documentId: string, originalName: string): string {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : null;
  const safeExt = ext && /^[a-zA-Z0-9]{1,8}$/.test(ext) ? `.${ext.toLowerCase()}` : "";
  return `${familyId}/${documentId}/${crypto.randomUUID()}${safeExt}`;
}

/**
 * Sube un archivo con el cliente de sesión (no el admin client): así las
 * políticas de storage.objects se aplican solas y no hay forma de que el
 * código suba (o lea) por error algo fuera de la carpeta de la propia
 * familia. Ver CLAUDE.md, Fase 5.
 */
export async function uploadDocumentFile(
  path: string,
  file: File | Blob,
  contentType?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    contentType: contentType ?? (file instanceof File ? file.type : undefined),
    upsert: false,
  });
  return { error: error ? error.message : null };
}

export async function removeDocumentFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
}

/**
 * Signed URL de 60 segundos para mostrar o descargar un archivo. Con el
 * cliente de sesión: si el usuario no pertenece a la familia dueña del
 * archivo, storage.objects deniega el select y esto devuelve error — el
 * aislamiento entre familias lo resuelve la base, no el código (a
 * diferencia del feed ICS de la Fase 2, acá sí hay sesión).
 */
export async function getSignedDocumentUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
