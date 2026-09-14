import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { MembersList } from "./members-list";

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
      <h1 className="text-xl font-semibold">Miembros</h1>
      <MembersList members={members ?? []} />
    </div>
  );
}
