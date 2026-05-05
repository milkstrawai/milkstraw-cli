import { getRdsInventory, type InventoryFilters, type RdsInventoryResponse } from '../../lib/api/inventory.js';

export function listRdsInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<RdsInventoryResponse> {
  return getRdsInventory(token, organizationId, filters);
}
