import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { MembersList } from "./members-list";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function ConfigMiembrosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("family_members")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Miembros" description="Tocá un miembro para ver su ficha completa" />
      <MembersList members={members ?? []} />
    </div>
  );
}
