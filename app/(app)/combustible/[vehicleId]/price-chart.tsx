import type { FuelLog } from "@/lib/supabase/types";
import { formatDate } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";

const WIDTH = 320;
const HEIGHT = 140;
const PADDING = 24;

export function PriceChart({ logs }: { logs: FuelLog[] }) {
  const withPrice = logs
    .filter((l) => l.price_per_liter != null)
    .sort((a, b) => Date.parse(a.filled_at) - Date.parse(b.filled_at));

  if (withPrice.length < 2) {
    return <p className="text-sm text-muted-foreground">Hace falta más de una carga con monto para graficar el precio.</p>;
  }

  const values = withPrice.map((l) => l.price_per_liter as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = withPrice.map((log, i) => {
    const x = PADDING + (i / (withPrice.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - (((log.price_per_liter as number) - min) / range) * (HEIGHT - PADDING * 2);
    return { x, y, log };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Precio por litro en el tiempo">
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          className="stroke-border"
          strokeWidth="1"
        />
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" className="fill-primary" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(withPrice[0].filled_at)}</span>
        <span>
          {formatGuaranies(min)}–{formatGuaranies(max)}
        </span>
        <span>{formatDate(withPrice[withPrice.length - 1].filled_at)}</span>
      </div>
    </div>
  );
}
