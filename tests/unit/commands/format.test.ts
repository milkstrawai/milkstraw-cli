import { describe, expect, it } from 'vitest';
import {
  dash,
  formatBoolean,
  formatCommitmentHourly,
  formatPercentage,
  formatPriceMonthly,
} from '../../../src/commands/format.js';

describe('dash', () => {
  it('returns "-" for null, undefined, or empty string', () => {
    expect(dash(null)).toBe('-');
    expect(dash(undefined)).toBe('-');
    expect(dash('')).toBe('-');
  });

  it('returns the stringified value for non-empty strings and numbers', () => {
    expect(dash('hello')).toBe('hello');
    expect(dash(0)).toBe('0');
    expect(dash(42)).toBe('42');
  });
});

describe('formatBoolean', () => {
  it('renders Yes for true and No for false', () => {
    expect(formatBoolean(true)).toBe('Yes');
    expect(formatBoolean(false)).toBe('No');
  });
});

describe('formatPercentage', () => {
  it('renders "-" for null', () => {
    expect(formatPercentage(null)).toBe('-');
  });

  it('renders one-decimal percentage for numbers including zero', () => {
    expect(formatPercentage(85.5)).toBe('85.5%');
    expect(formatPercentage(100)).toBe('100.0%');
    expect(formatPercentage(0)).toBe('0.0%');
  });
});

describe('formatPriceMonthly', () => {
  it('renders 2-decimal USD', () => {
    expect(formatPriceMonthly(0.096)).toBe('$0.10');
    expect(formatPriceMonthly(73)).toBe('$73.00');
    expect(formatPriceMonthly(1274.58)).toBe('$1274.58');
  });
});

describe('formatCommitmentHourly', () => {
  it('renders 4-decimal USD for the smaller hourly amounts', () => {
    expect(formatCommitmentHourly(0.1)).toBe('$0.1000');
    expect(formatCommitmentHourly(1.2345)).toBe('$1.2345');
  });
});
