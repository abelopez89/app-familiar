import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SchoolReport, SchoolReportScore } from "@/lib/supabase/types";

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
