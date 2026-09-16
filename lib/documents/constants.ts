import type { DocumentCategoryKind } from "@/lib/supabase/types";

export const DOCUMENTS_BUCKET = "documentos";

// Límites que además están fijados a nivel plataforma en la config del
// bucket (file_size_limit / allowed_mime_types) — ver la nota al inicio
// de supabase/migrations/010_documentos.sql. Repetidos acá para poder dar
// un mensaje de error claro en el cliente antes de intentar subir.
export const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

// Parámetros de la compresión en el cliente — ver lib/documents/image.ts.
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_JPEG_QUALITY = 0.8;

export const SIGNED_URL_TTL_SECONDS = 60;

export const DOCUMENT_CATEGORY_KINDS: Record<DocumentCategoryKind, { label: string }> = {
  personal: { label: "Personal" },
  medico: { label: "Médico" },
  vehiculo: { label: "Vehículo" },
  hogar: { label: "Hogar" },
  educacion: { label: "Educación" },
  general: { label: "General" },
};

export const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "ci", label: "Cédula" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "seguro_medico", label: "Seguro médico" },
  { value: "estudio", label: "Estudio" },
  { value: "receta", label: "Receta" },
  { value: "reposo", label: "Reposo" },
  { value: "factura", label: "Factura" },
  { value: "manual", label: "Manual" },
  { value: "otro", label: "Otro" },
];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.label]),
);

export const DEFAULT_EXPIRY_LEAD_DAYS = 60;
