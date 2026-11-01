"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, TriangleAlert } from "lucide-react";
import { calcularDescuento, claveComponente, seleccionPorDefecto } from "@/lib/promos/ahorro";
import { describirComponente, describirTopes } from "@/lib/promos/formato";
import { BANCOS } from "@/lib/promos/constants";
import { esBanco } from "@/lib/promos/normalize";
import type { OpcionPromo } from "@/lib/promos/usos";
import { formatGuaranies } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarUsoPromo, quitarUsoPromo } from "./actions";

type Existente = { id: string; clave: string | null; titulo: string; tarjeta: string; claves: string[] };

const PERIODO = { dia: "del día", mes: "del mes", promo: "de toda la promo" } as const;

function seleccionInicial(opcion: OpcionPromo | undefined, claves: string[] | null): number[] {
  if (!opcion) return [];
  if (claves && claves.length > 0) {
    const indices = opcion.componentes.flatMap((c, i) => (claves.includes(claveComponente(c)) ? [i] : []));
    if (indices.length > 0) return indices;
  }
  return seleccionPorDefecto(opcion.componentes);
}

/**
 * Elegir la promo y la tarjeta con que se pagó, cargar el monto ANTES del
 * descuento y ver al instante lo que deberían cobrar en caja, el
 * reintegro y el tope que queda (el mismo cálculo que hace el servidor al
 * guardar, `lib/promos/ahorro.ts`).
 */
