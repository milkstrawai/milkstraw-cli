import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../../src/lib/api/commitments.js', () => ({
  getEc2InstanceSavingsPlans: (...args: any[]) => mockGet(...args),
}));

const { listEc2InstanceSavingsPlans } = await import(
  '../../../../../src/services/commitments/savings_plans/ec2_instance.js'
);

beforeEach(() => mockGet.mockReset());

describe('services/commitments/savings_plans/ec2_instance', () => {
  it('forwards args', async () => {
    mockGet.mockResolvedValue({ items: [], summary: { total: 0, active: 0, accounts: 0 } });
    await listEc2InstanceSavingsPlans('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
