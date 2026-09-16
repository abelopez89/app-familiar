import { House } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-8 px-5 py-10"
      style={{ paddingTop: "calc(var(--safe-top) + 2.5rem)", paddingBottom: "calc(var(--safe-bottom) + 2.5rem)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
          <House className="size-7 text-primary-foreground" />
        </span>
        <div className="text-center">
          <p className="text-xl font-semibold tracking-tight">App Familiar</p>
          <p className="text-sm text-muted-foreground">Organizá la vida doméstica de tu familia</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
