import Link from "next/link";
import { GraduationCap, Plus, TrendingDown } from "lucide-react";
import type { InformeConMiembro } from "@/lib/calificaciones/queries";
import { BAJA_DESTACADA, formatPuntos, resumirAnio, type Celda } from "@/lib/calificaciones/resumen";
import { MONTH_NAMES } from "@/lib/calificaciones/parse";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

/** Debajo de esto la barra de una materia va en color de advertencia. */
const UMBRAL_BAJO = 70;

function mesCorto(month: number) {
  return MONTH_NAMES[month - 1].slice(0, 3);
}

function pctTexto(pct: number) {
  return `${Math.round(pct)}%`;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "tap-target inline-flex items-center rounded-full border px-3 text-sm",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function CeldaMes({ celda }: { celda: Celda | null }) {
  if (!celda) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex flex-col items-end leading-tight" title={celda.observations ?? undefined}>
      <span className="tabular-nums">{formatPuntos(celda.points, celda.maxPoints)}</span>
      <span className={cn("text-xs tabular-nums", celda.pct < UMBRAL_BAJO ? "text-warning" : "text-muted-foreground")}>
        {pctTexto(celda.pct)}
      </span>
    </span>
  );
}

/** La vista del resumen, separada de las consultas. */
export function VistaCalificaciones({
  hijos,
  hijo,
  anios,
  anio,
  delAnio,
}: {
  hijos: { id: string; display_name: string }[];
  hijo: { id: string; display_name: string } | undefined;
  anios: number[];
  anio: number;
  delAnio: InformeConMiembro[];
}) {
  const modulo = MODULES_BY_KEY.documentos;
  const cargar = (
    <Button asChild size="icon" className="size-10">
      <Link href="/documentos/calificaciones/cargar" aria-label="Cargar calificaciones">
        <Plus className="size-5" />
      </Link>
    </Button>
  );
  const resumen = resumirAnio(delAnio);
  const ultimo = delAnio.reduce((a, b) => (b.month > a.month ? b : a), delAnio[0]);
  const totalUltimo = resumen.totalesMes[resumen.meses.length - 1];
  const grado = ultimo?.grade;
  const href = (miembro: string, a?: number) =>
    `/documentos/calificaciones?miembro=${miembro}${a ? `&anio=${a}` : ""}`;

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-nav">
      <PageHeader
        title="Calificaciones"
        description={[hijo?.display_name, grado, anio].filter(Boolean).join(" · ")}
        icon={GraduationCap}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
        actions={cargar}
      />

      {(hijos.length > 1 || anios.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {hijos.length > 1 &&
            hijos.map((m) => (
              <Chip key={m.id} href={href(m.id)} active={m.id === hijo?.id}>
                {m.display_name}
              </Chip>
            ))}
          {anios.length > 1 &&
            anios.map((a) => (
              <Chip key={a} href={href(hijo!.id, a)} active={a === anio}>
                {a}
              </Chip>
            ))}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
          <Stat
            label={`Acumulado ${anio}`}
            value={resumen.total ? pctTexto(resumen.total.pct) : "–"}
          />
          <Stat
            label={ultimo ? `Último mes (${MONTH_NAMES[ultimo.month - 1]})` : "Último mes"}
            value={totalUltimo ? pctTexto(totalUltimo.pct) : "–"}
          />
          <Stat label="Llegadas tardías" value={resumen.llegadasTardias} />
          <Stat label="Ausencias" value={resumen.ausencias} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <SectionTitle>Por materia</SectionTitle>
        <Card>
          <CardContent className="flex flex-col divide-y pt-2 pb-2">
            {resumen.materias.map((m) => {
              const bajo = m.pct < UMBRAL_BAJO;
              const bajo10 = m.variacion !== null && m.variacion <= -BAJA_DESTACADA;
              const evaluadas = m.celdas.flatMap((c, i) => (c ? [{ c, mes: resumen.meses[i] }] : []));
              const ultima = evaluadas.at(-1);
              const anterior = evaluadas.at(-2);
              return (
                <div key={m.subject} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">{m.subject}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {pctTexto(m.pct)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {formatPuntos(m.points, m.maxPoints)}
                      </span>
                    </span>
                  </div>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn("block h-full rounded-full", bajo ? "bg-warning" : "bg-mod-documentos")}
                      style={{ width: `${Math.min(100, m.pct)}%` }}
                    />
                  </span>
                  {bajo10 && ultima && anterior && (
                    <p className="flex items-start gap-1.5 text-xs text-warning">
                      <TrendingDown className="mt-px size-3.5 shrink-0" />
                      <span>
                        Bajó de {pctTexto(anterior.c.pct)} en {MONTH_NAMES[anterior.mes - 1]} a{" "}
                        {pctTexto(ultima.c.pct)} en {MONTH_NAMES[ultima.mes - 1]} (
                        {formatPuntos(ultima.c.points, ultima.c.maxPoints)})
                        {ultima.c.observations ? `. ${ultima.c.observations}` : ""}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <SectionTitle>Mes a mes</SectionTitle>
        <Card className="min-w-0 py-0">
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">Materia</th>
                  {resumen.meses.map((mes) => (
                    <th key={mes} className="px-3 py-2 text-right font-medium">
                      {mesCorto(mes)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.materias.map((m) => (
                  <tr key={m.subject} className="border-b last:border-b-0">
                    <td className="sticky left-0 max-w-36 truncate bg-card px-3 py-2">{m.subject}</td>
                    {m.celdas.map((c, i) => (
                      <td key={resumen.meses[i]} className="px-3 py-2 text-right">
                        <CeldaMes celda={c} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="sticky left-0 bg-card px-3 py-2">Total</td>
                  {resumen.totalesMes.map((t, i) => (
                    <td key={resumen.meses[i]} className="px-3 py-2 text-right">
                      <CeldaMes celda={t ? { ...t, observations: null } : null} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          &quot;–&quot;: la materia no se evaluó ese mes. El acumulado suma los puntos de todos los meses.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Informes</SectionTitle>
        <Card>
          <CardContent className="flex flex-col divide-y pt-2 pb-2">
            {[...delAnio].sort((a, b) => b.month - a.month).map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {MONTH_NAMES[i.month - 1]} {i.year}
                </span>
                <span className="flex gap-3">
                  {i.documentId && (
                    <>
                      <Link href={`/documentos/${i.documentId}`} className="text-muted-foreground underline">
                        PDF
                      </Link>
                      <Link
                        href={`/documentos/calificaciones/cargar?doc=${i.documentId}`}
                        className="text-muted-foreground underline"
                      >
                        Editar
                      </Link>
                    </>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
