import { redirect } from "next/navigation";
import { ChevronRight, CreditCard } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";
import { BANCOS, TIPOS_TARJETA } from "@/lib/promos/constants";
import { esBanco, nombreTarjeta } from "@/lib/promos/normalize";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NavGroup } from "@/components/ui/nav-row";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { FloatingAction } from "@/components/app-shell/floating-action";
import { CardFormDialog } from "./card-form-dialog";

/**
 * Mis tarjetas: las tarjetas de cada miembro, para filtrar las promos de
 * los bancos (lib/promos/matching.ts). Solo banco, marca, nivel, afinidad
 * y alias — nunca el número.
 */
export default async function TarjetasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const [members, { data: cards }] = await Promise.all([
    listActiveMembers(),
    supabase
      .from("tarjetas_familia")
      .select("*")
      .eq("family_id", context.family.id)
      .order("created_at"),
  ]);

  const grupos = members
    .map((member) => ({ member, cards: (cards ?? []).filter((c) => c.member_id === member.id) }))
    .filter((g) => g.cards.length > 0);

  return (
    <div className="flex flex-col gap-5 pb-nav">
      <PageHeader title="Mis tarjetas" description="Para avisarte solo las promos que te sirven" />

      {grupos.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Todavía no cargaste ninguna tarjeta"
          description="Cargá banco, marca y nivel de cada tarjeta de la familia. No hace falta el número."
        />
      ) : (
        grupos.map(({ member, cards: memberCards }) => (
          <section key={member.id} className="flex flex-col gap-2">
            <SectionTitle>{member.display_name}</SectionTitle>
            <NavGroup>
              {memberCards.map((card) => (
                <CardFormDialog
                  key={card.id}
                  card={card}
                  members={members}
                  defaultMemberId={member.id}
                  trigger={
                    <button
                      type="button"
                      className="tap-target flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <CreditCard className="size-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{card.alias}</span>
                          {!card.activa && <Badge variant="outline">Pausada</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[
                            esBanco(card.banco) ? BANCOS[card.banco].label : card.banco,
                            nombreTarjeta(card),
                            card.tipo !== "credito" ? TIPOS_TARJETA[card.tipo].label : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  }
                />
              ))}
            </NavGroup>
          </section>
        ))
      )}

      <FloatingAction>
        <CardFormDialog members={members} defaultMemberId={context.member.id} />
      </FloatingAction>
    </div>
  );
}