export function UsarPromo({
  referencia,
  montoInicial,
  opciones,
  existente,
}: {
  referencia: { tipo: "compra" | "carga"; id: string; fecha: string; volver: string };
  montoInicial: number | null;
  opciones: OpcionPromo[];
  existente: Existente | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [monto, setMonto] = useState(montoInicial ? String(montoInicial) : "");
  const claveInicial =
    existente?.clave && opciones.some((o) => o.clave === existente.clave) ? existente.clave : (opciones[0]?.clave ?? null);
  const [clave, setClave] = useState<string | null>(claveInicial);
  const opcion = opciones.find((o) => o.clave === clave);
  const [seleccion, setSeleccion] = useState<number[]>(() =>
    seleccionInicial(opcion, existente?.clave === claveInicial ? existente.claves : null),
  );

  const montoBruto = Number(monto.replace(/\D/g, "")) || 0;
  const calculo = useMemo(
    () =>
      opcion && montoBruto > 0
        ? calcularDescuento({
            montoBruto,
            componentes: opcion.componentes,
            seleccion,
            usosAnteriores: opcion.usosAnteriores,
            fecha: referencia.fecha,
            excluirId: existente?.id,
          })
        : null,
    [opcion, montoBruto, seleccion, referencia.fecha, existente?.id],
  );

  function elegir(o: OpcionPromo) {
    setClave(o.clave);
    setSeleccion(seleccionInicial(o, existente?.clave === o.clave ? existente.claves : null));
  }

  function volver() {
    router.push(referencia.volver);
    router.refresh();
  }

  function guardar() {
    if (!opcion) return;
    startTransition(async () => {
      const result = await guardarUsoPromo({
        [referencia.tipo]: referencia.id,
        promoId: opcion.promoId,
        tarjetaId: opcion.tarjetaId,
        montoBruto,
        seleccion,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Promo registrada.");
      volver();
    });
  }

  function quitar() {
    if (!existente) return;
    startTransition(async () => {
      const result = await quitarUsoPromo(existente.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Se quitó la promo.");
      volver();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {existente && !opcion && (
        <p className="px-1 text-sm text-muted-foreground">
          Registrada con {existente.titulo} ({existente.tarjeta}), que ya no figura entre las promos de ese día. Podés
          quitarla o elegir otra.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monto">Total de la compra, antes del descuento</Label>
        <Input
          id="monto"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
          placeholder="Gs."
        />
        {montoBruto > 0 && <p className="px-1 text-xs text-muted-foreground">{formatGuaranies(montoBruto)}</p>}
      </div>

      {opciones.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          Ese día no había promos de este rubro para las tarjetas de la familia.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>Promo y tarjeta</Label>
          {opciones.map((o) => {
            const elegida = o.clave === clave;
            const topes = describirTopes(o.componentes);
            return (
              <button
                key={o.clave}
                type="button"
                onClick={() => elegir(o)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border p-3 text-left",
                  elegida ? "border-mod-promos bg-mod-promos-soft" : "bg-card",
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-snug">
                    {o.comercios.length > 0 ? o.comercios.join(", ") : o.titulo}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {esBanco(o.banco) ? BANCOS[o.banco].label : o.banco}
                  </span>
                </span>
                <span className="text-sm">
                  {o.componentes
                    .filter((c) => c.tipo !== "cuotas")
                    .map((c) => describirComponente(c))
                    .join(" + ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  <CreditCard className="mr-1 inline size-3.5 align-[-2px]" />
                  {o.tarjetaAlias} · {o.tarjetaNombre}
                  {topes.length > 0 ? ` · ${topes.join(" · ")}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {opcion && opcion.componentes.filter((c) => c.tipo !== "cuotas").length > 1 && (
        <div className="flex flex-col gap-1">
          <Label>Qué se aplicó</Label>
          {opcion.componentes.map((c, i) =>
            c.tipo === "cuotas" ? null : (
              <label key={i} className="tap-target flex items-center gap-2 text-sm">
                <Checkbox
                  checked={seleccion.includes(i)}
                  onCheckedChange={(v) =>
                    setSeleccion(v === true ? [...seleccion, i] : seleccion.filter((x) => x !== i))
                  }
                />
                {describirComponente(c)}
              </label>
            ),
          )}
        </div>
      )}

      {calculo && opcion && (
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-1.5 p-4 text-sm">
            <p className="flex justify-between">
              <span>En caja deberían cobrarte</span>
              <span className="font-semibold">{formatGuaranies(calculo.montoCaja)}</span>
            </p>
            {calculo.descuentoCaja > 0 && (
              <p className="flex justify-between text-muted-foreground">
                <span>Descuento en caja</span>
                <span>−{formatGuaranies(calculo.descuentoCaja)}</span>
              </p>
            )}
            {calculo.reintegro > 0 && (
              <p className="flex justify-between text-muted-foreground">
                <span>Reintegro en la tarjeta</span>
                <span>−{formatGuaranies(calculo.reintegro)}</span>
              </p>
            )}
            <p className="flex justify-between border-t pt-1.5">
              <span>Te termina costando</span>
              <span className="font-semibold">{formatGuaranies(calculo.costoFinal)}</span>
            </p>
            {calculo.aplicados
              .filter((a) => a.tope_monto)
              .map((a) => (
                <p key={a.clave} className={cn("text-xs", a.topeAlcanzado ? "font-medium text-warning" : "text-muted-foreground")}>
                  {a.topeAlcanzado
                    ? `Con esta compra se completa el tope ${a.tope_periodo ? PERIODO[a.tope_periodo] : ""} de esta tarjeta.`
                    : `Del tope ${a.tope_periodo ? PERIODO[a.tope_periodo] : ""} quedan ${formatGuaranies(a.restante ?? 0)} para esta tarjeta.`}
                </p>
              ))}
            {calculo.aplicados.some((a) => a.topeDudoso) && (
              <p className="mt-1 flex gap-1.5 text-xs text-warning">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  La promo no dice si el tope es de compra o de reintegro; se tomó como de reintegro.{" "}
                  <Link href={`/promos/${opcion.promoId}/editar`} className="underline">
                    Corregir la promo
                  </Link>
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Button disabled={pending || !opcion || montoBruto <= 0} onClick={guardar}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {existente && (
          <Button variant="outline" disabled={pending} onClick={quitar}>
            No usé promo (quitar)
          </Button>
        )}
        <Button variant="ghost" disabled={pending} onClick={() => router.push(referencia.volver)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
