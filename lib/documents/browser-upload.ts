import { DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { env } from "@/lib/env";

/**
 * Sube un archivo a Storage directo desde el navegador, con la sesión de
 * quien está usando la app (el token de su sesión, nunca la service role):
 * aplican las mismas políticas de storage.objects que en el servidor, así
 * que no se puede escribir fuera de la carpeta de la propia familia. La
 * ruta la arma siempre el servidor (`buildStoragePath`) y el archivo se
 * registra después con `attachDocumentFile`.
 *
 * Existe para no hacer pasar la imagen dos veces (celular → Vercel →
 * Storage) dentro de una Server Action que la persona tiene que esperar.
 * Va por XHR contra la misma API de Storage que usa supabase-js
 * (`POST /storage/v1/object/<bucket>/<ruta>`) porque supabase-js no
 * informa el progreso, y el formulario de documentos lo muestra. El
 * cliente de Supabase (solo para leer el token de la sesión) se carga con
 * `import()` recién al subir, como el realtime del modo supermercado: no
 * pesa en el JS inicial de los formularios.
 */
export async function uploadDocumentFileFromBrowser(
  path: string,
  file: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<{ error: string | null }> {
  const { createClient } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session) return { error: "Tu sesión venció. Volvé a entrar." };

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${DOCUMENTS_BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve({ error: null });
      } else {
        resolve({ error: `No se pudo subir el archivo (${xhr.status}).` });
      }
    };
    xhr.onerror = () => resolve({ error: "No se pudo subir el archivo (sin conexión)." });
    xhr.send(file);
  });
}
