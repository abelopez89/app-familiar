import { Nanduti } from "@/components/app-shell/nanduti";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-8 px-5 py-10"
      style={{ paddingTop: "calc(var(--safe-top) + 2.5rem)", paddingBottom: "calc(var(--safe-bottom) + 2.5rem)" }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Marca: el ñandutí sobre el verde, igual que en el menú de escritorio. */}
        <span className="flex size-16 items-center justify-center rounded-full bg-brand">
          <Nanduti detail="simple" strokeWidth={4} className="size-10 text-brand-muted" />
        </span>
        <div className="text-center">
          <p className="font-heading text-2xl font-bold tracking-tight">App Familiar</p>
          <p className="text-sm text-muted-foreground">Organizá la vida doméstica de tu familia</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
