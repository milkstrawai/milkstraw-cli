import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getOpensearchInventory: (...args: any[]) => mockGet(...args),
}));

const { listOpensearchInventory } = await import('../../../../src/services/inventory/opensearch.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/opensearch', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({ clusters: [], summary: { total: 0, accounts: 0, regions: 0 } });
    await listOpensearchInventory('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
