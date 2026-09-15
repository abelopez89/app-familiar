import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/telegram";
import { daysOverdue, shouldGenerateInstance, shouldNotifyTaskInstance, shouldNotifyWarranty } from "@/lib/tasks/schedule";
import type { Asset, FamilyMember, TaskDefinition, TaskInstance } from "@/lib/supabase/types";

/**
 * Cron diario (07:00 America/Asuncion) de tareas del hogar, protegido
 * por Authorization: Bearer CRON_SECRET (lo llama cron-job.org). Service
 * role: no hay sesión, opera sobre todas las familias.
 *
 * Corre en orden: 1) genera las instancias que correspondan, 2) arma un
 * único mensaje de Telegram por destinatario con todo lo que tiene
 * pendiente de avisar (tareas + garantías próximas a vencer). Si no hay
 * nada para avisar, no manda nada — misma regla que el cron de eventos.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getCronSecret()}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayInFamilyTimezone();

  // ============ 1. Generar instancias ============
  const { data: activeDefinitions } = await supabase
    .from("task_definitions")
    .select("*")
    .eq("is_active", true);

  const { data: pendingForGeneration } = await supabase
    .from("task_instances")
    .select("definition_id")
    .eq("status", "pendiente");

  const pendingDefinitionIds = new Set((pendingForGeneration ?? []).map((i) => i.definition_id));

  let generadas = 0;
  for (const definition of activeDefinitions ?? []) {
    if (!shouldGenerateInstance(definition, pendingDefinitionIds.has(definition.id), today)) continue;

    const { error } = await supabase.from("task_instances").insert({
      definition_id: definition.id,
      family_id: definition.family_id,
      due_date: definition.next_due_date,
    });

    // 23505: choque contra unique(definition_id, due_date) — ya existía,
    // idempotente por construcción (mismo principio que reminder_deliveries).
    if (!error) generadas += 1;
    else if (error.code !== "23505") {
      console.error("[cron/tareas] error generando instancia:", error);
    }
  }

  // ============ 2. Avisar ============
  const [{ data: pendingInstances }, { data: allDefinitions }, { data: assets }, { data: members }] =
    await Promise.all([
      supabase.from("task_instances").select("*").eq("status", "pendiente"),
      supabase.from("task_definitions").select("*"),
      supabase.from("assets").select("*").eq("is_active", true),
      supabase.from("family_members").select("*").eq("is_active", true),
    ]);

  const definitionsById = new Map((allDefinitions ?? []).map((d) => [d.id, d]));
  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const membersByFamily = new Map<string, FamilyMember[]>();
  for (const member of members ?? []) {
    const list = membersByFamily.get(member.family_id) ?? [];
    list.push(member);
    membersByFamily.set(member.family_id, list);
  }

  const taskLinesByChatId = new Map<number, { text: string; overdueDays: number }[]>();
  const notifiedInstanceIds: string[] = [];

  for (const instance of (pendingInstances ?? []) as TaskInstance[]) {
    const definition = definitionsById.get(instance.definition_id) as TaskDefinition | undefined;
    if (!definition || !definition.notify_telegram) continue;
    if (!shouldNotifyTaskInstance(instance, definition.lead_days, today)) continue;

    const recipients = definition.assigned_to
      ? [membersById.get(definition.assigned_to)].filter((m): m is FamilyMember => !!m)
      : (membersByFamily.get(definition.family_id) ?? []);

    const overdue = daysOverdue(instance.due_date, today);
    const asset = definition.asset_id ? (assets ?? []).find((a) => a.id === definition.asset_id) : null;
    const label = asset ? `${definition.title} (${asset.name})` : definition.title;
    const text =
      overdue > 0
        ? `${escapeTelegramHtml(label)} — vencida hace ${overdue} día${overdue === 1 ? "" : "s"}`
        : `${escapeTelegramHtml(label)} — vence el ${formatDate(instance.due_date)}`;

    let notifiedSomeone = false;
    for (const member of recipients) {
      if (!member.telegram_user_id) continue;
      const list = taskLinesByChatId.get(member.telegram_user_id) ?? [];
      list.push({ text, overdueDays: overdue });
      taskLinesByChatId.set(member.telegram_user_id, list);
      notifiedSomeone = true;
    }

    if (notifiedSomeone) notifiedInstanceIds.push(instance.id);
  }

  const warrantyLinesByChatId = new Map<number, string[]>();
  const notifiedAssetIds: string[] = [];

  for (const asset of (assets ?? []) as Asset[]) {
    if (!shouldNotifyWarranty(asset, today)) continue;

    const recipients = membersByFamily.get(asset.family_id) ?? [];
    const text = `Garantía de ${escapeTelegramHtml(asset.name)} vence el ${formatDate(asset.warranty_until!)}`;

    let notifiedSomeone = false;
    for (const member of recipients) {
      if (!member.telegram_user_id) continue;
      const list = warrantyLinesByChatId.get(member.telegram_user_id) ?? [];
      list.push(text);
      warrantyLinesByChatId.set(member.telegram_user_id, list);
      notifiedSomeone = true;
    }

    if (notifiedSomeone) notifiedAssetIds.push(asset.id);
  }

  const recipientChatIds = new Set([...taskLinesByChatId.keys(), ...warrantyLinesByChatId.keys()]);

  let enviados = 0;
  let errores = 0;

  for (const chatId of recipientChatIds) {
    const taskLines = (taskLinesByChatId.get(chatId) ?? []).sort((a, b) => b.overdueDays - a.overdueDays);
    const warrantyLines = warrantyLinesByChatId.get(chatId) ?? [];

    const parts: string[] = [];
    if (taskLines.length > 0) {
      parts.push("<b>Tareas</b>");
      parts.push(...taskLines.map((line) => `• ${line.text}`));
    }
    if (warrantyLines.length > 0) {
      if (parts.length > 0) parts.push("");
      parts.push("<b>Garantías</b>");
      parts.push(...warrantyLines.map((line) => `• ${line}`));
    }

    let sent = false;
    try {
      sent = await sendTelegramMessage(chatId, parts.join("\n"));
    } catch (error) {
      console.error("[cron/tareas] error enviando a un destinatario:", error);
    }

    if (sent) enviados += 1;
    else errores += 1;
  }

  if (notifiedInstanceIds.length > 0) {
    await supabase
      .from("task_instances")
      .update({ notified_at: new Date().toISOString() })
      .in("id", notifiedInstanceIds);
  }

  if (notifiedAssetIds.length > 0) {
    await supabase
      .from("assets")
      .update({ warranty_notified_at: new Date().toISOString() })
      .in("id", notifiedAssetIds);
  }

  return NextResponse.json({ generadas, enviados, errores });
}
