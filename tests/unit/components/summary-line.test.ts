// tests/unit/components/summary-line.test.ts
import { describe, expect, it } from 'vitest';
import { SummaryLineComponent } from '../../../src/components/summary-line.js';

describe('SummaryLineComponent', () => {
  it('joins segments with middle-dot separator (text)', () => {
    const out = new SummaryLineComponent([
      ['instances', 847],
      ['accounts', 12],
      ['regions', 4],
    ]).render('text');

    expect(out).toBe('847 instances · 12 accounts · 4 regions');
  });

  it('drops segments with null or undefined values', () => {
    const out = new SummaryLineComponent([
      ['instances', 847],
      ['outdated', null],
      ['regions', 4],
    ]).render('text');

    expect(out).toBe('847 instances · 4 regions');
  });

  it('renders identically in markdown', () => {
    const segments: Array<[string, number | null]> = [['instances', 5]];
    const text = new SummaryLineComponent(segments).render('text');
    const markdown = new SummaryLineComponent(segments).render('markdown');
    expect(text).toBe(markdown);
  });
});
