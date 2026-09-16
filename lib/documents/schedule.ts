import { addDaysToDateOnly, dateOnlyInFamilyTimezone } from "@/lib/dates";

// Mismo patrón de idempotencia que warranty_notified_at en assets y
// notified_at en task_instances (ver lib/tasks/schedule.ts), pero
// implementado acá de forma independiente: este módulo no importa de
// lib/tasks/schedule.ts a propósito (ver CLAUDE.md, "qué no hacer" de la
// Fase 5) — son dos dominios que solo comparten la forma del problema.
const RENOTIFY_AFTER_DAYS = 7;

export function isDocumentExpiryDue(
  doc: { expires_at: string | null; expiry_lead_days: number },
  today: string,
): boolean {
  if (!doc.expires_at) return false;
  const notifyFrom = addDaysToDateOnly(doc.expires_at, -doc.expiry_lead_days);
  return today >= notifyFrom;
}

export function shouldNotifyDocumentExpiry(
  doc: { expires_at: string | null; expiry_lead_days: number; expiry_notified_at: string | null },
  today: string,
): boolean {
  if (!isDocumentExpiryDue(doc, today)) return false;
  if (!doc.expiry_notified_at) return true;
  const notifiedDateOnly = dateOnlyInFamilyTimezone(doc.expiry_notified_at);
  return today >= addDaysToDateOnly(notifiedDateOnly, RENOTIFY_AFTER_DAYS);
}
