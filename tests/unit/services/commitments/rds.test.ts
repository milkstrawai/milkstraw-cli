import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/commitments.js', () => ({
  getRdsCommitments: (...args: any[]) => mockGet(...args),
}));

const { listRdsCommitments } = await import('../../../../src/services/commitments/rds.js');

beforeEach(() => mockGet.mockReset());

describe('services/commitments/rds', () => {
  it('forwards args', async () => {
    mockGet.mockResolvedValue({ items: [], summary: { total: 0, active: 0, accounts: 0 } });
    await listRdsCommitments('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
