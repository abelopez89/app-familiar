/**
 * Versionado de las promos cargadas a mano (Sudameris, BASA): cuando una
 * carga nueva coincide con una que ya está (mismo título o comercio), la
 * nueva la reemplaza. Esto solo sirve para avisar en la vista previa si la
 * que ya está parece más nueva que la que se está por cargar (un PDF viejo
 * subido por error): primero se compara la vigencia, después la versión
 * del documento. Puro.
 */

type ConVersion = { vigencia_hasta: string | null; version_doc: string | null };

/** "V2 – 15/10/2026" → 2; sin número de versión, null. */
function numeroVersion(version: string | null): number | null {
  const m = version?.match(/\bv(?:ersi[oó]n)?\s*\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Fecha dd/mm/aaaa dentro de la versión, como yyyy-MM-dd. */
function fechaVersion(version: string | null): string | null {
  const m = version?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function existenteEsMasNueva(existente: ConVersion, nueva: ConVersion): boolean {
  if (existente.vigencia_hasta && nueva.vigencia_hasta && existente.vigencia_hasta !== nueva.vigencia_hasta) {
    return existente.vigencia_hasta > nueva.vigencia_hasta;
  }
  const fe = fechaVersion(existente.version_doc);
  const fn = fechaVersion(nueva.version_doc);
  if (fe && fn && fe !== fn) return fe > fn;
  const ve = numeroVersion(existente.version_doc);
  const vn = numeroVersion(nueva.version_doc);
  if (ve !== null && vn !== null) return ve > vn;
  return false;
}
