import { getOpensearchNodes, type InventoryFilters, type OpensearchNodesResponse } from '../../lib/api/inventory.js';

export function listOpensearchNodes(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<OpensearchNodesResponse> {
  return getOpensearchNodes(token, organizationId, filters);
}
