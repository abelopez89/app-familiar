import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { getCurrentFamilyContext } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentFamilyContext();

  if (!context) {
    // Hay sesión pero ningún miembro activo vinculado (el trigger de alta
    // no corrió o falló, o ensure_family_membership también falló).
    // Cerramos la sesión antes de redirigir: si no, el middleware ve
    // "hay usuario" en /login y rebota de nuevo a "/", generando un loop
    // infinito de redirects.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.error(
      "[app-layout] sesión sin family_member vinculado:",
      user?.id,
      user?.email,
    );
    await supabase.auth.signOut();
    redirect("/login?error=sin-familia");
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
