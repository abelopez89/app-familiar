"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { buildStoragePath } from "@/lib/documents/storage";
import { leerInformeDePdf } from "@/lib/calificaciones/leer";
import { getReportByDocument } from "@/lib/calificaciones/queries";
import { MONTH_NAMES } from "@/lib/calificaciones/parse";

export type BorradorInforme = {
  memberId: string | null;
  year: number | null;
  month: number | null;
  grade: string | null;
  lateArrivals: number | null;
  absences: number | null;
  scores: { subject: string; points: number; maxPoints: number; observations: string | null }[];
  warnings: string[];
  /** true si viene de lo ya guardado (no se volvió a leer el PDF). */
  guardado: boolean;
};

/** Meses que ese hijo ya tiene cargados, para avisar si se reemplaza uno. */
export type MesCargado = { memberId: string; year: number; month: number; documentId: string | null };

/**
 * Paso 1 de la carga: crea el documento (tipo "calificaciones", del hijo,
 * en la primera categoría de Educación si hay) y devuelve la ruta donde el
 * navegador sube el PDF. Mismo orden que `createDocument` (Fase 5, regla 7);
 * el archivo se registra después con `attachDocumentFile`.
 */
export async function crearDocumentoInforme(
  memberId: string,
  fileName: string,
): Promise<{ error?: string; documentId?: string; path?: string }> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };
  if (!fileName.toLowerCase().endsWith(".pdf")) return { error: "Elegí el PDF del informe." };

  const supabase = await createClient();
  const [{ data: member }, { data: category }] = await Promise.all([
    supabase
      .from("family_members")
      .select("id, display_name")
      .eq("family_id", context.family.id)
      .eq("id", memberId)
      .maybeSingle(),
    supabase
      .from("document_categories")
      .select("id")
      .eq("family_id", context.family.id)
      .eq("kind", "educacion")
      .order("sort_order")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!member) return { error: "Elegí a quién es el informe." };

  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      family_id: context.family.id,
      member_id: member.id,
      category_id: category?.id ?? null,
      title: `Calificaciones ${member.display_name}`,
      doc_type: "calificaciones",
      uploaded_by: context.member.id,
    })
    .select("id")
    .single();
  if (error || !document) return { error: "No se pudo crear el documento." };

  return { documentId: document.id, path: buildStoragePath(context.family.id, document.id, fileName) };
}

/**
 * Paso 2: los puntajes para la vista previa. Si el documento ya tiene un
 * informe guardado, se edita lo guardado (con las correcciones que se le
 * hayan hecho); si no, se lee el PDF.
 */
export async function leerInforme(
  documentId: string,
): Promise<{ error?: string; borrador?: BorradorInforme; mesesCargados?: MesCargado[] }> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, member_id")
    .eq("family_id", context.family.id)
    .eq("id", documentId)
    .maybeSingle();
  if (!document) return { error: "Documento no encontrado." };

  const [saved, { data: files }, { data: cargados }] = await Promise.all([
    getReportByDocument(context.family.id, documentId),
    supabase
      .from("document_files")
      .select("storage_path, mime_type")
      .eq("family_id", context.family.id)
      .eq("document_id", documentId)
      .order("sort_order"),
    supabase
      .from("school_reports")
      .select("member_id, year, month, document_id")
      .eq("family_id", context.family.id),
  ]);
  const mesesCargados = (cargados ?? []).map((r) => ({
    memberId: r.member_id,
    year: r.year,
    month: r.month,
    documentId: r.document_id,
  }));

  if (saved) {
    return {
      mesesCargados,
      borrador: {
        memberId: saved.member_id,
        year: saved.year,
        month: saved.month,
        grade: saved.grade,
        lateArrivals: saved.late_arrivals,
        absences: saved.absences,
        scores: saved.scores.map((s) => ({
          subject: s.subject,
          points: Number(s.points),
          maxPoints: Number(s.max_points),
          observations: s.observations,
        })),
        warnings: [],
        guardado: true,
      },
    };
  }

  const pdf = (files ?? []).find((f) => f.mime_type === "application/pdf" || f.storage_path.endsWith(".pdf"));
  if (!pdf) return { error: "El documento no tiene un PDF." };

  const leido = await leerInformeDePdf(pdf.storage_path);
  if ("error" in leido) return { error: leido.error };

  return {
    mesesCargados,
    borrador: {
      memberId: document.member_id,
      year: leido.year,
      month: leido.month,
      grade: leido.grade,
      lateArrivals: leido.lateArrivals,
      absences: leido.absences,
      scores: leido.scores,
      warnings: leido.warnings,
      guardado: false,
    },
  };
}

