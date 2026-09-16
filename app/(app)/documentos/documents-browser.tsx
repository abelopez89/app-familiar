"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Pin, Plus, Search } from "lucide-react";
import type { DocumentCategory, FamilyMember } from "@/lib/supabase/types";
import type { DocumentWithFiles } from "@/lib/documents/queries";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/constants";
import { formatDate } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesSearch(doc: DocumentWithFiles, query: string): boolean {
  if (!query) return true;
  const haystack = normalize([doc.title, ...(doc.tags ?? [])].join(" "));
  return haystack.includes(normalize(query));
}

export function DocumentsBrowser({
  documents,
  categories,
  members,
  thumbnails,
}: {
  documents: DocumentWithFiles[];
  categories: DocumentCategory[];
  members: FamilyMember[];
  thumbnails: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = documents.filter((doc) => {
    if (!matchesSearch(doc, query)) return false;
    if (memberFilter === "familia" && doc.member_id) return false;
    if (memberFilter && memberFilter !== "familia" && doc.member_id !== memberFilter) return false;
    if (categoryFilter && doc.category_id !== categoryFilter) return false;
    return true;
  });

  const pinned = filtered.filter((d) => d.is_pinned);
  const recent = filtered.filter((d) => !d.is_pinned);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o tag…"
          className="pl-9"
        />
      </div>

      <Button asChild className="gap-2">
        <Link href="/documentos/nuevo">
          <Plus className="size-4" />
          Nuevo documento
        </Link>
      </Button>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Todos" active={!memberFilter} onClick={() => setMemberFilter(null)} />
        <FilterChip label="De la familia" active={memberFilter === "familia"} onClick={() => setMemberFilter("familia")} />
        {members.map((m) => (
          <FilterChip
            key={m.id}
            label={m.display_name}
            color={m.color}
            active={memberFilter === m.id}
            onClick={() => setMemberFilter(m.id)}
          />
        ))}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip label="Todas las categorías" active={!categoryFilter} onClick={() => setCategoryFilter(null)} />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={categoryFilter === c.id}
              onClick={() => setCategoryFilter(c.id)}
            />
          ))}
        </div>
      )}

      {pinned.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Fijados</h2>
          <div className="grid grid-cols-2 gap-3">
            {pinned.map((doc) => (
              <Link key={doc.id} href={`/documentos/${doc.id}`}>
                <Card className="overflow-hidden">
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    {thumbnails[doc.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnails[doc.id]} alt={doc.title} className="size-full object-cover" />
                    ) : (
                      <FileText className="size-10 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="flex flex-col gap-0.5 p-2.5">
                    <span className="flex items-center gap-1 truncate text-sm font-medium">
                      <Pin className="size-3 shrink-0 text-primary" />
                      {doc.title}
                    </span>
                    {doc.member_id && (
                      <span className="text-xs text-muted-foreground">
                        {membersById.get(doc.member_id)?.display_name}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Recientes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {documents.length === 0 ? "Todavía no cargaste ningún documento." : "No hay documentos que coincidan."}
          </p>
        ) : (
          <Card>
            <CardContent className="flex flex-col divide-y p-0">
              {recent.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documentos/${doc.id}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{doc.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        doc.doc_type ? DOCUMENT_TYPE_LABELS[doc.doc_type] : null,
                        doc.category_id ? categoriesById.get(doc.category_id)?.name : null,
                        doc.member_id ? membersById.get(doc.member_id)?.display_name : "De la familia",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-primary bg-primary/10" : ""
      }`}
    >
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}
