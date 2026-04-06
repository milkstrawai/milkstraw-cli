import { prettyJson } from '../lib/json.js';

export type ComponentRenderFormat = 'text' | 'markdown';

export interface TableColumn {
  key: string;
  label: string;
}

export function normalizeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);

  return prettyJson(value);
}

export function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

export function renderByFormat(
  format: ComponentRenderFormat,
  renderText: () => string,
  renderMarkdown: () => string,
): string {
  switch (format) {
    case 'text':
      return renderText();
    case 'markdown':
      return renderMarkdown();
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unhandled format: ${String(_exhaustive)}`);
    }
  }
}
