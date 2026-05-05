import {
  getOpensearchInventory,
  type InventoryFilters,
  type OpensearchInventoryResponse,
} from '../../lib/api/inventory.js';

export function listOpensearchInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<OpensearchInventoryResponse> {
  return getOpensearchInventory(token, organizationId, filters);
}
