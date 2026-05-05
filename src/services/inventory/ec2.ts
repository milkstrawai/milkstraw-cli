import { type Ec2InventoryResponse, getEc2Inventory, type InventoryFilters } from '../../lib/api/inventory.js';

export function listEc2Inventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<Ec2InventoryResponse> {
  return getEc2Inventory(token, organizationId, filters);
}
