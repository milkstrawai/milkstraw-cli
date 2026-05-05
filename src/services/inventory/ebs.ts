import { type EbsInventoryResponse, getEbsInventory, type InventoryFilters } from '../../lib/api/inventory.js';

export function listEbsInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<EbsInventoryResponse> {
  return getEbsInventory(token, organizationId, filters);
}
