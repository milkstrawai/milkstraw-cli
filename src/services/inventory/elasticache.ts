import {
  type ElasticacheInventoryResponse,
  getElasticacheInventory,
  type InventoryFilters,
} from '../../lib/api/inventory.js';

export function listElasticacheInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<ElasticacheInventoryResponse> {
  return getElasticacheInventory(token, organizationId, filters);
}
