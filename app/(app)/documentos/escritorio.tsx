import Link from "next/link";
import { Download, ExternalLink, FileText, GraduationCap, Pencil, Pin, Plus, Search } from "lucide-react";
import type { DocumentCategory, FamilyMember } from "@/lib/supabase/types";
import type { DocumentWithFiles } from "@/lib/documents/queries";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/constants";
import { isDocumentExpiryDue } from "@/lib/documents/schedule";
import { getSignedDocumentUrls } from "@/lib/documents/storage";
import { formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";

export type DocumentosParams = {
  miembro?: string;
  categoria?: string;
  vence?: string;
  q?: string;
  doc?: string;
  pagina?: string;
};

/** Misma normalización que el buscador del celular (`documents-browser.tsx`). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * `/documentos` con los parámetros actuales más los cambios. Cambiar un
 * filtro suelta el documento seleccionado (puede quedar fuera de la lista);
 * elegir un documento conserva los filtros.
 */
function hrefWith(params: DocumentosParams, changes: Partial<DocumentosParams>): string {
  const next: DocumentosParams = { ...params, ...changes };
  if (!("doc" in changes)) {
    delete next.doc;
    delete next.pagina;
  }
  if ("doc" in changes && !("pagina" in changes)) delete next.pagina;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) if (value) search.set(key, value);
  const qs = search.toString();
  return qs ? `/documentos?${qs}` : "/documentos";
}

/**
 * Documentos en escritorio (`lg:`): filtros a la izquierda (los mismos
 * del celular, como parámetros de la URL), fijados y tabla en el centro, y
 * vista previa a la derecha. Elegir una fila no navega: agrega
 * `?doc=<id>` y el servidor firma las URLs de ese documento recién ahí,
 * con el cliente de sesión (regla 2 de la Fase 5). En el celular la fila
 * sigue abriendo `/documentos/[id]`.
 */
