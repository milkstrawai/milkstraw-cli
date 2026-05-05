import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/commitments.js', () => ({
  getElasticacheCommitments: (...args: any[]) => mockGet(...args),
}));

const { listElasticacheCommitments } = await import('../../../../src/services/commitments/elasticache.js');

beforeEach(() => mockGet.mockReset());

describe('services/commitments/elasticache', () => {
  it('forwards args', async () => {
    mockGet.mockResolvedValue({ items: [], summary: { total: 0, active: 0, accounts: 0 } });
    await listElasticacheCommitments('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
