import type { CommitmentsFilters, InventoryFilters } from '../lib/api/inventory.js';

export function collectString(value: string, previous: string[]): string[] {
  return [...previous, value];
}

// Only populate filter keys for options that the leaf command actually
// registered. Unregistered Commander options are `undefined` (vs. the
// registered repeatable options which Commander defaults to `[]`). This
// keeps each command's filter contract narrow to what it really sends.
export function parseInventoryFilters(options: Record<string, unknown>): InventoryFilters {
  const filters: InventoryFilters = {};
  if (Array.isArray(options.account)) filters.accounts = options.account as string[];
  if (Array.isArray(options.region)) filters.regions = options.region as string[];
  if (Array.isArray(options.state)) filters.states = options.state as string[];
  if (Array.isArray(options.lifecycle)) filters.lifecycles = options.lifecycle as string[];
  if (Array.isArray(options.capacity)) filters.capacities = options.capacity as string[];
  if (Array.isArray(options.role)) filters.roles = options.role as string[];
  if (Array.isArray(options.cluster)) filters.clusters = options.cluster as string[];
  if (options.outdated === true) filters.outdated = true;
  return filters;
}

export function parseCommitmentsFilters(options: Record<string, unknown>): CommitmentsFilters {
  return {
    accounts: (options.account as string[] | undefined) ?? [],
    regions: (options.region as string[] | undefined) ?? [],
    states: (options.state as string[] | undefined) ?? [],
  };
}
