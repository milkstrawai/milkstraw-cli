import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../src/lib/api/commitments.js', () => ({
  getEc2Commitments: (...args: any[]) => mockGet(...args),
}));

const { listEc2Commitments } = await import('../../../../src/services/commitments/ec2.js');

beforeEach(() => mockGet.mockReset());

describe('services/commitments/ec2', () => {
  it('forwards args', async () => {
    mockGet.mockResolvedValue({ items: [], summary: { total: 0, active: 0, accounts: 0 } });
    await listEc2Commitments('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
