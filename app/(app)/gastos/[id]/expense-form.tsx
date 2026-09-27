"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, ChevronDown, ChevronUp, FileText, X } from "lucide-react";
import { saveExpense } from "../actions";
import { Chip } from "../group-form";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  SPLIT_METHODS,
  categoryIcon,
  currencySymbol,
} from "@/lib/expenses/constants";
import { checkExactAmounts, splitByWeights, splitEqual, toAmountPyg } from "@/lib/expenses/split";
import { compressDocumentImage, validateDocumentFileSize } from "@/lib/documents/image";
import { formatGuaranies } from "@/lib/format";
import type { ExpenseCategory, ExpensePaymentMethod, ExpenseSplitMethod } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type FormParticipant = { id: string; display_name: string; color: string | null; is_active: boolean };

export type ExpenseInitial = {
  id: string;
  description: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  categoryId: string | null;
  paidBy: string;
  spentOn: string;
  paymentMethod: ExpensePaymentMethod;
  splitMethod: ExpenseSplitMethod;
  splitIds: string[];
  weights: Record<string, string>;
  exacts: Record<string, string>;
  notes: string;
  receiptDocumentId: string | null;
};

/** Guaraníes: solo dígitos. "150.000" tipeado con punto de miles no es 150. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Carga (y edición) de un gasto. Es la pantalla que se usa parado en la
 * caja del restaurante, así que va en el orden en que uno la piensa —
 * importe, moneda, descripción, categoría, quién pagó, entre quiénes,
 * fecha, método — y lo raro (modo de división, ticket, notas) queda en
 * una sección colapsada. El caso común, "partes iguales entre todos", son
 * cuatro toques.
 *
 * Todo lo que se calcula acá (equivalente en guaraníes, partes) es vista
 * previa: el servidor vuelve a dividir con `lib/expenses/split.ts` y la
 * base valida que las partes sumen exacto.
 */
