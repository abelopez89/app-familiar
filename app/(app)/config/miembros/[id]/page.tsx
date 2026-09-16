import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFamilyContext } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import { listDocumentCategories, listDocumentsByMember } from "@/lib/documents/queries";
import { listEventsWithDetails, listActiveMembers } from "@/lib/events/queries";
import { buildDisplayEvents } from "@/lib/events/view-model";
import { EVENT_CATEGORIES } from "@/lib/events/constants";
import { listPendingInstancesWithDetails } from "@/lib/tasks/queries";
import { formatDate, addDaysToDateOnly, dateOnlyToFamilyMidnightUtc, todayInFamilyTimezone } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberFormDialog } from "../member-form-dialog";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();

  const [memberRes, documents, categories, events, allMembers, taskInstances] = await Promise.all([
    supabase.from("family_members").select("*").eq("id", id).maybeSingle(),
    listDocumentsByMember(id),
    listDocumentCategories(),
    listEventsWithDetails(),
    listActiveMembers(),
    listPendingInstancesWithDetails(),
  ]);

  const member = memberRes.data;
  if (!member) notFound();

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const documentsByCategory = new Map<string, typeof documents>();
  const uncategorized: typeof documents = [];
  for (const doc of documents) {
    if (!doc.category_id) {
      uncategorized.push(doc);
      continue;
    }
    const list = documentsByCategory.get(doc.category_id) ?? [];
    list.push(doc);
    documentsByCategory.set(doc.category_id, list);
  }

  const today = todayInFamilyTimezone();
  const from = dateOnlyToFamilyMidnightUtc(today);
  const to = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 60));
  const upcomingEvents = buildDisplayEvents(events, allMembers, from, to).filter((e) =>
    e.participant_ids.includes(id),
  );

  const assignedTasks = taskInstances
    .filter((t) => t.definition.assigned_to === id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="size-9 shrink-0 rounded-full" style={{ backgroundColor: member.color }} />
            {member.display_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">{member.email ?? "Sin email"}</p>
          <div className="flex gap-2">
            <Badge variant={member.role === "adulto" ? "secondary" : "outline"}>
              {member.role === "adulto" ? "Adulto" : "Menor"}
            </Badge>
            {!member.can_login && <Badge variant="outline">Sin acceso</Badge>}
          </div>
          {member.birth_date && <p>Cumpleaños: {formatDate(member.birth_date, "d 'de' MMMM")}</p>}
          <div className="mt-2">
            <MemberFormDialog member={member} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos eventos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {upcomingEvents.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin eventos en los próximos 60 días.</p>
          ) : (
            upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span>{event.title}</span>
                  <span className="text-xs text-muted-foreground">{EVENT_CATEGORIES[event.category].label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(event.starts_at)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tareas asignadas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {assignedTasks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin tareas pendientes asignadas.</p>
          ) : (
            assignedTasks.map((instance) => (
              <Link
                key={instance.id}
                href={`/tareas/definiciones/${instance.definition.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>{instance.definition.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(instance.due_date)}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin documentos vinculados todavía.</p>
          ) : (
            <>
              {[...documentsByCategory.entries()].map(([categoryId, docs]) => (
                <div key={categoryId} className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    {categoriesById.get(categoryId)?.name ?? "Categoría"}
                  </h3>
                  <div className="flex flex-col divide-y rounded-lg border">
                    {docs.map((doc) => (
                      <Link key={doc.id} href={`/documentos/${doc.id}`} className="px-3 py-2 text-sm">
                        {doc.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold text-muted-foreground">Sin categoría</h3>
                  <div className="flex flex-col divide-y rounded-lg border">
                    {uncategorized.map((doc) => (
                      <Link key={doc.id} href={`/documentos/${doc.id}`} className="px-3 py-2 text-sm">
                        {doc.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
