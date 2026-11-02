import type { FuelInterval } from "@/lib/fuel/consumption";
import { formatDate } from "@/lib/dates";
import { FUEL_UNITS, efficiencyValue, type FuelUnit } from "@/lib/fuel/efficiency";

const PADDING = 24;

/**
 * SVG a mano, sin librería — mismo criterio que el calendario (Fase 2) y
 * el modo supermercado (Fase 1): son dos series simples y una librería de
 * charts traería su propio sistema de estilos a pelear con Tailwind v4.
 */
export function PerformanceChart({
  intervals,
  logDates,
  unit,
  width: WIDTH = 320,
  height: HEIGHT = 140,
  showAverage = false,
}: {
  intervals: FuelInterval[];
  logDates: Record<string, string>;
  unit: FuelUnit;
  /** Tamaño del viewBox: el tablero de escritorio lo usa más ancho y bajo. */
  width?: number;
  height?: number;
  /** Línea punteada con el promedio de los tramos graficados (tablero de escritorio). */
  showAverage?: boolean;
}) {
  if (intervals.length < 2) {
    return <p className="text-sm text-muted-foreground">Hace falta más de un tramo para graficar la tendencia.</p>;
  }

  // Se grafica en la unidad elegida. Con L/100 km, más arriba es más
  // consumo (peor); con km/L, más arriba es mejor.
  const values = intervals.map((i) => efficiencyValue(i.kmPerLiter, unit));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, i) => {
    const x = PADDING + (i / (intervals.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
    return { x, y };
  });

  const average = values.reduce((s, v) => s + v, 0) / values.length;
  const averageY = HEIGHT - PADDING - ((average - min) / range) * (HEIGHT - PADDING * 2);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Rendimiento por carga">
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          className="stroke-border"
          strokeWidth="1"
        />
        {showAverage && (
          <line
            x1={PADDING}
            y1={averageY}
            x2={WIDTH - PADDING}
            y2={averageY}
            className="stroke-muted-foreground"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" className="fill-primary" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(logDates[intervals[0].toLogId] ?? "")}</span>
        <span>
          {min.toFixed(1)}–{max.toFixed(1)} {FUEL_UNITS[unit].short}
          {showAverage ? ` · promedio ${average.toFixed(1)} (punteada)` : ""}
        </span>
        <span>{formatDate(logDates[intervals[intervals.length - 1].toLogId] ?? "")}</span>
      </div>
    </div>
  );
}
