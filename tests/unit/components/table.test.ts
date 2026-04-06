import { describe, expect, it } from 'vitest';
import { TableComponent } from '../../../src/components/table.js';

describe('TableComponent', () => {
  it('renders text tables', () => {
    const component = new TableComponent({
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'id', label: 'ID' },
      ],
      rows: [
        { name: 'Alpha', id: 'org_1' },
        { name: 'Beta', id: 'org_2' },
      ],
    });

    expect(component.render('text')).toBe('Name  | ID\nAlpha | org_1\nBeta  | org_2');
    expect(component.renderText()).toBe('Name  | ID\nAlpha | org_1\nBeta  | org_2');
  });

  it('renders markdown tables and escapes multiline or pipe content', () => {
    const component = new TableComponent({
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'note', label: 'Note' },
      ],
      rows: [{ name: 'Alpha | Beta', note: 'Line 1\nLine 2' }],
    });

    expect(component.render('markdown')).toBe('| Name | Note |\n| --- | --- |\n| Alpha \\| Beta | Line 1<br>Line 2 |');
    expect(component.renderMarkdown()).toBe('| Name | Note |\n| --- | --- |\n| Alpha \\| Beta | Line 1<br>Line 2 |');
  });
});
