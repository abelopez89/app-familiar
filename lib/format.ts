const pyg = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0,
});

export function formatGuaranies(amount: number): string {
  return pyg.format(amount);
}

export function formatQuantity(quantity: number, unit: string): string {
  const formatted = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${unit}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
