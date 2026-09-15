import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { expandOccurrences } from "@/lib/recurrence";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/telegram";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Event, FamilyMember } from "@/lib/supabase/types";

const WINDOW_FORWARD_HOURS = 72;
const WINDOW_BACK_HOURS = 3;

/**
 * Cron horario de recordatorios de Telegram, protegido por
 * Authorization: Bearer CRON_SECRET (lo llama cron-job.org). Service
 * role: no hay sesión.
 *
 * Si no hay nada para enviar, no manda ningún mensaje — nada de resumen
 * diario ni "no tenés eventos hoy". El bot solo habla cuando hay algo
 * concreto que avisar.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getCronSecret()}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: reminders } = await supabase
    .from("event_reminders")
    .select("*")
    .eq("channel", "telegram");

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ enviados: 0 });
  }

  const eventIds = [...new Set(reminders.map((r) => r.event_id))];

  const [{ data: events }, { data: members }, { data: eventParticipants }] = await Promise.all([
    supabase.from("events").select("*").in("id", eventIds),
    supabase.from("family_members").select("*").eq("is_active", true),
    supabase.from("event_participants").select("*").in("event_id", eventIds),
  ]);

  const eventsById = new Map((events ?? []).map((e) => [e.id, e]));
  const membersById = new Map((members ?? []).map((m) => [m.id, m]));

  const membersByFamily = new Map<string, FamilyMember[]>();
  for (const m of members ?? []) {
    const list = membersByFamily.get(m.family_id) ?? [];
    list.push(m);
    membersByFamily.set(m.family_id, list);
  }

  const participantNamesByEvent = new Map<string, string[]>();
  for (const p of eventParticipants ?? []) {
    const member = membersById.get(p.member_id);
    if (!member) continue;
    const list = participantNamesByEvent.get(p.event_id) ?? [];
    list.push(member.display_name);
    participantNamesByEvent.set(p.event_id, list);
  }

  const windowFrom = new Date(now.getTime() - WINDOW_BACK_HOURS * 3_600_000);
  const windowTo = new Date(now.getTime() + WINDOW_FORWARD_HOURS * 3_600_000);
  const avisoCutoff = now.getTime() - WINDOW_BACK_HOURS * 3_600_000;

  let enviados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const reminder of reminders) {
    const event = eventsById.get(reminder.event_id);
    if (!event) continue;

    const occurrences = expandOccurrences(event, windowFrom, windowTo);

    for (const occ of occurrences) {
      const momentoAviso = occ.starts_at.getTime() - reminder.offset_minutes * 60_000;
      if (!(momentoAviso <= now.getTime() && momentoAviso > avisoCutoff)) continue;

      const recipients = reminder.target_member
        ? [membersById.get(reminder.target_member)].filter((m): m is FamilyMember => !!m)
        : (membersByFamily.get(reminder.family_id) ?? []);

      for (const member of recipients) {
        if (!member.telegram_user_id) {
          omitidos += 1;
          continue;
        }

        // Insertar primero, enviar después: si esto choca contra la
        // primary key, ya se mandó este recordatorio para esta
        // ocurrencia y este destinatario — no reintentar.
        const { error: insertError } = await supabase.from("reminder_deliveries").insert({
          reminder_id: reminder.id,
          occurrence_starts_at: occ.starts_at.toISOString(),
          member_id: member.id,
        });

        if (insertError) {
          if (insertError.code !== "23505") errores += 1;
          continue;
        }

        const text = buildReminderMessage(
          event,
          occ.starts_at,
          participantNamesByEvent.get(event.id) ?? [],
        );

        let sent = false;
        try {
          sent = await sendTelegramMessage(member.telegram_user_id, text);
        } catch (error) {
          console.error("[cron/recordatorios] error enviando a un destinatario:", error);
        }

        if (sent) {
          enviados += 1;
        } else {
          errores += 1;
          // Si Telegram falló, borrar la fila para que se reintente en
          // la corrida siguiente.
          await supabase
            .from("reminder_deliveries")
            .delete()
            .eq("reminder_id", reminder.id)
            .eq("occurrence_starts_at", occ.starts_at.toISOString())
            .eq("member_id", member.id);
        }
      }
    }
  }

  return NextResponse.json({ enviados, omitidos, errores });
}

function buildReminderMessage(
  event: Event,
  occurrenceStart: Date,
  participantNames: string[],
): string {
  const lines = [`<b>${escapeTelegramHtml(event.title)}</b>`];
  lines.push(event.all_day ? formatDate(occurrenceStart) : formatDateTime(occurrenceStart));

  if (participantNames.length > 0) {
    lines.push(escapeTelegramHtml(participantNames.join(", ")));
  }
  if (event.location) {
    lines.push(`📍 ${escapeTelegramHtml(event.location)}`);
  }

  return lines.join("\n");
}
