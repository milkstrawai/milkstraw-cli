import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../../../src/lib/api/commitments.js', () => ({
  getSageMakerSavingsPlans: (...args: any[]) => mockGet(...args),
}));

const { listSageMakerSavingsPlans } = await import(
  '../../../../../src/services/commitments/savings_plans/sage_maker.js'
);

beforeEach(() => mockGet.mockReset());

describe('services/commitments/savings_plans/sage_maker', () => {
  it('forwards args', async () => {
    mockGet.mockResolvedValue({ items: [], summary: { total: 0, active: 0, accounts: 0 } });
    await listSageMakerSavingsPlans('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockGet).toHaveBeenCalledWith('tok', 'org_1', { regions: ['us-east-1'] });
  });
});