export async function DocumentosEscritorio({
  documents,
  categories,
  members,
  thumbnails,
  params,
  conCalificaciones,
}: {
  documents: DocumentWithFiles[];
  categories: DocumentCategory[];
  members: FamilyMember[];
  thumbnails: Record<string, string>;
  params: DocumentosParams;
  conCalificaciones: boolean;
}) {
  const today = todayInFamilyTimezone();
  const membersById = new Map(members.map((m) => [m.id, m]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const isDue = (d: DocumentWithFiles) => isDocumentExpiryDue(d, today);

  const query = params.q?.trim() ?? "";
  const filtered = documents.filter((doc) => {
    if (query && !normalize([doc.title, ...(doc.tags ?? [])].join(" ")).includes(normalize(query))) return false;
    if (params.miembro === "familia" && doc.member_id) return false;
    if (params.miembro && params.miembro !== "familia" && doc.member_id !== params.miembro) return false;
    if (params.categoria && doc.category_id !== params.categoria) return false;
    if (params.vence === "1" && !isDue(doc)) return false;
    return true;
  });
  const pinned = filtered.filter((d) => d.is_pinned);
  const rest = filtered.filter((d) => !d.is_pinned);
  const selected = params.doc ? (documents.find((d) => d.id === params.doc) ?? null) : null;

  const { fg, bg } = MODULES_BY_KEY.documentos;
  const memberLabel = (doc: DocumentWithFiles) =>
    doc.member_id ? (membersById.get(doc.member_id)?.display_name ?? "—") : "De la familia";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documentos"
        icon={FileText}
        iconFg={fg}
        iconBg={bg}
        actions={
          <>
            <form action="/documentos" className="relative">
              {params.miembro && <input type="hidden" name="miembro" value={params.miembro} />}
              {params.categoria && <input type="hidden" name="categoria" value={params.categoria} />}
              {params.vence && <input type="hidden" name="vence" value={params.vence} />}
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={query} placeholder="Buscar por título o tag…" className="w-64 pl-9" />
            </form>
            {conCalificaciones && (
              <Button asChild variant="outline">
                <Link href="/documentos/calificaciones">
                  <GraduationCap className="size-4" />
                  Calificaciones
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/documentos/nuevo">
                <Plus className="size-4" />
                Nuevo documento
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[10rem_minmax(0,1fr)_17rem] items-start gap-5">
        {/* 1. Filtros */}
        <nav className="flex flex-col gap-5 text-sm" aria-label="Filtros">
          <FiltroGrupo titulo="Miembro">
            <Filtro href={hrefWith(params, { miembro: undefined })} active={!params.miembro} label="Todos" count={documents.length} />
            <Filtro
              href={hrefWith(params, { miembro: "familia" })}
              active={params.miembro === "familia"}
              label="De la familia"
              count={documents.filter((d) => !d.member_id).length}
            />
            {members.map((m) => (
              <Filtro
                key={m.id}
                href={hrefWith(params, { miembro: m.id })}
                active={params.miembro === m.id}
                label={m.display_name}
                color={m.color}
                count={documents.filter((d) => d.member_id === m.id).length}
              />
            ))}
          </FiltroGrupo>
          {categories.length > 0 && (
            <FiltroGrupo titulo="Categoría">
              <Filtro href={hrefWith(params, { categoria: undefined })} active={!params.categoria} label="Todas" />
              {categories.map((c) => (
                <Filtro
                  key={c.id}
                  href={hrefWith(params, { categoria: c.id })}
                  active={params.categoria === c.id}
                  label={c.name}
                  count={documents.filter((d) => d.category_id === c.id).length}
                />
              ))}
            </FiltroGrupo>
          )}
          <FiltroGrupo titulo="Vencimiento">
            <Filtro
              href={hrefWith(params, { vence: params.vence === "1" ? undefined : "1" })}
              active={params.vence === "1"}
              label="Por vencer"
              count={documents.filter(isDue).length}
            />
          </FiltroGrupo>
        </nav>

        {/* 2. Fijados y tabla */}
        <div className="flex min-w-0 flex-col gap-5">
          {pinned.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>Fijados</SectionTitle>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {pinned.map((doc) => (
                  <Link
                    key={doc.id}
                    href={hrefWith(params, { doc: doc.id })}
                    scroll={false}
                    className={cn(
                      "overflow-hidden hoja transition-colors hover:border-ring/40",
                      selected?.id === doc.id && "ring-2 ring-primary",
                    )}
                  >
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                      {thumbnails[doc.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnails[doc.id]} alt={doc.title} loading="lazy" decoding="async" className="size-full object-cover" />
                      ) : (
                        <FileText className="size-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 p-2.5">
                      <span className="flex items-center gap-1 truncate text-sm font-medium">
                        <Pin className="size-3 shrink-0 text-mod-documentos" />
                        <span className="truncate">{doc.title}</span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{memberLabel(doc)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionTitle>{pinned.length > 0 ? "Los demás" : "Todos"}</SectionTitle>
            {rest.length === 0 ? (
              <p className="hoja px-4 py-8 text-center text-sm text-muted-foreground">
                {documents.length === 0
                  ? "Todavía no cargaste ningún documento."
                  : "No hay documentos que coincidan con los filtros."}
              </p>
            ) : (
              <div className="overflow-hidden hoja text-sm" role="table">
                <div
                  role="row"
                  className="grid grid-cols-[minmax(0,1fr)_6rem_5.5rem_2.5rem] 2xl:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_5.5rem_2.5rem] gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground"
                >
                  <span role="columnheader">Documento</span>
                  <span role="columnheader">Miembro</span>
                  {/* Por debajo de 2xl (1536px) la categoría va debajo del título: con
                      el menú, los filtros y la vista previa no entra una
                      columna más sin aplastar el nombre del documento. */}
                  <span role="columnheader" className="hidden 2xl:block">
                    Categoría
                  </span>
                  <span role="columnheader">Vence</span>
                  <span role="columnheader" className="text-right">
                    Págs.
                  </span>
                </div>
                {rest.map((doc) => {
                  const due = isDue(doc);
                  const expired = doc.expires_at !== null && doc.expires_at < today;
                  return (
                    <Link
                      key={doc.id}
                      role="row"
                      href={hrefWith(params, { doc: doc.id })}
                      scroll={false}
                      aria-current={selected?.id === doc.id ? "true" : undefined}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_6rem_5.5rem_2.5rem] 2xl:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_5.5rem_2.5rem] items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-b-0",
                        selected?.id === doc.id ? "bg-accent" : "hover:bg-muted/60",
                      )}
                    >
                      <span role="cell" className="flex min-w-0 items-center gap-2.5">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{doc.title}</span>
                          {(doc.doc_type || doc.category_id) && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {doc.doc_type ? (DOCUMENT_TYPE_LABELS[doc.doc_type] ?? doc.doc_type) : null}
                              {doc.category_id && (
                                <span className="2xl:hidden">
                                  {doc.doc_type ? " · " : ""}
                                  {categoriesById.get(doc.category_id)?.name}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </span>
                      <span role="cell" className="truncate text-muted-foreground">
                        {memberLabel(doc)}
                      </span>
                      <span role="cell" className="hidden truncate text-muted-foreground 2xl:block">
                        {doc.category_id ? (categoriesById.get(doc.category_id)?.name ?? "—") : "—"}
                      </span>
                      <span
                        role="cell"
                        className={cn(
                          "truncate tabular-nums",
                          expired ? "font-medium text-destructive" : due ? "font-medium text-warning" : "text-muted-foreground",
                        )}
                      >
                        {doc.expires_at ? formatDate(doc.expires_at, "dd/MM/yy") : "—"}
                      </span>
                      <span role="cell" className="text-right tabular-nums text-muted-foreground">
                        {doc.files.length}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* 3. Vista previa */}
        <aside className="sticky top-8 flex flex-col gap-4 hoja p-4">
          {selected ? (
            <VistaPrevia
              doc={selected}
              pagina={params.pagina}
              params={params}
              memberLabel={memberLabel(selected)}
              categoryLabel={selected.category_id ? categoriesById.get(selected.category_id)?.name : undefined}
              today={today}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-sm text-muted-foreground">
              <FileText className="size-8" />
              Elegí un documento para verlo acá.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FiltroGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1 text-sm font-bold text-muted-foreground">{titulo}</p>
      {children}
    </div>
  );
}

function Filtro({
  href,
  active,
  label,
  count,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg px-2.5 transition-colors",
        active ? "bg-card font-medium text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
      )}
    >
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Link>
  );
}

async function VistaPrevia({
  doc,
  pagina,
  params,
  memberLabel,
  categoryLabel,
  today,
}: {
  doc: DocumentWithFiles;
  pagina?: string;
  params: DocumentosParams;
  memberLabel: string;
  categoryLabel?: string;
  today: string;
}) {
  // Firmadas recién ahora, con el cliente de sesión, todas en una llamada.
  const urls = await getSignedDocumentUrls(doc.files.map((f) => f.storage_path));
  const index = Math.min(Math.max(0, Number.parseInt(pagina ?? "0", 10) || 0), Math.max(0, doc.files.length - 1));
  const current = doc.files[index];
  const currentUrl = urls[index];
  const isImage = (mime: string | null) => mime?.startsWith("image/") ?? false;
  const expired = doc.expires_at !== null && doc.expires_at < today;
  const due = isDocumentExpiryDue(doc, today);

  const meta: [string, React.ReactNode][] = [
    ["Tipo", doc.doc_type ? (DOCUMENT_TYPE_LABELS[doc.doc_type] ?? doc.doc_type) : null],
    ["Miembro", memberLabel],
    ["Categoría", categoryLabel ?? null],
    ["Emitido", doc.issued_at ? formatDate(doc.issued_at) : null],
    [
      "Vence",
      doc.expires_at ? (
        <span className={cn(expired ? "font-medium text-destructive" : due && "font-medium text-warning")}>
          {formatDate(doc.expires_at, "d 'de' MMMM yyyy")}
        </span>
      ) : null,
    ],
    ["Tags", doc.tags && doc.tags.length > 0 ? doc.tags.join(", ") : null],
    ["Notas", doc.notes],
  ];

  return (
    <>
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-lg font-bold leading-snug">{doc.title}</h2>
        {doc.is_pinned && <Pin className="mt-1 size-4 shrink-0 fill-primary text-primary" aria-label="Fijado" />}
      </div>

      {doc.files.length === 0 ? (
        <p className="rounded-xl bg-muted px-3 py-8 text-center text-sm text-muted-foreground">Sin páginas.</p>
      ) : (
        <>
          <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-muted">
            {isImage(current.mime_type) && currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt={`${doc.title}, página ${index + 1}`} className="size-full object-contain" />
            ) : (
              <a
                href={`/documentos/${doc.id}/archivo?pagina=${index}`}
                target="_blank"
                rel="noopener"
                className="flex flex-col items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <FileText className="size-10" />
                {current.mime_type === "application/pdf" ? "Ver PDF" : "Abrir archivo"}
              </a>
            )}
          </div>
          {doc.files.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {doc.files.map((file, i) => (
                <Link
                  key={file.id}
                  href={hrefWith(params, { doc: doc.id, pagina: String(i) })}
                  scroll={false}
                  aria-label={`Página ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
                    i === index && "ring-2 ring-primary",
                  )}
                >
                  {isImage(file.mime_type) && urls[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls[i]!} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{i + 1}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {meta
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        <dt className="text-muted-foreground">Páginas</dt>
        <dd>{doc.files.length}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/documentos/${doc.id}`}>
            <ExternalLink className="size-4" />
            Abrir
          </Link>
        </Button>
        {doc.files.length > 0 && (
          <Button asChild variant="outline">
            <a href={`/documentos/${doc.id}/archivo?pagina=${index}&descargar=1`}>
              <Download className="size-4" />
              Descargar
            </a>
          </Button>
        )}
        {/* El diálogo de edición vive en el detalle (`?editar=1` lo abre al
            entrar): importarlo acá sumaba ~50 kB al JS de /documentos, que
            también paga el celular. */}
        <Button asChild variant="outline">
          <Link href={`/documentos/${doc.id}?editar=1`}>
            <Pencil className="size-4" />
            Editar
          </Link>
        </Button>
      </div>
    </>
  );
}
