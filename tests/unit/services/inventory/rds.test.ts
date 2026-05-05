import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getRdsInventory: (...args: any[]) => mockGet(...args),
}));

const { listRdsInventory } = await import('../../../../src/services/inventory/rds.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/rds', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({ instances: [], summary: { total: 0, accounts: 0, regions: 0 } });
    await listRdsInventory('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
