import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
vi.mock('../../../../src/lib/api/client.js', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  initializeApiTransport: vi.fn(),
}));

const {
  getEc2Commitments,
  getRdsCommitments,
  getElasticacheCommitments,
  getOpensearchCommitments,
  getComputeSavingsPlans,
  getEc2InstanceSavingsPlans,
  getSageMakerSavingsPlans,
  getDatabaseSavingsPlans,
} = await import('../../../../src/lib/api/commitments.js');

function mockResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {},
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

beforeEach(() => mockApiFetch.mockReset());

const baseSummary = { total: 0, active: 0, accounts: 0 };

describe('RI endpoints', () => {
  it.each([
    ['getEc2Commitments', getEc2Commitments, '/api/organizations/org_1/commitments/ec2'],
    ['getRdsCommitments', getRdsCommitments, '/api/organizations/org_1/commitments/rds'],
    ['getElasticacheCommitments', getElasticacheCommitments, '/api/organizations/org_1/commitments/elasticache'],
    ['getOpensearchCommitments', getOpensearchCommitments, '/api/organizations/org_1/commitments/opensearch'],
  ])('%s hits the correct URL with no filters', async (_name, fn, expectedPath) => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ items: [], summary: baseSummary }));
    await fn('tok', 'org_1', {});
    expect(mockApiFetch).toHaveBeenCalledWith(expectedPath, {}, 'tok');
  });

  it('forwards account/region/state arrays', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ items: [], summary: baseSummary }));
    await getEc2Commitments('tok', 'org_1', {
      accounts: ['111'],
      regions: ['us-east-1'],
      states: ['active', 'retired'],
    });
    expect(mockApiFetch.mock.calls[0][0]).toBe(
      '/api/organizations/org_1/commitments/ec2?account[]=111&region[]=us-east-1&state[]=active&state[]=retired',
    );
  });

  it('normalizes EC2 RI item with required + optional fields', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        items: [
          {
            id: 'ri-1',
            type: 'm5.large',
            count: 1,
            region: 'us-east-1',
            state: 'active',
            platform: 'Linux/UNIX',
            payment_option: 'No Upfront',
            offering_class: 'standard',
            start_time: '2026-01-01T00:00:00Z',
            end_time: '2027-01-01T00:00:00Z',
            duration: 12,
            on_demand_price: 100,
            commitment_price: 50,
            savings: 50,
            account_id: '111',
            // optionals omitted
          },
        ],
        summary: { total: 1, active: 1, accounts: 1 },
      }),
    );
    const result = await getEc2Commitments('tok', 'org_1', {});
    expect(result.items[0]).toEqual({
      id: 'ri-1',
      type: 'm5.large',
      count: 1,
      region: 'us-east-1',
      state: 'active',
      platform: 'Linux/UNIX',
      paymentOption: 'No Upfront',
      offeringClass: 'standard',
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2027-01-01T00:00:00Z',
      duration: 12,
      onDemandPrice: 100,
      commitmentPrice: 50,
      savings: 50,
      managedBy: null,
      utilizationPercentage: null,
      actualSavings: null,
      originalPrice: null,
      accountId: '111',
    });
  });

  it('normalizes RDS RI with multi_az and optional managed_by', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        items: [
          {
            id: 'ri-rds',
            type: 'db.r7g.large',
            count: 1,
            region: 'us-east-2',
            state: 'active',
            platform: 'aurora-postgresql',
            multi_az: false,
            payment_option: 'No Upfront',
            start_time: '2025-05-09T15:25:56.070Z',
            end_time: '2026-05-09T15:25:56.070Z',
            duration: 12,
            on_demand_price: 201.48,
            commitment_price: 155.49,
            savings: 45.99,
            managed_by: 'milkstraw',
            utilization_percentage: 85.5,
            actual_savings: 25.0,
            original_price: 180.0,
            account_id: '511690385103',
          },
        ],
        summary: { total: 1, active: 1, accounts: 1 },
      }),
    );
    const result = await getRdsCommitments('tok', 'org_1', {});
    expect(result.items[0]).toMatchObject({
      multiAz: false,
      managedBy: 'milkstraw',
      utilizationPercentage: 85.5,
      actualSavings: 25.0,
      originalPrice: 180.0,
    });
  });

  it('normalizes OpenSearch RI without platform', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        items: [
          {
            id: 'ri-opn',
            type: 'm6g.large.search',
            count: 5,
            region: 'us-east-1',
            state: 'active',
            payment_option: 'No Upfront',
            start_time: '2025-04-17T10:25:53.239+00:00',
            end_time: '2026-04-17T10:25:53.239+00:00',
            duration: 12,
            on_demand_price: 93.44,
            commitment_price: 64.24,
            savings: 146.0,
            account_id: '688897985026',
          },
        ],
        summary: { total: 1, active: 1, accounts: 1 },
      }),
    );
    const result = await getOpensearchCommitments('tok', 'org_1', {});
    expect(result.items[0]).toMatchObject({
      id: 'ri-opn',
      managedBy: null,
    });
    expect(result.items[0]).not.toHaveProperty('platform');
  });
});

describe('SP endpoints', () => {
  it.each([
    ['getComputeSavingsPlans', getComputeSavingsPlans, '/api/organizations/org_1/commitments/savings_plans/compute'],
    [
      'getEc2InstanceSavingsPlans',
      getEc2InstanceSavingsPlans,
      '/api/organizations/org_1/commitments/savings_plans/ec2_instance',
    ],
    [
      'getSageMakerSavingsPlans',
      getSageMakerSavingsPlans,
      '/api/organizations/org_1/commitments/savings_plans/sage_maker',
    ],
    ['getDatabaseSavingsPlans', getDatabaseSavingsPlans, '/api/organizations/org_1/commitments/savings_plans/database'],
  ])('%s hits the correct URL with no filters', async (_name, fn, expectedPath) => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ items: [], summary: baseSummary }));
    await fn('tok', 'org_1', {});
    expect(mockApiFetch).toHaveBeenCalledWith(expectedPath, {}, 'tok');
  });

  it('normalizes compute SP item with optional managed_by', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        items: [
          {
            id: 'sp-1',
            service: 'compute',
            region: 'N/A',
            family: 'N/A',
            commitment: 0.1,
            cost: 73.0,
            payment_option: 'No Upfront',
            up_front_amount: '0.00000000',
            recurring_amount: '0.10000000',
            start_time: '2026-04-01T08:43:22.718+00:00',
            end_time: '2029-03-31T08:43:21.718+00:00',
            state: 'active',
            savings: 59.73,
            managed_by: 'aws',
            utilization_percentage: 100,
            actual_savings: 50,
            original_price: 110,
            account_id: '884128492282',
          },
        ],
        summary: { total: 1, active: 1, accounts: 1 },
      }),
    );
    const result = await getComputeSavingsPlans('tok', 'org_1', {});
    expect(result.items[0]).toEqual({
      id: 'sp-1',
      service: 'compute',
      region: 'N/A',
      family: 'N/A',
      commitment: 0.1,
      cost: 73.0,
      paymentOption: 'No Upfront',
      upFrontAmount: '0.00000000',
      recurringAmount: '0.10000000',
      startTime: '2026-04-01T08:43:22.718+00:00',
      endTime: '2029-03-31T08:43:21.718+00:00',
      state: 'active',
      savings: 59.73,
      managedBy: 'aws',
      utilizationPercentage: 100,
      actualSavings: 50,
      originalPrice: 110,
      accountId: '884128492282',
    });
  });
});
