import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getEksNodegroups: (...args: any[]) => mockGet(...args),
}));

const { listEksNodegroups } = await import('../../../../src/services/inventory/eks-nodegroups.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/eks-nodegroups', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({
      nodeGroups: [],
      summary: { total: 0, clusters: 0, accounts: 0, regions: 0 },
    });
    await listEksNodegroups('tok', 'org_1', { regions: ['us-east-1'], capacities: ['SPOT'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'], capacities: ['SPOT'] });
  });
});
