/**
 * Escapado para `parse_mode: "HTML"` de Telegram. Separado de `client.ts`
 * (que lee el token del entorno al importarse) para poder usarlo en código
 * puro y en los tests; `client.ts` lo reexporta.
 */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
