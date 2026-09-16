"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { buildStoragePath, getSignedDocumentUrl, removeDocumentFiles, uploadDocumentFile } from "@/lib/documents/storage";

export type ActionResult = { error?: string; success?: boolean; id?: string };

const metadataSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio."),
  category_id: z.string().trim().optional(),
  member_id: z.string().trim().optional(),
  doc_type: z.string().trim().optional(),
  issued_at: z.string().trim().optional(),
  expires_at: z.string().trim().optional(),
  expiry_lead_days: z.coerce.number().int().min(0).optional(),
  tags: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function parseMetadataForm(formData: FormData) {
  const parsed = metadataSchema.safeParse({
    title: formData.get("title"),
    category_id: formData.get("category_id") ?? "",
    member_id: formData.get("member_id") ?? "",
    doc_type: formData.get("doc_type") ?? "",
    issued_at: formData.get("issued_at") ?? "",
    expires_at: formData.get("expires_at") ?? "",
    expiry_lead_days: formData.get("expiry_lead_days") || undefined,
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }
  return { data: parsed.data } as const;
}

function parseTags(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const tags = [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))];
  return tags.length > 0 ? tags : null;
}

/**
 * Sube y registra un documento nuevo con sus archivos. Orden de
 * operaciones (ver CLAUDE.md, Fase 5): primero se crea la fila de
 * `documents` (sin archivos) para tener un document_id con el que armar
 * la ruta de Storage, después se sube cada archivo, y recién ahí se
 * inserta su fila en `document_files`. Si ese insert falla, se intenta
 * borrar el archivo ya subido — el peor caso es un archivo huérfano
 * invisible, no una fila apuntando a un archivo inexistente.
 */
export async function createDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseMetadataForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  const supabase = await createClient();
  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      family_id: context.family.id,
      category_id: parsed.data.category_id || null,
      member_id: parsed.data.member_id || null,
      title: parsed.data.title,
      doc_type: parsed.data.doc_type || null,
      issued_at: parsed.data.issued_at || null,
      expires_at: parsed.data.expires_at || null,
      expiry_lead_days: parsed.data.expiry_lead_days ?? 60,
      tags: parseTags(parsed.data.tags),
      notes: parsed.data.notes || null,
      uploaded_by: context.member.id,
    })
    .select("id")
    .single();

  if (insertError || !document) return { error: "No se pudo crear el documento." };

  let sortOrder = 0;
  for (const file of files) {
    const path = buildStoragePath(context.family.id, document.id, file.name);
    const { error: uploadError } = await uploadDocumentFile(path, file);
    if (uploadError) continue;

    const { error: fileInsertError } = await supabase.from("document_files").insert({
      document_id: document.id,
      family_id: context.family.id,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      sort_order: sortOrder++,
    });

    if (fileInsertError) {
      await removeDocumentFiles([path]);
    }
  }

  revalidatePath("/documentos");
  return { success: true, id: document.id };
}

export async function updateDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Documento inválido." };

  const parsed = parseMetadataForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({
      category_id: parsed.data.category_id || null,
      member_id: parsed.data.member_id || null,
      title: parsed.data.title,
      doc_type: parsed.data.doc_type || null,
      issued_at: parsed.data.issued_at || null,
      expires_at: parsed.data.expires_at || null,
      expiry_lead_days: parsed.data.expiry_lead_days ?? 60,
      tags: parseTags(parsed.data.tags),
      notes: parsed.data.notes || null,
      // Si se cambia la fecha de vencimiento, el aviso ya enviado deja de
      // aplicar a la fecha nueva.
      expiry_notified_at: null,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el documento." };

  revalidatePath("/documentos");
  revalidatePath(`/documentos/${id}`);
  return { success: true, id };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: files } = await supabase.from("document_files").select("storage_path").eq("document_id", id);

  await removeDocumentFiles((files ?? []).map((f) => f.storage_path));

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el documento." };

  revalidatePath("/documentos");
  return { success: true };
}

export async function toggleDocumentPinned(id: string, pinned: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ is_pinned: pinned }).eq("id", id);
  if (error) return { error: "No se pudo actualizar el documento." };

  revalidatePath("/documentos");
  revalidatePath(`/documentos/${id}`);
  return { success: true };
}

export async function addDocumentFiles(documentId: string, files: File[]): Promise<ActionResult> {
  const validFiles = files.filter((f) => f.size > 0);
  if (validFiles.length === 0) return { error: "No se recibió ningún archivo." };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("document_files")
    .select("sort_order")
    .eq("document_id", documentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sortOrder = (existing?.sort_order ?? -1) + 1;

  for (const file of validFiles) {
    const path = buildStoragePath(context.family.id, documentId, file.name);
    const { error: uploadError } = await uploadDocumentFile(path, file);
    if (uploadError) continue;

    const { error: fileInsertError } = await supabase.from("document_files").insert({
      document_id: documentId,
      family_id: context.family.id,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      sort_order: sortOrder++,
    });

    if (fileInsertError) {
      await removeDocumentFiles([path]);
    }
  }

  revalidatePath(`/documentos/${documentId}`);
  return { success: true };
}

export async function removeDocumentFile(fileId: string, documentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: file } = await supabase.from("document_files").select("storage_path").eq("id", fileId).maybeSingle();

  if (file) await removeDocumentFiles([file.storage_path]);

  const { error } = await supabase.from("document_files").delete().eq("id", fileId);
  if (error) return { error: "No se pudo quitar la página." };

  revalidatePath(`/documentos/${documentId}`);
  return { success: true };
}

export async function getDocumentFileUrl(storagePath: string): Promise<string | null> {
  return getSignedDocumentUrl(storagePath);
}
