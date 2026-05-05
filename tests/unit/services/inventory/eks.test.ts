import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getEksInventory: (...args: any[]) => mockGet(...args),
}));

const { listEksInventory } = await import('../../../../src/services/inventory/eks.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/eks', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({ clusters: [], summary: { total: 0, accounts: 0, regions: 0 } });
    await listEksInventory('tok', 'org_1', { regions: ['us-east-1'], states: ['ACTIVE'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'], states: ['ACTIVE'] });
  });
});
