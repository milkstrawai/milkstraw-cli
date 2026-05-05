import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getEbsInventory: (...args: any[]) => mockGet(...args),
}));

const { listEbsInventory } = await import('../../../../src/services/inventory/ebs.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/ebs', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({ volumes: [], summary: { total: 0, accounts: 0, regions: 0 } });
    await listEbsInventory('tok', 'org_1', { regions: ['us-east-1'], states: ['available'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'], states: ['available'] });
  });
});
