import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SchoolReport, SchoolReportScore } from "@/lib/supabase/types";
import type { InformeResumen } from "@/lib/calificaciones/resumen";

export type ReportWithScores = SchoolReport & { scores: SchoolReportScore[] };

/** El informe guardado a partir de un documento, con sus puntajes. */
export async function getReportByDocument(familyId: string, documentId: string): Promise<ReportWithScores | null> {
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("school_reports")
    .select("*")
    .eq("family_id", familyId)
    .eq("document_id", documentId)
    .maybeSingle();
  if (!report) return null;
  const { data: scores } = await supabase
    .from("school_report_scores")
    .select("*")
    .eq("family_id", familyId)
    .eq("report_id", report.id)
    .order("sort_order");
  return { ...report, scores: scores ?? [] };
}

/**
 * Todos los informes de la familia con sus puntajes, para el resumen. Son
 * pocos (uno por hijo y mes), así que alcanza con dos consultas y armar
 * el árbol en memoria. Paginado como los gastos (CLAUDE.md, Fase 6 regla
 * 14): varios hijos y años pasan las 1000 filas de puntajes de PostgREST.
 */
export async function listReports(familyId: string): Promise<InformeConMiembro[]> {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("school_reports")
    .select("*")
    .eq("family_id", familyId)
    .order("year")
    .order("month");
  if (!reports || reports.length === 0) return [];

  const scores: SchoolReportScore[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("school_report_scores")
      .select("*")
      .eq("family_id", familyId)
      .order("id")
      .range(from, from + PAGE - 1);
    scores.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const byReport = new Map<string, SchoolReportScore[]>();
  for (const s of scores) byReport.set(s.report_id, [...(byReport.get(s.report_id) ?? []), s]);

  return reports.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    documentId: r.document_id,
    year: r.year,
    month: r.month,
    grade: r.grade,
    lateArrivals: r.late_arrivals,
    absences: r.absences,
    scores: (byReport.get(r.id) ?? []).map((s) => ({
      subject: s.subject,
      sortOrder: s.sort_order,
      points: Number(s.points),
      maxPoints: Number(s.max_points),
      observations: s.observations,
    })),
  }));
}

export type InformeConMiembro = InformeResumen & { memberId: string; grade: string | null };
