import {
  Bed,
  Bus,
  Ellipsis,
  Fuel,
  Gift,
  IceCreamCone,
  Map as MapIcon,
  ShoppingBag,
  Tag,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ExpenseGroupKind, ExpensePaymentMethod, ExpenseSplitMethod } from "@/lib/supabase/types";

/**
 * Monedas que ofrece el formulario. PYG es la moneda de cuenta: todo se
 * suma en guaraníes (`amount_pyg`). Las demás se cargan con cotización a
 * mano — no hay conversión automática por API, a propósito.
 */
export const CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: "PYG", label: "Guaraníes", symbol: "Gs" },
  { code: "BRL", label: "Reales", symbol: "R$" },
  { code: "ARS", label: "Pesos argentinos", symbol: "AR$" },
  { code: "USD", label: "Dólares", symbol: "US$" },
  { code: "EUR", label: "Euros", symbol: "€" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** Importe en su moneda original: "R$ 100,50", "Gs 150.000". */
export function formatOriginalAmount(amount: number, currency: string): string {
  if (currency === "PYG") return `Gs ${Math.round(amount).toLocaleString("es-PY")}`;
  return `${currencySymbol(currency)} ${amount.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const GROUP_KINDS: Record<ExpenseGroupKind, { label: string }> = {
  viaje: { label: "Viaje" },
  evento: { label: "Evento" },
  otro: { label: "Otro" },
};

export const PAYMENT_METHODS: Record<ExpensePaymentMethod, { label: string }> = {
  efectivo: { label: "Efectivo" },
  tarjeta_credito: { label: "Tarjeta de crédito" },
  tarjeta_debito: { label: "Tarjeta de débito" },
  transferencia: { label: "Transferencia" },
  otro: { label: "Otro" },
};

export const SPLIT_METHODS: Record<ExpenseSplitMethod, { label: string; hint: string }> = {
  iguales: { label: "Partes iguales", hint: "Entre los que marcaste arriba" },
  partes: { label: "Por partes", hint: "Cada uno con su peso: 2 cuenta doble" },
  exactos: { label: "Importes exactos", hint: "Cada uno pone lo suyo" },
};

/**
 * Íconos de categoría. `expense_categories.icon` guarda el nombre (el
 * mismo de lucide) y acá se resuelve al componente; un nombre que no está
 * en la lista cae en `Tag`. Las claves coinciden con el seed de la
 * migración 011.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  bed: Bed,
  fuel: Fuel,
  utensils: Utensils,
  "ice-cream": IceCreamCone,
  bus: Bus,
  map: MapIcon,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  ticket: Ticket,
  ellipsis: Ellipsis,
  tag: Tag,
};

export const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICONS);

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Tag;
}

/** Mismas que siembra la migración 011, para familias creadas después. */
export const SUGGESTED_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Hotel", icon: "bed" },
  { name: "Combustible", icon: "fuel" },
  { name: "Comida", icon: "utensils" },
  { name: "Postre", icon: "ice-cream" },
  { name: "Transporte", icon: "bus" },
  { name: "Paseos", icon: "map" },
  { name: "Compras", icon: "shopping-bag" },
  { name: "Regalos", icon: "gift" },
  { name: "Peajes", icon: "ticket" },
  { name: "Otros", icon: "ellipsis" },
];

/**
 * Colores para invitados (los miembros heredan el suyo de
 * `family_members.color`). Es un dato del participante, igual que el
 * color de un miembro, no un color de interfaz.
 */
export const GUEST_COLORS = ["#f97316", "#14b8a6", "#a855f7", "#eab308", "#ec4899", "#0ea5e9", "#84cc16", "#ef4444"];

/**
 * El balance de quien mira, en una frase: es el número que uno quiere ver
 * de un vistazo en la lista de grupos y en el encabezado de cada uno.
 */
export function describeBalance(balance: number, formatter: (n: number) => string, person: "vos" | "tercero" = "vos"): string {
  if (balance > 0) return person === "vos" ? `te deben ${formatter(balance)}` : `le deben ${formatter(balance)}`;
  if (balance < 0) return person === "vos" ? `debés ${formatter(-balance)}` : `debe ${formatter(-balance)}`;
  return person === "vos" ? "estás al día" : "al día";
}

export function balanceTone(balance: number): string {
  if (balance > 0) return "text-success";
  if (balance < 0) return "text-destructive";
  return "text-muted-foreground";
}
