// Cell formatters shared by inventory and commitments command renderers.
// These are pure, leaf-level value transforms — they don't know about
// ComponentRenderFormat and don't render whole rows or tables.

export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export function formatPercentage(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(1)}%`;
}

export function formatPriceMonthly(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatCommitmentHourly(value: number): string {
  return `$${value.toFixed(4)}`;
}
