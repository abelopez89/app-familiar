import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getGroupBundle } from "@/lib/expenses/queries";
import { listActiveMembers } from "@/lib/members";
import { PageHeader } from "@/components/app-shell/page-header";
import { ParticipantsManager } from "./participants-manager";

export default async function ParticipantesPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const [bundle, members] = await Promise.all([getGroupBundle(id), listActiveMembers()]);
  if (!bundle) notFound();

  const inGroup = new Set(bundle.participants.map((p) => p.member_id).filter(Boolean));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Participantes" description={bundle.group.name} />
      <ParticipantsManager
        groupId={id}
        participants={bundle.participants}
        availableMembers={members.filter((m) => !inGroup.has(m.id))}
      />
    </div>
  );
}
