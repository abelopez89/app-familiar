import type { InlineKeyboardButton, InlineKeyboardMarkup } from "@/lib/telegram/client";

// Constructores de inline keyboards.
//
// `callback_data` tiene un límite DURO de 64 bytes. Un UUID son 36: entra
// uno con un prefijo corto ("lt:" + uuid = 39), dos no entran nunca. Por
// eso todo payload es `acción:identificador` con UN solo identificador;
// el contexto que haga falta además (grupo elegido, monto, etc.) vive en
// la sesión (`telegram_sessions.context`), no en el botón.

const CALLBACK_DATA_MAX_BYTES = 64;

export function button(text: string, data: string): InlineKeyboardButton {
  if (Buffer.byteLength(data, "utf8") > CALLBACK_DATA_MAX_BYTES) {
    // Un error acá es de programación, no de datos: mejor que reviente en
    // el primer intento que un botón que Telegram rechaza en silencio.
    throw new Error(`callback_data excede 64 bytes: ${data}`);
  }
  return { text, callback_data: data };
}

export function keyboard(rows: (InlineKeyboardButton | null | undefined)[][]): InlineKeyboardMarkup {
  return {
    inline_keyboard: rows
      .map((row) => row.filter((b): b is InlineKeyboardButton => !!b))
      .filter((row) => row.length > 0),
  };
}

/** Parte una lista de botones en filas de `perRow`. */
export function chunk(buttons: InlineKeyboardButton[], perRow: number): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += perRow) rows.push(buttons.slice(i, i + perRow));
  return rows;
}

/** Botón que no hace nada (un rótulo). El router lo responde y no toca nada. */
export const NOOP = "nop";

export const CANCEL_BUTTON = button("✖️ Cancelar", "x");

/**
 * Tachado para el texto de un botón. Los botones no admiten HTML, así que
 * se usa el carácter combinable U+0336 sobre cada letra.
 */
export function strike(text: string): string {
  return Array.from(text)
    .map((ch) => (ch === " " ? ch : `${ch}̶`))
    .join("");
}

/** Texto de botón acotado: Telegram corta a lo ancho de la pantalla igual. */
export function shortLabel(text: string, max = 32): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
