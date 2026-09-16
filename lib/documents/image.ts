// Compresión de imágenes en el cliente antes de subir un documento. Vive
// separado de lib/documents/storage.ts (que es server-only) porque esto
// corre en el navegador — canvas, Image, Blob no existen en el servidor.
//
// Usa `createImageBitmap(file, { imageOrientation: "from-image" })` en
// vez de parsear a mano el metadato EXIF: los navegadores modernos ya
// saben leer la rotación de una foto de celular y entregarla derecha, es
// la misma información que un parser manual tendría que reconstruir con
// más código y más superficie de bugs.

import { IMAGE_JPEG_QUALITY, IMAGE_MAX_DIMENSION, MAX_DOCUMENT_FILE_BYTES } from "./constants";

export type CompressedFile = {
  blob: Blob;
  name: string;
  contentType: string;
  usedFallback: boolean;
};

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function replaceExtension(name: string, ext: string): string {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  return `${base}.${ext}`;
}

/**
 * Comprime una foto: lado mayor ≤ 1600px, JPEG al 80%. Si el navegador no
 * puede decodificar el archivo (HEIC de iPhone que no se convirtió solo,
 * formato raro), sube el original sin comprimir en vez de fallar — un
 * documento pesado guardado es mejor que un documento perdido. Los PDF
 * nunca pasan por acá: van directo, solo con el límite de tamaño.
 */
export async function compressDocumentImage(file: File): Promise<CompressedFile> {
  if (isPdf(file)) {
    return { blob: file, name: file.name, contentType: file.type || "application/pdf", usedFallback: false };
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto de canvas.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY),
    );
    if (!blob) throw new Error("No se pudo generar la imagen comprimida.");

    return { blob, name: replaceExtension(file.name, "jpg"), contentType: "image/jpeg", usedFallback: false };
  } catch {
    return { blob: file, name: file.name, contentType: file.type || "application/octet-stream", usedFallback: true };
  }
}

export function validateDocumentFileSize(sizeBytes: number): string | null {
  if (sizeBytes > MAX_DOCUMENT_FILE_BYTES) {
    return `El archivo pesa más de ${Math.round(MAX_DOCUMENT_FILE_BYTES / (1024 * 1024))} MB, el límite permitido.`;
  }
  return null;
}
