import { type EksInventoryResponse, getEksInventory, type InventoryFilters } from '../../lib/api/inventory.js';

export function listEksInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<EksInventoryResponse> {
  return getEksInventory(token, organizationId, filters);
}
