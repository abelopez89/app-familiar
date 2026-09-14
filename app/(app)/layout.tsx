import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { getCurrentFamilyContext } from "@/lib/family";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentFamilyContext();

  if (!context) {
    // El middleware ya garantiza que hay sesión; si no hay miembro
    // vinculado todavía (el trigger de alta no corrió o falló), no hay
    // familia para mostrar.
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader familyName={context.family.name} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
