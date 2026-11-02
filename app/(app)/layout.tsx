import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { BackButton } from "@/components/app-shell/back-button";
import { Sidebar } from "@/components/app-shell/sidebar";
import { KeyboardDismiss } from "@/components/app-shell/keyboard-dismiss";
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
    <div className="flex min-h-screen flex-col lg:pl-(--sidebar-width)">
      {/* Escritorio (lg): el menú lateral reemplaza al header y al tab bar,
          que se ocultan con `lg:hidden`. En el celular el menú es `hidden`. */}
      <Sidebar
        familyName={context.family.name}
        memberName={context.member.display_name}
        memberColor={context.member.color}
      />
      <AppHeader familyName={context.family.name} />
      {/* `pb-nav` deja libre el alto del tab bar más el inset de seguridad
          del iPhone — un solo número, definido en globals.css, en vez de
          un `pb-24` distinto por pantalla. En escritorio `--nav-total` es
          solo el inset, y el contenido pasa a ser fluido y ancho. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-5 pb-nav lg:max-w-6xl lg:px-10 lg:pt-8">
        {/* Sin header en escritorio, el botón de volver global vive acá
            (mismo componente: no se muestra en las pantallas raíz). */}
        <div className="-mt-3 mb-3 hidden lg:block">
          <BackButton />
        </div>
        {children}
      </main>
      <BottomNav />
      <KeyboardDismiss />
    </div>
  );
}
