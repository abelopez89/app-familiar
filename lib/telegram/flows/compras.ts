import "server-only";
import { escapeTelegramHtml, type InlineKeyboardButton } from "@/lib/telegram/client";
import { button, CANCEL_BUTTON, keyboard, shortLabel, strike } from "@/lib/telegram/keyboards";
import { clearDialog, setDialog } from "@/lib/telegram/session";
import { sendLive, settleLiveMessage, show, type BotContext } from "@/lib/telegram/context";
import { formatQuantity } from "@/lib/format";
import {
  addLooseItem,
  createList,
  getItem,
  getList,
  getOpenList,
  listItems,
  listProductCategories,
  listTemplateItemIds,
  listTemplates,
  markListInProgress,
  productCategoryGuesser,
  setItemChecked,
} from "@/lib/services/compras";
import type { ProductCategory, ShoppingList, ShoppingListItem } from "@/lib/supabase/types";

// Lista de compras por Telegram (`/compra`).
//
// Un solo mensaje que se edita: cada toque marca o desmarca un producto y
// el mensaje se vuelve a dibujar en el lugar, sin confirmación (mismo
// criterio que el modo supermercado). Con treinta productos no entran
// todos los botones en un mensaje usable, así que se pagina por categoría,
// en el orden del recorrido del súper (`sort_order` de la categoría).
//
// Callbacks (siempre UN identificador — límite de 64 bytes):
//   lt:<itemId>          marcar / desmarcar
//   lp:<listId>:<página> ir a una categoría
//   lc:<listId>          índice de categorías
//   la:<listId>          agregar productos (pide texto)
//   ln                   crear lista vacía
//   lm:<templateId>      crear lista desde una plantilla
//
// Los botones de la lista no dependen de la sesión: un mensaje de lista
// de hace una hora sigue funcionando aunque el diálogo haya vencido. Solo
// "agregar" (que espera un texto) usa estado.

const SIN_CATEGORIA = "__sin_categoria__";
const MAX_LINES_PER_MESSAGE = 30;

type Page = { key: string; label: string; items: ShoppingListItem[] };

/** Misma agrupación que el modo supermercado (`supermercado-view.tsx`). */
function buildPages(items: ShoppingListItem[], categories: ProductCategory[]): Page[] {
  const order = new Map(categories.map((c, index) => [c.id, index]));
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    const key = item.category_id ?? SIN_CATEGORIA;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(item);
  }
  for (const group of byCategory.values()) {
    group.sort((a, b) => (a.is_checked !== b.is_checked ? (a.is_checked ? 1 : -1) : a.sort_order - b.sort_order));
  }
  return Array.from(byCategory.entries())
    .sort(([a], [b]) => {
      if (a === SIN_CATEGORIA) return 1;
      if (b === SIN_CATEGORIA) return -1;
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    })
    .map(([key, group]) => ({
      key,
      label: key === SIN_CATEGORIA ? "Sin categoría" : (names.get(key) ?? group[0].category_name ?? "Sin categoría"),
      items: group,
    }));
}

function itemLabel(item: ShoppingListItem): string {
  const showQuantity = !(item.quantity === 1 && item.unit === "un");
  const name = shortLabel(item.name, 28);
  if (item.is_checked) return `✅ ${strike(name)}`;
  return showQuantity ? `⬜ ${name} · ${formatQuantity(item.quantity, item.unit)}` : `⬜ ${name}`;
}

function listTitle(list: ShoppingList): string {
  return `🛒 <b>${escapeTelegramHtml(list.name ?? "Lista de compras")}</b>`;
}

