import {
  type ComponentRenderFormat,
  escapeMarkdown,
  normalizeDisplayValue,
  renderByFormat,
  type TableColumn,
} from './types.js';

interface TableComponentInput {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/*
Example output:

text:
  Name | ID
  Acme | org_1

markdown:
  | Name | ID |
  | --- | --- |
  | Acme | org_1 |
*/
export class TableComponent {
  constructor(private readonly input: TableComponentInput) {}

  render(format: ComponentRenderFormat): string {
    return renderByFormat(
      format,
      () => this.renderText(),
      () => this.renderMarkdown(),
    );
  }

  renderText(): string {
    const rows = this.normalizedRows();
    const widths = this.columnWidths(rows);
    const header = this.input.columns.map((column, index) => this.padCell(column.label, widths[index], index));

    return [
      header.join(' | '),
      ...rows.map((row) => row.map((cell, index) => this.padCell(cell, widths[index], index)).join(' | ')),
    ].join('\n');
  }

  renderMarkdown(): string {
    const header = this.input.columns.map((column) => escapeMarkdown(column.label));
    const separator = this.input.columns.map(() => '---');
    const rows = this.normalizedRows().map((row) => `| ${row.map(escapeMarkdown).join(' | ')} |`);

    return [`| ${header.join(' | ')} |`, `| ${separator.join(' | ')} |`, ...rows].join('\n');
  }

  private normalizedRows(): string[][] {
    return this.input.rows.map((row) => this.input.columns.map((column) => normalizeDisplayValue(row[column.key])));
  }

  private columnWidths(rows: string[][]): number[] {
    return this.input.columns.map((column, index) =>
      Math.max(column.label.length, ...rows.map((row) => row[index]?.length ?? 0)),
    );
  }

  private padCell(value: string, width: number, index: number): string {
    if (index === this.input.columns.length - 1) return value;
    return value.padEnd(width, ' ');
  }
}
