import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/commitments.js', () => ({
  getOpensearchCommitments: (...args: any[]) => mockGet(...args),
}));

const { listOpensearchCommitments } = await import('../../../../src/services/commitments/opensearch.js');

beforeEach(() => mockGet.mockReset());

describe('services/commitments/opensearch', () => {
  it('forwards args', async () => {
    mockGet.mockResolvedValue({ items: [], summary: { total: 0, active: 0, accounts: 0 } });
    await listOpensearchCommitments('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
