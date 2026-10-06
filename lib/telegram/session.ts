import "server-only";
import type { Db } from "@/lib/services/types";

// Estado del diálogo entre mensajes. El webhook es stateless: cada update
// llega a una invocación nueva de la función, así que "estoy esperando el
// monto del gasto" tiene que vivir en una tabla (`telegram_sessions`,
// migración 012), una fila por usuario de Telegram.

/**
 * Un diálogo vive 10 minutos desde la última interacción. Uno abandonado
 * ayer no puede interpretar un mensaje suelto de hoy como "el monto del
 * gasto": pasado este tiempo, el estado se descarta al leerlo.
 */
export const SESSION_TTL_MS = 10 * 60 * 1000;

export type BotSession = {
  telegramUserId: number;
  memberId: string;
  familyId: string;
  /** Paso del diálogo en curso ("gasto:monto", "nafta:litros"…), o null. */
  state: string | null;
  context: Record<string, unknown>;
  /** Último mensaje "vivo" del bot (el que se edita en vez de mandar otro). */
  chatId: number | null;
  lastMessageId: number | null;
};

/**
 * Lee la sesión del usuario. `member` sale SIEMPRE de
 * `family_members.telegram_user_id`, resuelto en este mismo update: la
 * vinculación manda, la sesión es solo un caché del diálogo. Si la fila
 * es de otro miembro o de otra familia (se desvinculó y se volvió a
 * vincular), o si venció, el diálogo se descarta.
 */
export async function loadSession(
  db: Db,
  telegramUserId: number,
  member: { id: string; family_id: string },
): Promise<BotSession> {
  const { data } = await db
    .from("telegram_sessions")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  const fresh: BotSession = {
    telegramUserId,
    memberId: member.id,
    familyId: member.family_id,
    state: null,
    context: {},
    chatId: null,
    lastMessageId: null,
  };

  if (!data || data.member_id !== member.id || data.family_id !== member.family_id) return fresh;

  const expired = !data.expires_at || new Date(data.expires_at).getTime() <= Date.now();
  return {
    ...fresh,
    // El diálogo vence; el mensaje vivo no (los botones de la lista de
    // compras siguen sirviendo aunque la sesión haya expirado).
    state: expired ? null : data.state,
    context: expired ? {} : (data.context ?? {}),
    chatId: data.chat_id,
    lastMessageId: data.last_message_id,
  };
}

export async function saveSession(db: Db, session: BotSession): Promise<void> {
  const { error } = await db.from("telegram_sessions").upsert({
    telegram_user_id: session.telegramUserId,
    member_id: session.memberId,
    family_id: session.familyId,
    state: session.state,
    context: session.context,
    chat_id: session.chatId,
    last_message_id: session.lastMessageId,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  if (error) console.error("[telegram] no se pudo guardar la sesión:", error);
}

export function setDialog(session: BotSession, state: string, context: Record<string, unknown>): void {
  session.state = state;
  session.context = context;
}

export function clearDialog(session: BotSession): void {
  session.state = null;
  session.context = {};
}

/**
 * "Tomar" el paso de confirmación de forma atómica: limpia el estado solo
 * si sigue siendo `expectedState` y no venció, y devuelve el contexto que
 * tenía. Dos toques seguidos de "Guardar" son dos updates distintos (la
 * deduplicación por `update_id` no los frena): el segundo encuentra el
 * estado ya limpio y no guarda nada. Sin esto, un doble toque con mala
 * señal crea dos gastos.
 */
export async function claimDialog(
  db: Db,
  session: BotSession,
  expectedState: string,
): Promise<Record<string, unknown> | null> {
  // Solo se limpia `state`: RETURNING devuelve la fila ya actualizada, así
  // que si acá se vaciara también `context` se perdería el borrador. El
  // contexto se vacía después, al guardar la sesión al final del update.
  const { data } = await db
    .from("telegram_sessions")
    .update({ state: null })
    .eq("telegram_user_id", session.telegramUserId)
    .eq("member_id", session.memberId)
    .eq("state", expectedState)
    .gt("expires_at", new Date().toISOString())
    .select("context")
    .maybeSingle();
  if (!data) return null;
  clearDialog(session);
  return data.context ?? {};
}
