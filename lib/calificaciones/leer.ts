import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { parseSchoolReport, type ParsedReport } from "@/lib/calificaciones/parse";

/**
 * Baja el PDF de un documento con el cliente de sesión (las políticas de
 * storage.objects solo dejan leer archivos de la propia familia, regla 2
 * de la Fase 5) y lee sus puntajes. Sin Claude: el informe del colegio
 * trae texto real y `parseSchoolReport` lo resuelve con reglas.
 */
export async function leerInformeDePdf(storagePath: string): Promise<ParsedReport | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(storagePath);
  if (error || !data) return { error: "No se pudo bajar el PDF." };

  try {
    const pdf = await getDocumentProxy(new Uint8Array(await data.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text.trim()) return { error: "El PDF no tiene texto (¿es una foto escaneada?)." };
    return parseSchoolReport(text);
  } catch {
    return { error: "No se pudo leer el PDF." };
  }
}
