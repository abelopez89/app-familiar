"use client";

import { Plus, Trash2 } from "lucide-react";
import type { PromoFiltrada } from "@/lib/promos/filtrado";
import type { BeneficioNormalizado, ComponenteNormalizado, ReglaNormalizada } from "@/lib/promos/esquema";
import { RUBROS, type Rubro } from "@/lib/promos/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Reemplazo } from "./actions";

/**
 * Vista previa editable de una promo leída por Claude. Todo lo que se
 * guarda está a la vista y se puede corregir antes de confirmar; al
 * guardar, el servidor vuelve a validar y filtrar.
 *
 * Los campos numéricos son no controlados y confirman en `onBlur` (ver
 * "Inputs numéricos controlados" en CLAUDE.md): así se puede borrar el
 * número y escribir otro sin que el campo se pise solo. Por eso las listas
 * (capas, beneficios, reglas) usan una `key` que incluye el contenido: al
 * quitar un elemento, los de abajo se vuelven a montar con sus valores en
 * vez de quedarse con los del que estaba antes en esa posición.
 */

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
const NINGUNO = "_";

const TIPOS_COMPONENTE: Record<ComponenteNormalizado["tipo"], string> = {
  descuento_caja: "% en caja",
  reintegro: "% reintegro",
  descuento_monto: "Gs. de descuento",
  cuotas: "Cuotas sin intereses",
};

function numeroGs(valor: string): number | null {
  const digitos = valor.replace(/\D/g, "");
  return digitos ? Number(digitos) : null;
}

