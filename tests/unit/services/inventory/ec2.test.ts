import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getEc2Inventory: (...args: any[]) => mockGet(...args),
}));

const { listEc2Inventory } = await import('../../../../src/services/inventory/ec2.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/ec2', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({ instances: [], summary: { total: 0, accounts: 0, regions: 0 } });
    await listEc2Inventory('tok', 'org_1', { regions: ['us-east-1'], outdated: true });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'], outdated: true });
  });
});
