import { type EksNodegroupsResponse, getEksNodegroups, type InventoryFilters } from '../../lib/api/inventory.js';

export function listEksNodegroups(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<EksNodegroupsResponse> {
  return getEksNodegroups(token, organizationId, filters);
}
