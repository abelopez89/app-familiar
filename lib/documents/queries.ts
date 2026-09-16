import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DocumentCategory, DocumentFile, FamilyDocument } from "@/lib/supabase/types";
import { isDocumentExpiryDue } from "@/lib/documents/schedule";
import { todayInFamilyTimezone } from "@/lib/dates";

export type DocumentWithFiles = FamilyDocument & { files: DocumentFile[] };

export async function listDocumentCategories(): Promise<DocumentCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getDocumentCategory(id: string): Promise<DocumentCategory | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("document_categories").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/**
 * Todos los documentos de la familia (RLS filtra) con sus archivos ya
 * resueltos, sin N+1 — la usan /documentos, la ficha de un miembro y el
 * bloque de vencimientos del dashboard.
 */
export async function listDocumentsWithFiles(): Promise<DocumentWithFiles[]> {
  const supabase = await createClient();

  const [documentsRes, filesRes] = await Promise.all([
    supabase.from("documents").select("*").order("created_at", { ascending: false }),
    supabase.from("document_files").select("*").order("sort_order", { ascending: true }),
  ]);

  if (documentsRes.error) throw documentsRes.error;

  const filesByDocument = new Map<string, DocumentFile[]>();
  for (const file of filesRes.data ?? []) {
    const list = filesByDocument.get(file.document_id) ?? [];
    list.push(file);
    filesByDocument.set(file.document_id, list);
  }

  return (documentsRes.data ?? []).map((doc) => ({
    ...doc,
    files: filesByDocument.get(doc.id) ?? [],
  }));
}

export async function getDocumentWithFiles(id: string): Promise<DocumentWithFiles | null> {
  const supabase = await createClient();
  const [documentRes, filesRes] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).maybeSingle(),
    supabase.from("document_files").select("*").eq("document_id", id).order("sort_order", { ascending: true }),
  ]);

  if (!documentRes.data) return null;
  return { ...documentRes.data, files: filesRes.data ?? [] };
}

export async function listDocumentsByMember(memberId: string): Promise<DocumentWithFiles[]> {
  const all = await listDocumentsWithFiles();
  return all.filter((d) => d.member_id === memberId);
}

/**
 * Documentos cuyo vencimiento entra en la ventana de aviso (hoy está a
 * `expiry_lead_days` días o menos de `expires_at`, o ya venció) — los que
 * corresponde mostrar en el bloque de alertas del dashboard "Hoy".
 */
export async function listExpiringDocuments(): Promise<FamilyDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: true });

  const today = todayInFamilyTimezone();
  return (data ?? []).filter((doc) => isDocumentExpiryDue(doc, today));
}

/**
 * Suma de size_bytes de todos los archivos de la familia, para mostrar el
 * espacio usado en /config/documentos contra el límite de 1 GB del tier
 * gratuito de Supabase.
 */
export async function getStorageUsageBytes(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("document_files").select("size_bytes");
  return (data ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
}