function renderList(list: ShoppingList, items: ShoppingListItem[], categories: ProductCategory[], requestedPage: number) {
  const pages = buildPages(items, categories);
  const checked = items.filter((i) => i.is_checked).length;

  if (pages.length === 0) {
    return {
      text: `${listTitle(list)}\n\nLa lista está vacía. Tocá <b>Agregar</b> para sumar productos.`,
      markup: keyboard([[button("➕ Agregar", `la:${list.id}`)]]),
    };
  }

  const index = Math.min(Math.max(requestedPage, 0), pages.length - 1);
  const page = pages[index];
  const pageChecked = page.items.filter((i) => i.is_checked).length;

  const text =
    `${listTitle(list)}\n` +
    `${checked} de ${items.length} · <b>${escapeTelegramHtml(page.label)}</b> (${pageChecked}/${page.items.length})` +
    (checked === items.length ? "\n\n🎉 ¡Está todo! Cerrá la compra desde la app para cargar el total." : "");

  const rows: (InlineKeyboardButton | null)[][] = page.items.map((item) => [button(itemLabel(item), `lt:${item.id}`)]);

  if (pages.length > 1) {
    const prev = index > 0 ? pages[index - 1] : null;
    const next = index < pages.length - 1 ? pages[index + 1] : null;
    rows.push([
      prev ? button(`◀ ${shortLabel(prev.label, 14)}`, `lp:${list.id}:${index - 1}`) : null,
      button(`📋 ${index + 1}/${pages.length}`, `lc:${list.id}`),
      next ? button(`${shortLabel(next.label, 14)} ▶`, `lp:${list.id}:${index + 1}`) : null,
    ]);
  }
  rows.push([button("➕ Agregar", `la:${list.id}`), button("🔄", `lp:${list.id}:${index}`)]);

  return { text, markup: keyboard(rows) };
}

async function loadListView(ctx: BotContext, listId: string) {
  const [list, items, categories] = await Promise.all([
    getList(ctx.db, ctx.actor.familyId, listId),
    listItems(ctx.db, ctx.actor.familyId, listId),
    listProductCategories(ctx.db, ctx.actor.familyId),
  ]);
  return { list, items, categories };
}

/** Página donde está ese producto (o la primera con algo pendiente). */
function pageIndexFor(items: ShoppingListItem[], categories: ProductCategory[], itemId?: string): number {
  const pages = buildPages(items, categories);
  if (itemId) {
    const found = pages.findIndex((p) => p.items.some((i) => i.id === itemId));
    if (found >= 0) return found;
  }
  const firstPending = pages.findIndex((p) => p.items.some((i) => !i.is_checked));
  return firstPending >= 0 ? firstPending : 0;
}

async function showList(ctx: BotContext, listId: string, page: number | { itemId?: string }, mode: "show" | "send" = "show") {
  const { list, items, categories } = await loadListView(ctx, listId);
  if (!list) {
    await show(ctx, "No encontré esa lista.");
    return;
  }
  if (list.status === "cerrada") {
    await show(ctx, `${listTitle(list)}\n\nEsta compra ya se cerró. Con /compra ves la lista abierta.`);
    return;
  }
  const index = typeof page === "number" ? page : pageIndexFor(items, categories, page.itemId);
  const { text, markup } = renderList(list, items, categories, index);
  if (mode === "send") await sendLive(ctx, text, markup);
  else await show(ctx, text, markup);
}

export async function startCompras(ctx: BotContext): Promise<void> {
  const open = await getOpenList(ctx.db, ctx.actor.familyId);
  if (open) {
    await showList(ctx, open.id, {});
    return;
  }

  const templates = await listTemplates(ctx.db, ctx.actor.familyId);
  await show(
    ctx,
    "No hay ninguna lista de compras abierta. ¿Armamos una?",
    keyboard([
      ...templates.slice(0, 8).map((t) => [button(`📋 ${shortLabel(t.name)}`, `lm:${t.id}`)]),
      [button("📝 Lista vacía", "ln")],
      [CANCEL_BUTTON],
    ]),
  );
}

