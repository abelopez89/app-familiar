"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import { attachDocumentFile, deleteDocument } from "../../actions";
import {
  crearDocumentoInforme,
  guardarInforme,
  leerInforme,
  type BorradorInforme,
  type MesCargado,
} from "../actions";
import { uploadDocumentFileFromBrowser } from "@/lib/documents/browser-upload";
import { validateDocumentFileSize } from "@/lib/documents/image";
import { MONTH_NAMES } from "@/lib/calificaciones/parse";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Member = { id: string; display_name: string };
type Fila = { key: string; subject: string; points: string; maxPoints: string; observations: string };

function texto(n: number | null): string {
  return n === null ? "" : String(n);
}

function numero(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function nuevaKey() {
  return Math.random().toString(36).slice(2);
}

export function CargarInforme({
  members,
  documento,
}: {
  members: Member[];
  documento: { id: string; title: string; member_id: string | null } | null;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<"elegir" | "leyendo" | "revisar">(documento ? "leyendo" : "elegir");
  const [estado, setEstado] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(documento?.id ?? null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [memberId, setMemberId] = useState(documento?.member_id ?? "");
  const [mesesCargados, setMesesCargados] = useState<MesCargado[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [grade, setGrade] = useState("");
  const [late, setLate] = useState("");
  const [absences, setAbsences] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const leidoInicial = useRef(false);

  function cargarBorrador(b: BorradorInforme, cargados: MesCargado[]) {
    if (b.memberId) setMemberId(b.memberId);
    setMonth(b.month ? String(b.month) : "");
    setYear(texto(b.year));
    setGrade(b.grade ?? "");
    setLate(texto(b.lateArrivals));
    setAbsences(texto(b.absences));
    setFilas(
      b.scores.map((s) => ({
        key: nuevaKey(),
        subject: s.subject,
        points: String(s.points),
        maxPoints: String(s.maxPoints),
        observations: s.observations ?? "",
      })),
    );
    setWarnings(b.warnings);
    setGuardado(b.guardado);
    setMesesCargados(cargados);
    setPaso("revisar");
  }

  async function leer(docId: string) {
    setPaso("leyendo");
    setEstado("Leyendo los puntajes…");
    const res = await leerInforme(docId);
    if (res.error || !res.borrador) {
      toast.error(res.error ?? "No se pudo leer el informe.");
      setPaso(documento ? "revisar" : "elegir");
      return;
    }
    cargarBorrador(res.borrador, res.mesesCargados ?? []);
  }

  useEffect(() => {
    if (documento && !leidoInicial.current) {
      leidoInicial.current = true;
      void leer(documento.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subirYLeer() {
    if (!archivo) return toast.error("Elegí el PDF del informe.");
    if (!memberId) return toast.error("Elegí a quién es el informe.");
    const sizeError = validateDocumentFileSize(archivo.size);
    if (sizeError) return toast.error(sizeError);

    setPaso("leyendo");
    setEstado("Guardando el PDF en Documentos…");
    const creado = await crearDocumentoInforme(memberId, archivo.name);
    if (creado.error || !creado.documentId || !creado.path) {
      toast.error(creado.error ?? "No se pudo crear el documento.");
      return setPaso("elegir");
    }
    const subido = await uploadDocumentFileFromBrowser(creado.path, archivo, "application/pdf");
    const registrado = subido.error
      ? { error: subido.error }
      : await attachDocumentFile(creado.documentId, {
          path: creado.path,
          mimeType: "application/pdf",
          sizeBytes: archivo.size,
          sortOrder: 0,
        });
    if (registrado.error) {
      // Sin el PDF, el documento quedaría vacío en Documentos.
      await deleteDocument(creado.documentId);
      toast.error(registrado.error);
      return setPaso("elegir");
    }
    setDocumentId(creado.documentId);
    await leer(creado.documentId);
  }

  async function guardar() {
    if (!documentId) return;
    const scores = filas.map((f) => ({
      subject: f.subject,
      points: numero(f.points) ?? Number.NaN,
      maxPoints: numero(f.maxPoints) ?? Number.NaN,
      observations: f.observations.trim() || null,
    }));
    setGuardando(true);
    const res = await guardarInforme({
      documentId,
      memberId,
      year: numero(year) ?? Number.NaN,
      month: Number(month) || 0,
      grade: grade.trim() || null,
      lateArrivals: numero(late),
      absences: numero(absences),
      scores,
    });
    setGuardando(false);
    if (res.error) return toast.error(res.error);
    toast.success("Calificaciones guardadas.");
    router.push(`/documentos/${documentId}`);
    router.refresh();
  }

  function cambiarFila(key: string, patch: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  const memberSelect = (
    <div className="flex flex-col gap-1.5">
      <Label>De quién es</Label>
      <Select value={memberId} onValueChange={setMemberId}>
        <SelectTrigger>
          <SelectValue placeholder="Elegí un hijo" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (paso === "elegir") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          {memberSelect}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="informe-pdf">Informe en PDF</Label>
            <Input
              id="informe-pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Se guarda en Documentos como &quot;Calificaciones&quot; y después revisás lo que se leyó.
            </p>
          </div>
          <Button onClick={subirYLeer} disabled={!archivo || !memberId}>
            Leer informe
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (paso === "leyendo") {
    return <p className="text-sm text-muted-foreground">{estado || "Leyendo…"}</p>;
  }

  const mesNum = Number(month);
  const anioNum = numero(year);
  const reemplaza = mesesCargados.find(
    (m) => m.memberId === memberId && m.year === anioNum && m.month === mesNum && m.documentId !== documentId,
  );

  return (
    <div className="flex flex-col gap-4">
      {warnings.length > 0 && (
        <Card className="border-warning">
          <CardContent className="flex flex-col gap-1 pt-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 text-warning" />
              Revisá antes de guardar
            </p>
            {warnings.map((w) => (
              <p key={w} className="text-muted-foreground">
                {w}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-4">
          <div className="col-span-2">{memberSelect}</div>
          <div className="flex flex-col gap-1.5">
            <Label>Mes</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anio">Año</Label>
            <Input id="anio" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="aula">Grado</Label>
            <Input id="aula" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tardias">Llegadas tardías</Label>
            <Input id="tardias" inputMode="numeric" value={late} onChange={(e) => setLate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ausencias">Ausencias</Label>
            <Input id="ausencias" inputMode="numeric" value={absences} onChange={(e) => setAbsences(e.target.value)} />
          </div>
          {reemplaza && (
            <p className="col-span-2 text-sm text-warning">
              Ya hay un informe de {MONTH_NAMES[mesNum - 1]} {anioNum} cargado: se reemplazan sus puntajes.
            </p>
          )}
          {guardado && (
            <p className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5" />
              Estos son los puntajes guardados. Corregí lo que haga falta.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Materias ({filas.length})</span>
        <p className="text-xs text-muted-foreground">
          Las materias sin evaluar ese mes (0/0) no se cargan.
        </p>
        {filas.map((f) => {
          const p = numero(f.points);
          const m = numero(f.maxPoints);
          const pct = p !== null && m ? Math.round((p / m) * 100) : null;
          return (
            <Card key={f.key}>
              <CardContent className="flex flex-col gap-2 pt-4">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Materia"
                    value={f.subject}
                    onChange={(e) => cambiarFila(f.key, { subject: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar materia"
                    onClick={() => setFilas((prev) => prev.filter((x) => x.key !== f.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <DecimalInput
                    aria-label="Puntos logrados"
                    className="w-20"
                    value={f.points}
                    onChange={(e) => cambiarFila(f.key, { points: e.target.value })}
                  />
                  <span className="text-muted-foreground">/</span>
                  <DecimalInput
                    aria-label="Puntos posibles"
                    className="w-20"
                    value={f.maxPoints}
                    onChange={(e) => cambiarFila(f.key, { maxPoints: e.target.value })}
                  />
                  {pct !== null && (
                    <span className={pct > 100 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                      {pct}%
                    </span>
                  )}
                </div>
                <Textarea
                  aria-label="Observaciones"
                  placeholder="Observaciones"
                  rows={2}
                  value={f.observations}
                  onChange={(e) => cambiarFila(f.key, { observations: e.target.value })}
                />
              </CardContent>
            </Card>
          );
        })}
        <Button
          variant="outline"
          className="gap-2"
          onClick={() =>
            setFilas((prev) => [...prev, { key: nuevaKey(), subject: "", points: "", maxPoints: "", observations: "" }])
          }
        >
          <Plus className="size-4" />
          Agregar materia
        </Button>
      </div>

      <Button onClick={guardar} disabled={guardando || filas.length === 0}>
        {guardando ? "Guardando…" : "Guardar calificaciones"}
      </Button>
    </div>
  );
}
