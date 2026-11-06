import { cn } from "@/lib/utils";
import { dateOnlyToFamilyMidnightUtc, formatDate } from "@/lib/dates";

/*
 * Ñandutí: el encaje de Itauguá como sello de la app (identidad "Lapacho y
 * tereré"). Es el único adorno de la interfaz y va en un solo lugar por
 * pantalla: el sello con la fecha del inicio (celular y escritorio) y la
 * marca del menú lateral. No lo repitas como decoración en otras pantallas;
 * pierde fuerza.
 *
 * SVG puro, sin JS: sirve en Server Components. Toma el color del texto
 * (`currentColor`), así que se pinta con una clase `text-*`.
 */

const SPOKES =
  "M76 60L105 60M75.5 64.1L103.5 71.6M73.9 68L99 82.5M71.3 71.3L91.8 91.8M68 73.9L82.5 99M64.1 75.5L71.6 103.5M60 76L60 105M55.9 75.5L48.4 103.5M52 73.9L37.5 99M48.7 71.3L28.2 91.8M46.1 68L21 82.5M44.5 64.1L16.5 71.6M44 60L15 60M44.5 55.9L16.5 48.4M46.1 52L21 37.5M48.7 48.7L28.2 28.2M52 46.1L37.5 21M55.9 44.5L48.4 16.5M60 44L60 15M64.1 44.5L71.6 16.5M68 46.1L82.5 21M71.3 48.7L91.8 28.2M73.9 52L99 37.5M75.5 55.9L103.5 48.4";

const WEB =
  "91 60 104.6 65.9 89.9 68 101.6 77.2 86.8 75.5 95.7 87.4 81.9 81.9 87.4 95.7 75.5 86.8 77.2 101.6 68 89.9 65.9 104.6 60 91 54.1 104.6 52 89.9 42.8 101.6 44.5 86.8 32.6 95.7 38.1 81.9 24.3 87.4 33.2 75.5 18.4 77.2 30.1 68 15.4 65.9 29 60 15.4 54.1 30.1 52 18.4 42.8 33.2 44.5 24.3 32.6 38.1 38.1 32.6 24.3 44.5 33.2 42.8 18.4 52 30.1 54.1 15.4 60 29 65.9 15.4 68 30.1 77.2 18.4 75.5 33.2 87.4 24.3 81.9 38.1 95.7 32.6 86.8 44.5 101.6 42.8 89.9 52 104.6 54.1 91 60";

const PETALS: [number, number][] = [
  [110.2, 73.5], [96.8, 96.8], [73.5, 110.2], [46.5, 110.2], [23.2, 96.8], [9.8, 73.5],
  [9.8, 46.5], [23.2, 23.2], [46.5, 9.8], [73.5, 9.8], [96.8, 23.2], [110.2, 46.5],
];

/**
 * El rosetón. `detail="simple"` es para tamaños chicos (la marca del menú):
 * sin la trama ni los pétalos, que a 40px se empastan.
 */
export function Nanduti({
  className,
  strokeWidth = 1,
  detail = "full",
}: {
  className?: string;
  strokeWidth?: number;
  detail?: "full" | "simple";
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
      className={className}
    >
      <circle cx="60" cy="60" r="16" />
      <circle cx="60" cy="60" r="45" />
      <path d={SPOKES} />
      {detail === "full" && (
        <>
          <circle cx="60" cy="60" r="31" />
          <polyline points={WEB} />
          {PETALS.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" />
          ))}
        </>
      )}
    </svg>
  );
}

/**
 * Sello del día: el ñandutí con el número del día y el mes en el centro.
 * `today` es `yyyy-MM-dd` en la zona de la familia (nunca la del
 * dispositivo). El texto accesible es la fecha completa.
 */
export function SelloDelDia({
  today,
  className,
  discClassName,
}: {
  today: string;
  /** Tamaño y color del rosetón (`size-*`, `text-*`). */
  className?: string;
  /** Tamaño del disco central y de su número. */
  discClassName?: string;
}) {
  const date = dateOnlyToFamilyMidnightUtc(today);
  return (
    <div
      role="img"
      aria-label={formatDate(date, "EEEE d 'de' MMMM")}
      className={cn("relative shrink-0", className)}
    >
      <Nanduti className="size-full" strokeWidth={1.2} />
      <div
        className={cn(
          "absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-card leading-none",
          discClassName,
        )}
      >
        <span className="font-heading font-bold tracking-tight text-primary">{formatDate(date, "d")}</span>
        <span className="mt-0.5 text-[0.4em] font-bold text-warning">{formatDate(date, "MMM")}</span>
      </div>
    </div>
  );
}