function numeroDecimal(valor: string): number | null {
  const n = Number(valor.replace(",", "."));
  return valor.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/** "2026-11-06" → "06/11/2026". */
function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Componente({
  componente,
  onChange,
  onQuitar,
}: {
  componente: ComponenteNormalizado;
  onChange: (c: ComponenteNormalizado) => void;
  onQuitar: () => void;
}) {
  const set = (cambios: Partial<ComponenteNormalizado>) => onChange({ ...componente, ...cambios });
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-end gap-2">
        <Campo label="Beneficio" className="flex-1">
          <Select value={componente.tipo} onValueChange={(v) => set({ tipo: v as ComponenteNormalizado["tipo"] })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_COMPONENTE).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Button type="button" variant="ghost" size="icon" aria-label="Quitar beneficio" onClick={onQuitar}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {componente.tipo === "cuotas" ? (
          <Campo label="Cuotas">
            <Input
              inputMode="numeric"
              defaultValue={componente.cuotas ?? ""}
              onBlur={(e) => set({ cuotas: numeroGs(e.target.value) })}
            />
          </Campo>
        ) : componente.tipo === "descuento_monto" ? (
          <Campo label="Monto (Gs.)">
            <Input
              inputMode="numeric"
              defaultValue={componente.monto ?? ""}
              onBlur={(e) => set({ monto: numeroGs(e.target.value) })}
            />
          </Campo>
        ) : (
          <Campo label="Porcentaje">
            <DecimalInput
              defaultValue={componente.porcentaje ?? ""}
              onBlur={(e) => set({ porcentaje: numeroDecimal(e.target.value) })}
            />
          </Campo>
        )}
        <label className="tap-target flex items-center gap-2 self-end pb-2 text-sm">
          <Checkbox checked={componente.es_hasta} onCheckedChange={(v) => set({ es_hasta: v === true })} />
          Dice &ldquo;hasta&rdquo;
        </label>
      </div>

      <Campo label="Sobre qué productos (opcional)">
        <Input
          defaultValue={componente.alcance ?? ""}
          placeholder="Ej: medicamentos"
          onBlur={(e) => set({ alcance: e.target.value.trim() || null })}
        />
      </Campo>

      {componente.tipo !== "cuotas" && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Tope (Gs., opcional)">
            <Input
              inputMode="numeric"
              defaultValue={componente.tope_monto ?? ""}
              onBlur={(e) => set({ tope_monto: numeroGs(e.target.value) })}
            />
          </Campo>
          <Campo label="Tope por">
            <Select
              value={componente.tope_periodo ?? NINGUNO}
              onValueChange={(v) => set({ tope_periodo: v === NINGUNO ? null : (v as ComponenteNormalizado["tope_periodo"]) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>—</SelectItem>
                <SelectItem value="dia">Día</SelectItem>
                <SelectItem value="mes">Mes</SelectItem>
                <SelectItem value="promo">Toda la promo</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          {componente.tope_monto != null && (
            <Campo label="El tope limita" className="col-span-2">
              <Select
                value={componente.tope_tipo ?? NINGUNO}
                onValueChange={(v) =>
                  set({ tope_tipo: v === NINGUNO ? null : (v as NonNullable<ComponenteNormalizado["tope_tipo"]>) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NINGUNO}>Sin definir</SelectItem>
                  <SelectItem value="compra">El monto de compra</SelectItem>
                  <SelectItem value="descuento">El descuento o reintegro</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          )}
        </div>
      )}
    </div>
  );
}

function Regla({
  regla,
  onChange,
  onQuitar,
}: {
  regla: ReglaNormalizada;
  onChange: (r: ReglaNormalizada) => void;
  onQuitar: () => void;
}) {
  const set = (cambios: Partial<ReglaNormalizada>) => onChange({ ...regla, ...cambios });
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-end gap-2">
        <Campo label="Regla" className="flex-1">
          <Select value={regla.regla} onValueChange={(v) => set({ regla: v as ReglaNormalizada["regla"] })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="incluye">Incluye</SelectItem>
              <SelectItem value="excluye">Excluye</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Button type="button" variant="ghost" size="icon" aria-label="Quitar regla" onClick={onQuitar}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Marca">
          <Select value={regla.marca ?? NINGUNO} onValueChange={(v) => set({ marca: v === NINGUNO ? null : v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Cualquiera</SelectItem>
              <SelectItem value="visa">Visa</SelectItem>
              <SelectItem value="mastercard">Mastercard</SelectItem>
              <SelectItem value="amex">Amex</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Tipo">
          <Select
            value={regla.tipo ?? NINGUNO}
            onValueChange={(v) => set({ tipo: v === NINGUNO ? null : (v as ReglaNormalizada["tipo"]) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Cualquiera</SelectItem>
              <SelectItem value="credito">Crédito</SelectItem>
              <SelectItem value="debito">Débito</SelectItem>
              <SelectItem value="prepaga">Prepaga</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Nivel">
          <Input
            defaultValue={regla.nivel ?? ""}
            placeholder="Cualquiera"
            onBlur={(e) => set({ nivel: e.target.value.trim() || null })}
          />
        </Campo>
        <Campo label="Afinidad">
          <Input
            defaultValue={regla.afinidad ?? ""}
            placeholder="Cualquiera"
            onBlur={(e) => set({ afinidad: e.target.value.trim() || null })}
          />
        </Campo>
      </div>
    </div>
  );
}

function Capa({
  capa,
  onChange,
  onQuitar,
}: {
  capa: BeneficioNormalizado;
  onChange: (b: BeneficioNormalizado) => void;
  onQuitar?: () => void;
}) {
  const set = (cambios: Partial<BeneficioNormalizado>) => onChange({ ...capa, ...cambios });
  const dias = capa.dias_semana ?? [];
  const fechas = capa.fechas ?? [];

  function alternarDia(dia: number) {
    const nuevos = dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort();
    set({ dias_semana: nuevos.length > 0 ? nuevos : null });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
      <div className="flex items-end gap-2">
        <Campo label="Capa" className="flex-1">
          <Input defaultValue={capa.nombre} onBlur={(e) => set({ nombre: e.target.value.trim() || "General" })} />
        </Campo>
        <Campo label="Prioridad" className="w-24">
          <Input
            inputMode="numeric"
            defaultValue={capa.prioridad}
            onBlur={(e) => set({ prioridad: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </Campo>
        {onQuitar && (
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar capa" onClick={onQuitar}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <Campo label="Días de la semana (ninguno = todos, o solo las fechas)">
        <div className="flex gap-1">
          {DIAS.map((letra, dia) => (
            <button
              key={dia}
              type="button"
              aria-pressed={dias.includes(dia)}
              onClick={() => alternarDia(dia)}
              className={cn(
                "tap-target flex size-10 items-center justify-center rounded-lg border text-sm font-medium",
                dias.includes(dia) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {letra}
            </button>
          ))}
        </div>
      </Campo>

      <Campo label="Fechas puntuales">
        <div className="flex flex-wrap gap-1.5">
          {fechas.map((fecha) => (
            <button
              key={fecha}
              type="button"
              onClick={() => {
                const resto = fechas.filter((f) => f !== fecha);
                set({ fechas: resto.length > 0 ? resto : null });
              }}
              className="rounded-md bg-background px-2 py-1 text-sm"
              aria-label={`Quitar ${fechaCorta(fecha)}`}
            >
              {fechaCorta(fecha)} ✕
            </button>
          ))}
        </div>
        <Input
          type="date"
          onChange={(e) => {
            const fecha = e.target.value;
            if (fecha && !fechas.includes(fecha)) set({ fechas: [...fechas, fecha].sort() });
            e.target.value = "";
          }}
        />
      </Campo>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Beneficios (se suman)</Label>
        {capa.componentes.map((c, i) => (
          <Componente
            key={`${i}:${JSON.stringify(c)}`}
            componente={c}
            onChange={(nuevo) => set({ componentes: capa.componentes.map((x, j) => (j === i ? nuevo : x)) })}
            onQuitar={() => set({ componentes: capa.componentes.filter((_, j) => j !== i) })}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={() =>
            set({
              componentes: [
                ...capa.componentes,
                {
                  tipo: "reintegro",
                  porcentaje: null,
                  monto: null,
                  cuotas: null,
                  es_hasta: false,
                  alcance: null,
                  tope_monto: null,
                  tope_periodo: null,
                  tope_alcance: null,
                },
              ],
            })
          }
        >
          <Plus className="size-4" />
          Beneficio
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">
          Tarjetas (sin reglas &ldquo;incluye&rdquo;: todas las de crédito del banco)
        </Label>
        {capa.tarjetas.map((r, i) => (
          <Regla
            key={`${i}:${JSON.stringify(r)}`}
            regla={r}
            onChange={(nueva) => set({ tarjetas: capa.tarjetas.map((x, j) => (j === i ? nueva : x)) })}
            onQuitar={() => set({ tarjetas: capa.tarjetas.filter((_, j) => j !== i) })}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={() =>
            set({ tarjetas: [...capa.tarjetas, { regla: "incluye", marca: null, nivel: null, afinidad: null, tipo: "credito" }] })
          }
        >
          <Plus className="size-4" />
          Regla de tarjeta
        </Button>
      </div>
    </div>
  );
}

export function EditorPromo({
  promo,
  onChange,
  reemplazos,
  reemplaza,
  onReemplazaChange,
}: {
  promo: PromoFiltrada;
  onChange: (p: PromoFiltrada) => void;
  reemplazos: Reemplazo[];
  reemplaza: string[];
  onReemplazaChange: (ids: string[]) => void;
}) {
  const set = (cambios: Partial<PromoFiltrada>) => onChange({ ...promo, ...cambios });

  return (
    <div className="flex flex-col gap-3">
      <Campo label="Título">
        <Input defaultValue={promo.titulo} onBlur={(e) => set({ titulo: e.target.value.trim() || promo.titulo })} />
      </Campo>
      <Campo label="Resumen">
        <Input defaultValue={promo.resumen} onBlur={(e) => set({ resumen: e.target.value.trim() })} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Rubro">
          <Select value={promo.rubro} onValueChange={(v) => set({ rubro: v as Rubro })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RUBROS) as Rubro[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RUBROS[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Versión del documento">
          <Input defaultValue={promo.version_doc ?? ""} onBlur={(e) => set({ version_doc: e.target.value.trim() || null })} />
        </Campo>
        <Campo label="Vigente desde">
          <Input
            type="date"
            defaultValue={promo.vigencia_desde ?? ""}
            onChange={(e) => set({ vigencia_desde: e.target.value || null })}
          />
        </Campo>
        <Campo label="Vigente hasta">
          <Input
            type="date"
            defaultValue={promo.vigencia_hasta ?? ""}
            onChange={(e) => set({ vigencia_hasta: e.target.value || null })}
          />
        </Campo>
      </div>

      <Campo label="Comercios (uno por línea)">
        <textarea
          className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-base sm:text-sm"
          defaultValue={promo.comercios.map((c) => c.nombre).join("\n")}
          onBlur={(e) => {
            const nombres = e.target.value
              .split("\n")
              .map((n) => n.trim())
              .filter(Boolean);
            // Mantiene las ventanas (desde/hasta) de los comercios que siguen.
            set({
              comercios: nombres.map(
                (nombre) => promo.comercios.find((c) => c.nombre === nombre) ?? { nombre, desde: null, hasta: null },
              ),
            });
          }}
        />
        {promo.comercios.some((c) => c.desde || c.hasta) && (
          <p className="text-xs text-muted-foreground">
            {promo.comercios
              .filter((c) => c.desde || c.hasta)
              .map(
                (c) =>
                  `${c.nombre}: ${c.desde ? `desde ${fechaCorta(c.desde)}` : ""}${c.desde && c.hasta ? " " : ""}${c.hasta ? `hasta ${fechaCorta(c.hasta)}` : ""}`,
              )
              .join(" · ")}
          </p>
        )}
      </Campo>

      {promo.beneficios.map((capa, i) => (
        <Capa
          key={`${i}:${JSON.stringify(capa)}`}
          capa={capa}
          onChange={(nueva) => set({ beneficios: promo.beneficios.map((x, j) => (j === i ? nueva : x)) })}
          onQuitar={
            promo.beneficios.length > 1
              ? () => set({ beneficios: promo.beneficios.filter((_, j) => j !== i) })
              : undefined
          }
        />
      ))}

      {reemplazos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <p className="text-sm font-medium">Reemplaza a la promo ya cargada</p>
          {reemplazos.map((r) => (
            <label key={r.id} className="tap-target flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={reemplaza.includes(r.id)}
                onCheckedChange={(v) =>
                  onReemplazaChange(v === true ? [...reemplaza, r.id] : reemplaza.filter((id) => id !== r.id))
                }
              />
              <span className="min-w-0">
                <span className="block">{r.titulo}</span>
                <span className="block text-xs text-muted-foreground">
                  {[r.version_doc, r.vigencia_hasta && `hasta ${fechaCorta(r.vigencia_hasta)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {r.esMasNueva && (
                  <span className="block text-xs font-medium text-warning">
                    La que ya está parece más nueva que esta.
                  </span>
                )}
              </span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            La reemplazada no se borra: queda inactiva, apuntando a la nueva.
          </p>
        </div>
      )}
    </div>
  );
}
