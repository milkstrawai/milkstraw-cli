import { describe, expect, it } from 'vitest';
import { SectionComponent } from '../../../src/components/section.js';

describe('SectionComponent', () => {
  it('renders titled multiline text content with indentation', () => {
    const component = new SectionComponent({
      title: 'Management Stack',
      lines: ['MilkStrawAccessStackV2', 'Healthy', 'Version 2.0'],
    });

    expect(component.render('text')).toBe('Management Stack:\n  MilkStrawAccessStackV2\n  Healthy\n  Version 2.0');
    expect(component.renderText()).toBe('Management Stack:\n  MilkStrawAccessStackV2\n  Healthy\n  Version 2.0');
  });

  it('renders titled markdown content as bullets', () => {
    const component = new SectionComponent({
      title: 'Sub Accounts',
      lines: ['No subaccounts connected', 'Access healthy'],
    });

    expect(component.render('markdown')).toBe('### Sub Accounts\n\n- No subaccounts connected\n- Access healthy');
    expect(component.renderMarkdown()).toBe('### Sub Accounts\n\n- No subaccounts connected\n- Access healthy');
  });
});
