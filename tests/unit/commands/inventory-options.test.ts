// tests/unit/commands/inventory-options.test.ts
import { describe, expect, it } from 'vitest';
import {
  collectString,
  parseCommitmentsFilters,
  parseInventoryFilters,
} from '../../../src/commands/inventory-options.js';

describe('collectString', () => {
  it('accumulates values into an array', () => {
    expect(collectString('a', [])).toEqual(['a']);
    expect(collectString('b', ['a'])).toEqual(['a', 'b']);
  });
});

describe('parseInventoryFilters', () => {
  it('maps Commander option names to filter object', () => {
    expect(
      parseInventoryFilters({
        account: ['111111111111'],
        region: ['us-east-1'],
        state: ['running'],
        lifecycle: ['spot'],
        capacity: ['ON_DEMAND'],
        role: ['data'],
        cluster: ['c1'],
      }),
    ).toEqual({
      accounts: ['111111111111'],
      regions: ['us-east-1'],
      states: ['running'],
      lifecycles: ['spot'],
      capacities: ['ON_DEMAND'],
      roles: ['data'],
      clusters: ['c1'],
    });
  });

  it('includes outdated=true when the flag is set', () => {
    expect(parseInventoryFilters({ outdated: true })).toMatchObject({ outdated: true });
  });

  it('omits outdated when the flag is not set', () => {
    expect(parseInventoryFilters({})).not.toHaveProperty('outdated');
  });

  it('returns an empty object when nothing provided (unregistered options stay absent)', () => {
    expect(parseInventoryFilters({})).toEqual({});
  });

  it('only populates the keys whose options are present', () => {
    expect(parseInventoryFilters({ region: ['us-east-1'] })).toEqual({
      regions: ['us-east-1'],
    });
  });
});

describe('parseCommitmentsFilters', () => {
  it('maps Commander option names to filter object', () => {
    expect(
      parseCommitmentsFilters({
        account: ['111111111111'],
        region: ['us-east-1'],
        state: ['active'],
      }),
    ).toEqual({
      accounts: ['111111111111'],
      regions: ['us-east-1'],
      states: ['active'],
    });
  });

  it('returns empty arrays when nothing provided', () => {
    expect(parseCommitmentsFilters({})).toEqual({
      accounts: [],
      regions: [],
      states: [],
    });
  });
});
