import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/inventory.js', () => ({
  getOpensearchNodes: (...args: any[]) => mockGet(...args),
}));

const { listOpensearchNodes } = await import('../../../../src/services/inventory/opensearch-nodes.js');

beforeEach(() => mockGet.mockReset());

describe('services/inventory/opensearch-nodes', () => {
  it('forwards token, organizationId, and filters', async () => {
    mockGet.mockResolvedValue({
      nodes: [],
      summary: { total: 0, clusters: 0, accounts: 0, regions: 0 },
    });
    await listOpensearchNodes('tok', 'org_1', { regions: ['eu-west-1'], roles: ['data'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['eu-west-1'], roles: ['data'] });
  });
});
