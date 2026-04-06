import { describe, expect, it } from 'vitest';
import { ParagraphComponent } from '../../../src/components/paragraph.js';

describe('ParagraphComponent', () => {
  it('renders text and markdown as the same final paragraph', () => {
    const component = new ParagraphComponent('Status for Acme');

    expect(component.render('text')).toBe('Status for Acme');
    expect(component.renderText()).toBe('Status for Acme');
    expect(component.render('markdown')).toBe('Status for Acme');
    expect(component.renderMarkdown()).toBe('Status for Acme');
  });
});
