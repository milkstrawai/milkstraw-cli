import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getElasticacheInventory: (...args: any[]) => mockGet(...args),
}));

const { listElasticacheInventory } = await import('../../../../src/services/inventory/elasticache.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/elasticache', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({ clusters: [], summary: { total: 0, accounts: 0, regions: 0 } });
    await listElasticacheInventory('tok', 'org_1', { regions: ['us-east-1'], states: ['available'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'], states: ['available'] });
  });
});