export function ExpenseForm({
  groupId,
  participants,
  categories,
  defaultRates,
  defaultCurrency,
  defaultPayerId,
  today,
  initial,
}: {
  groupId: string;
  participants: FormParticipant[];
  categories: ExpenseCategory[];
  defaultRates: Record<string, number>;
  defaultCurrency: string;
  defaultPayerId: string;
  today: string;
  initial?: ExpenseInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const allIds = useMemo(() => participants.map((p) => p.id), [participants]);
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [rate, setRate] = useState(
    initial?.exchangeRate ?? (defaultCurrency !== "PYG" ? (defaultRates[defaultCurrency]?.toString() ?? "") : ""),
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? defaultPayerId);
  const [splitIds, setSplitIds] = useState<Set<string>>(
    () => new Set(initial?.splitIds ?? participants.filter((p) => p.is_active).map((p) => p.id)),
  );
  const [spentOn, setSpentOn] = useState(initial?.spentOn ?? today);
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(initial?.paymentMethod ?? "efectivo");
  const [splitMethod, setSplitMethod] = useState<ExpenseSplitMethod>(initial?.splitMethod ?? "iguales");
  const [weights, setWeights] = useState<Record<string, string>>(initial?.weights ?? {});
  const [exacts, setExacts] = useState<Record<string, string>>(initial?.exacts ?? {});
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showMore, setShowMore] = useState(initial ? initial.splitMethod !== "iguales" || !!initial.notes : false);

  const [receipt, setReceipt] = useState<{ blob: Blob; name: string; preview?: string } | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [removeReceipt, setRemoveReceipt] = useState(false);

  const isPyg = currency === "PYG";
  const amountPyg = useMemo(() => (amount ? toAmountPyg(amount, isPyg ? "1" : rate || "0") : null), [amount, rate, isPyg]);

  function selectCurrency(code: string) {
    if (code === currency) return;
    setCurrency(code);
    if (code === "PYG") {
      setAmount((a) => digitsOnly(a.split(".")[0] ?? ""));
      setRate("");
    } else {
      const keepOwn = initial && initial.currency === code;
      setRate(keepOwn ? initial.exchangeRate : (defaultRates[code]?.toString() ?? ""));
    }
  }

  function toggleSplit(id: string) {
    setSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeSplitMethod(method: ExpenseSplitMethod) {
    setSplitMethod(method);
    // Al pasar a "por partes" arranca con peso 1 para los que estaban
    // marcados y 0 para el resto, así el cambio de modo no altera nada
    // hasta que se toca un peso.
    if (method === "partes") {
      setWeights((prev) =>
        Object.fromEntries(allIds.map((id) => [id, prev[id] ?? (splitIds.has(id) ? "1" : "0")])),
      );
    }
  }

  // --- Vista previa de la división ---
  const preview = useMemo(() => {
    if (!amountPyg) return null;
    try {
      if (splitMethod === "iguales") {
        const ids = allIds.filter((id) => splitIds.has(id));
        if (ids.length === 0) return { error: "Elegí entre quiénes se divide." };
        return { shares: new Map(splitEqual(amountPyg, ids).map((s) => [s.participantId, s.sharePyg])) };
      }
      if (splitMethod === "partes") {
        const list = allIds.map((id) => ({ participantId: id, weight: (weights[id] ?? "0").trim() || "0" }));
        return { shares: new Map(splitByWeights(amountPyg, list).map((s) => [s.participantId, s.sharePyg])) };
      }
      const check = checkExactAmounts(amount, allIds.map((id) => ({ amount: exacts[id] ?? "" })));
      if (!check.ok) {
        if (check.difference === 0) return { error: "Hay un importe que no es un número válido." };
        const diff = Math.abs(check.difference).toLocaleString("es-PY", { maximumFractionDigits: 2 });
        return {
          error: `${check.difference > 0 ? "Faltan" : "Sobran"} ${isPyg ? formatGuaranies(Math.abs(check.difference)) : `${currencySymbol(currency)} ${diff}`} para llegar al total.`,
        };
      }
      return { shares: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se puede dividir así." };
    }
  }, [amountPyg, amount, splitMethod, splitIds, weights, exacts, allIds, isPyg, currency]);

  async function handleReceipt(file: File | undefined) {
    if (!file) return;
    setProcessingReceipt(true);
    try {
      const result = await compressDocumentImage(file);
      const sizeError = validateDocumentFileSize(result.blob.size);
      if (sizeError) {
        toast.error(sizeError);
        return;
      }
      setReceipt({
        blob: result.blob,
        name: result.name,
        preview: result.contentType.startsWith("image/") ? URL.createObjectURL(result.blob) : undefined,
      });
      setRemoveReceipt(false);
    } catch {
      toast.error("No se pudo procesar el archivo.");
    } finally {
      setProcessingReceipt(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!amountPyg) {
      toast.error(isPyg || rate ? "Revisá el importe." : `Falta la cotización de ${currency}.`);
      return;
    }
    if (preview && "error" in preview) {
      toast.error(preview.error);
      return;
    }

    const fd = new FormData();
    fd.set("group_id", groupId);
    if (initial) fd.set("expense_id", initial.id);
    fd.set("amount", amount);
    fd.set("currency", currency);
    if (!isPyg) fd.set("exchange_rate", rate);
    fd.set("description", description);
    if (categoryId) fd.set("category_id", categoryId);
    fd.set("paid_by", paidBy);
    fd.set("spent_on", spentOn);
    fd.set("payment_method", paymentMethod);
    fd.set("split_method", splitMethod);
    if (splitMethod === "iguales") for (const id of splitIds) fd.append("split_ids", id);
    if (splitMethod === "partes") for (const id of allIds) fd.set(`weight_${id}`, weights[id] ?? "0");
    if (splitMethod === "exactos") for (const id of allIds) fd.set(`exact_${id}`, exacts[id] ?? "");
    fd.set("notes", notes);
    if (initial?.receiptDocumentId) fd.set("receipt_document_id", initial.receiptDocumentId);
    if (removeReceipt) fd.set("remove_receipt", "on");
    if (receipt) fd.append("receipt", receipt.blob, receipt.name);

    startTransition(async () => {
      const result = await saveExpense(fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(initial ? "Gasto actualizado." : "Gasto cargado.");
      router.push(`/gastos/${groupId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* 1. Importe */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Importe</Label>
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-lg font-semibold text-muted-foreground">{currencySymbol(currency)}</span>
          {isPyg ? (
            <Input
              id="amount"
              inputMode="numeric"
              autoFocus={!initial}
              value={amount}
              onChange={(e) => setAmount(digitsOnly(e.target.value))}
              className="h-14 text-2xl font-semibold tabular-nums"
              placeholder="0"
            />
          ) : (
            <DecimalInput
              id="amount"
              autoFocus={!initial}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 text-2xl font-semibold tabular-nums"
              placeholder="0"
            />
          )}
        </div>
        {isPyg && amountPyg ? (
          <p className="text-xs text-muted-foreground tabular-nums">{formatGuaranies(amountPyg)}</p>
        ) : null}
      </div>

      {/* 2. Moneda */}
      <div className="flex flex-wrap gap-2">
        {CURRENCIES.map((c) => (
          <Chip key={c.code} selected={currency === c.code} onClick={() => selectCurrency(c.code)}>
            {c.code}
          </Chip>
        ))}
      </div>

      {/* Cotización: solo si no es guaraníes, con el equivalente en vivo. */}
      {!isPyg && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <Label htmlFor="exchange_rate">Cotización (Gs por 1 {currency})</Label>
          <DecimalInput id="exchange_rate" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej: 1450" />
          <p className="text-sm tabular-nums">
            {amountPyg ? (
              <>
                = <span className="font-semibold">{formatGuaranies(amountPyg)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Cargá importe y cotización para ver el equivalente.</span>
            )}
          </p>
          {paymentMethod === "tarjeta_credito" && (
            <p className="text-xs text-muted-foreground">
              Con tarjeta de crédito el banco liquida después: poné una estimada y corregila cuando llegue el resumen.
            </p>
          )}
        </div>
      )}

      {/* 3. Descripción */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cena en la costanera"
          required
        />
      </div>

      {/* 4. Categoría */}
      {categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Categoría</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const Icon = categoryIcon(c.icon);
              return (
                <Chip
                  key={c.id}
                  selected={categoryId === c.id}
                  onClick={() => setCategoryId((prev) => (prev === c.id ? null : c.id))}
                >
                  <Icon className="size-4" />
                  {c.name}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Quién pagó */}
      <div className="flex flex-col gap-2">
        <Label>Pagó</Label>
        <div className="flex flex-wrap gap-2">
          {participants
            .filter((p) => p.is_active || p.id === paidBy)
            .map((p) => (
              <Chip key={p.id} selected={paidBy === p.id} onClick={() => setPaidBy(p.id)}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color ?? undefined }} />
                {p.display_name}
              </Chip>
            ))}
        </div>
      </div>

      {/* 6. Entre quiénes */}
      <div className="flex flex-col gap-2">
        <Label>Entre quiénes</Label>
        {splitMethod === "iguales" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {participants
                .filter((p) => p.is_active || splitIds.has(p.id))
                .map((p) => (
                  <Chip key={p.id} selected={splitIds.has(p.id)} onClick={() => toggleSplit(p.id)}>
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color ?? undefined }} />
                    {p.display_name}
                    {splitIds.has(p.id) && <Check className="size-3.5" />}
                  </Chip>
                ))}
            </div>
            {preview && "shares" in preview && preview.shares && splitIds.size > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {splitIds.size === 1
                  ? "Todo para una persona."
                  : `Partes iguales: ${formatGuaranies(Math.min(...preview.shares.values()))}${
                      new Set(preview.shares.values()).size > 1 ? " (algunos 1 Gs más por redondeo)" : ""
                    } cada uno`}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {SPLIT_METHODS[splitMethod].label}: completalo en &quot;Más opciones&quot;.
          </p>
        )}
      </div>

      {/* 7. Fecha */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="spent_on">Fecha</Label>
        <Input id="spent_on" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
      </div>

      {/* 8. Método de pago */}
      <div className="flex flex-col gap-2">
        <Label>Método de pago</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PAYMENT_METHODS) as ExpensePaymentMethod[]).map((m) => (
            <Chip key={m} selected={paymentMethod === m} onClick={() => setPaymentMethod(m)}>
              {PAYMENT_METHODS[m].label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Más opciones: modo de división, ticket, notas. */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex items-center gap-1 text-left text-sm font-medium text-muted-foreground"
      >
        {showMore ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        Más opciones (división, ticket, notas)
      </button>

      {showMore && (
        <div className="flex flex-col gap-5 rounded-lg border p-3">
          <div className="flex flex-col gap-2">
            <Label>Cómo se divide</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SPLIT_METHODS) as ExpenseSplitMethod[]).map((m) => (
                <Chip key={m} selected={splitMethod === m} onClick={() => changeSplitMethod(m)}>
                  {SPLIT_METHODS[m].label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{SPLIT_METHODS[splitMethod].hint}</p>

            {splitMethod === "partes" && (
              <div className="flex flex-col divide-y rounded-lg border">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? undefined }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.display_name}</span>
                    <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">
                      {preview && "shares" in preview && preview.shares?.get(p.id)
                        ? formatGuaranies(preview.shares.get(p.id)!)
                        : "—"}
                    </span>
                    <DecimalInput
                      className="w-16 text-center"
                      value={weights[p.id] ?? "0"}
                      onChange={(e) => setWeights((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      aria-label={`Peso de ${p.display_name}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {splitMethod === "exactos" && (
              <div className="flex flex-col divide-y rounded-lg border">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? undefined }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.display_name}</span>
                    <span className="text-xs text-muted-foreground">{currencySymbol(currency)}</span>
                    {isPyg ? (
                      <Input
                        inputMode="numeric"
                        className="w-28 text-right tabular-nums"
                        value={exacts[p.id] ?? ""}
                        onChange={(e) => setExacts((prev) => ({ ...prev, [p.id]: digitsOnly(e.target.value) }))}
                        aria-label={`Importe de ${p.display_name}`}
                      />
                    ) : (
                      <DecimalInput
                        className="w-28 text-right tabular-nums"
                        value={exacts[p.id] ?? ""}
                        onChange={(e) => setExacts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        aria-label={`Importe de ${p.display_name}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {preview && "error" in preview && splitMethod !== "iguales" && (
              <p className="text-sm font-medium text-destructive">{preview.error}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Ticket</Label>
            {initial?.receiptDocumentId && !removeReceipt && !receipt && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <Link href={`/documentos/${initial.receiptDocumentId}`} className="flex-1 underline underline-offset-2">
                  Ver ticket en Documentos
                </Link>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveReceipt(true)}>
                  Quitar
                </Button>
              </div>
            )}
            {receipt ? (
              <div className="flex items-center gap-3">
                {receipt.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={receipt.preview} alt="Ticket" className="size-16 rounded-lg border object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-lg border bg-muted">
                    <FileText className="size-6 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{receipt.name}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => setReceipt(null)} aria-label="Quitar ticket">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={processingReceipt}
                onClick={() => receiptInputRef.current?.click()}
              >
                <Camera className="size-4" />
                {processingReceipt ? "Procesando…" : initial?.receiptDocumentId && !removeReceipt ? "Reemplazar foto" : "Foto del ticket"}
              </Button>
            )}
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                void handleReceipt(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">Se guarda en el Centro de Documentos, como factura.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending || processingReceipt} className={cn("h-12 text-base")}>
        {isPending ? "Guardando…" : initial ? "Guardar cambios" : "Guardar gasto"}
      </Button>
    </form>
  );
}