const puntaje = z.number({ error: "Revisá los puntajes." }).min(0, "Los puntos no pueden ser negativos.");

const informeSchema = z
  .object({
    documentId: z.string().uuid(),
    memberId: z.string().uuid({ error: "Elegí a quién es el informe." }),
    year: z.number().int().min(2000, "Revisá el año.").max(2100, "Revisá el año."),
    month: z.number().int().min(1, "Elegí el mes.").max(12, "Elegí el mes."),
    grade: z.string().trim().max(60).nullable(),
    lateArrivals: z.number().int().min(0).nullable(),
    absences: z.number().int().min(0).nullable(),
    scores: z
      .array(
        z.object({
          subject: z.string().trim().min(1, "Cada materia necesita un nombre.").max(80),
          points: puntaje,
          maxPoints: puntaje.positive("El máximo tiene que ser mayor a cero."),
          observations: z.string().trim().max(1000).nullable(),
        }),
      )
      .min(1, "Agregá al menos una materia."),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const s of v.scores) {
      if (s.points > s.maxPoints) ctx.addIssue({ code: "custom", message: `${s.subject}: los puntos superan el máximo.` });
      const key = s.subject.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: `${s.subject} está dos veces.` });
      seen.add(key);
    }
  });

export type InformeInput = z.input<typeof informeSchema>;

/**
 * Guarda el informe: un registro por hijo y mes (si ese mes ya estaba, se
 * reemplazan sus puntajes y pasa a apuntar a este documento). Sin
 * transacción, en orden seguro: informe → borrar puntajes viejos → insertar
 * los nuevos. Si falla el último paso, el informe queda sin puntajes y la
 * vista previa sigue en pantalla para reintentar.
 */
export async function guardarInforme(input: InformeInput): Promise<{ error?: string }> {
  const parsed = informeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const v = parsed.data;

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };
  const familyId = context.family.id;

  const supabase = await createClient();
  const [{ data: document }, { data: member }] = await Promise.all([
    supabase.from("documents").select("id").eq("family_id", familyId).eq("id", v.documentId).maybeSingle(),
    supabase.from("family_members").select("id").eq("family_id", familyId).eq("id", v.memberId).maybeSingle(),
  ]);
  if (!document) return { error: "Documento no encontrado." };
  if (!member) return { error: "Elegí a quién es el informe." };

  // Si este documento ya estaba guardado con otro mes u otro hijo (se
  // corrigió en la vista previa), ese registro se va: el documento es un
  // solo informe.
  const { data: previos } = await supabase
    .from("school_reports")
    .select("id, member_id, year, month")
    .eq("family_id", familyId)
    .eq("document_id", v.documentId);
  const viejos = (previos ?? []).filter((r) => r.member_id !== v.memberId || r.year !== v.year || r.month !== v.month);
  if (viejos.length > 0) {
    await supabase
      .from("school_reports")
      .delete()
      .eq("family_id", familyId)
      .in(
        "id",
        viejos.map((r) => r.id),
      );
  }

  const { data: report, error: reportError } = await supabase
    .from("school_reports")
    .upsert(
      {
        family_id: familyId,
        member_id: v.memberId,
        document_id: v.documentId,
        year: v.year,
        month: v.month,
        grade: v.grade || null,
        late_arrivals: v.lateArrivals,
        absences: v.absences,
        created_by: context.member.id,
      },
      { onConflict: "member_id,year,month" },
    )
    .select("id")
    .single();
  if (reportError || !report) return { error: "No se pudo guardar el informe." };

  const { error: deleteError } = await supabase
    .from("school_report_scores")
    .delete()
    .eq("family_id", familyId)
    .eq("report_id", report.id);
  if (deleteError) return { error: "No se pudieron reemplazar los puntajes." };

  const { error: scoresError } = await supabase.from("school_report_scores").insert(
    v.scores.map((s, i) => ({
      family_id: familyId,
      report_id: report.id,
      subject: s.subject,
      sort_order: i,
      points: s.points,
      max_points: s.maxPoints,
      observations: s.observations || null,
    })),
  );
  if (scoresError) return { error: "No se pudieron guardar los puntajes. Probá de nuevo." };

  await supabase
    .from("documents")
    .update({ title: `Calificaciones ${MONTH_NAMES[v.month - 1]} ${v.year}` })
    .eq("family_id", familyId)
    .eq("id", v.documentId);

  // Sin revalidatePath (ver "Latencia percibida"): el formulario navega al
  // documento y refresca la caché del router.
  return {};
}