export async function handleComprasCallback(ctx: BotContext, data: string): Promise<void> {
  const [action, id, extra] = data.split(":");

  switch (action) {
    case "lt": {
      const item = await getItem(ctx.db, ctx.actor.familyId, id);
      if (!item) {
        await show(ctx, "Ese producto ya no está en la lista.");
        return;
      }
      const list = await getList(ctx.db, ctx.actor.familyId, item.list_id);
      if (!list || list.status === "cerrada") {
        await showList(ctx, item.list_id, 0);
        return;
      }
      const result = await setItemChecked(ctx.db, ctx.actor, item.id, !item.is_checked);
      if (!result.ok) {
        await sendLive(ctx, result.error);
        return;
      }
      // Tildar desde el bot es estar comprando: igual que abrir el modo
      // supermercado en la app.
      await markListInProgress(ctx.db, ctx.actor.familyId, item.list_id);
      await showList(ctx, item.list_id, { itemId: item.id });
      return;
    }

    case "lp":
      await showList(ctx, id, Number(extra) || 0);
      return;

    case "lc": {
      const { list, items, categories } = await loadListView(ctx, id);
      if (!list) return;
      const pages = buildPages(items, categories);
      await show(
        ctx,
        `${listTitle(list)}\n\nElegí una categoría:`,
        keyboard([
          ...pages.map((p, index) => {
            const done = p.items.filter((i) => i.is_checked).length;
            const mark = done === p.items.length ? "✅ " : "";
            return [button(`${mark}${shortLabel(p.label, 24)} · ${done}/${p.items.length}`, `lp:${list.id}:${index}`)];
          }),
        ]),
      );
      return;
    }

    case "la": {
      const list = await getList(ctx.db, ctx.actor.familyId, id);
      if (!list) return;
      setDialog(ctx.session, "compras:agregar", { listId: list.id });
      await show(
        ctx,
        `${listTitle(list)}\n\n` +
          "Escribí el producto. Podés poner la cantidad al final (<i>leche 2</i>) y mandar varios, uno por línea.",
        keyboard([[button("↩️ Volver a la lista", `lp:${list.id}:0`)]]),
      );
      return;
    }

    case "ln":
    case "lm": {
      // Si mientras tanto alguien abrió una lista, se usa esa: dos listas
      // abiertas por un doble toque no le sirven a nadie.
      const open = await getOpenList(ctx.db, ctx.actor.familyId);
      if (open) {
        await showList(ctx, open.id, {});
        return;
      }
      const itemIds = action === "lm" ? await listTemplateItemIds(ctx.db, ctx.actor.familyId, id) : [];
      const result = await createList(ctx.db, ctx.actor, {
        templateIds: action === "lm" ? [id] : [],
        itemIds,
      });
      if (!result.ok) {
        await show(ctx, result.error);
        return;
      }
      await showList(ctx, result.listId, {});
      return;
    }
  }
}

/** "leche 2" → { name: "leche", quantity: 2 }. Sin número, cantidad 1. */
export function parseProductLine(line: string): { name: string; quantity: number } | null {
  const trimmed = line.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const match = /^(.+?)\s+(\d+(?:[.,]\d+)?)$/.exec(trimmed);
  if (match) {
    const quantity = Number(match[2].replace(",", "."));
    if (quantity > 0) return { name: match[1].slice(0, 80), quantity };
  }
  return { name: trimmed.slice(0, 80), quantity: 1 };
}

export async function handleComprasText(ctx: BotContext, text: string): Promise<void> {
  if (ctx.session.state !== "compras:agregar") return;
  const listId = String(ctx.session.context.listId ?? "");
  const list = listId ? await getList(ctx.db, ctx.actor.familyId, listId) : null;
  if (!list || list.status === "cerrada") {
    clearDialog(ctx.session);
    await show(ctx, "Esa lista ya no está abierta. Con /compra ves la lista actual.");
    return;
  }

  const lines = text
    .split("\n")
    .map(parseProductLine)
    .filter((l): l is { name: string; quantity: number } => l !== null)
    .slice(0, MAX_LINES_PER_MESSAGE);
  if (lines.length === 0) return;

  const guessCategory = await productCategoryGuesser(ctx.db, ctx.actor.familyId);
  const added: string[] = [];
  let firstId: string | undefined;
  for (const line of lines) {
    const category = guessCategory(line.name);
    const result = await addLooseItem(ctx.db, ctx.actor, {
      listId: list.id,
      name: line.name,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      quantity: line.quantity,
      unit: "un",
    });
    if (result.ok) {
      firstId ??= result.id;
      added.push(line.quantity === 1 ? line.name : `${line.name} (${formatQuantity(line.quantity, "un")})`);
    }
  }

  clearDialog(ctx.session);
  if (added.length === 0) {
    await show(ctx, "No se pudo agregar. Probá de nuevo en un momento.");
    return;
  }

  // El pedido de texto queda como registro de lo agregado, y la lista
  // actualizada va abajo, donde la persona está mirando.
  await settleLiveMessage(ctx, `➕ Agregado a ${listTitle(list)}: ${escapeTelegramHtml(added.join(", "))}`);
  await showList(ctx, list.id, { itemId: firstId }, "send");
}
