// tests/unit/commands/commitments-elasticache.test.ts
import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));

vi.mock('../../../src/services/commitments/ec2.js', () => ({ listEc2Commitments: vi.fn() }));
vi.mock('../../../src/services/commitments/rds.js', () => ({ listRdsCommitments: vi.fn() }));
vi.mock('../../../src/services/commitments/elasticache.js', () => ({ listElasticacheCommitments: vi.fn() }));
vi.mock('../../../src/services/commitments/opensearch.js', () => ({ listOpensearchCommitments: vi.fn() }));
vi.mock('../../../src/services/commitments/savings_plans/compute.js', () => ({ listComputeSavingsPlans: vi.fn() }));
vi.mock('../../../src/services/commitments/savings_plans/ec2_instance.js', () => ({
  listEc2InstanceSavingsPlans: vi.fn(),
}));
vi.mock('../../../src/services/commitments/savings_plans/sage_maker.js', () => ({
  listSageMakerSavingsPlans: vi.fn(),
}));
vi.mock('../../../src/services/commitments/savings_plans/database.js', () => ({
  listDatabaseSavingsPlans: vi.fn(),
}));
vi.mock('../../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn().mockResolvedValue({ organizationId: 'org_1', organizationName: 'Acme' }),
}));
vi.mock('../../../src/context/permissions.js', () => ({
  PERMISSION_ACTIONS: { VIEW_STATUS: 'view_status' },
  withPermissionCheck: vi.fn(async (fn) => await fn()),
}));

import { registerCommitmentsCommand } from '../../../src/commands/commitments.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import type { CliContext } from '../../../src/core/context.js';
import { listElasticacheCommitments } from '../../../src/services/commitments/elasticache.js';

function mockContext(): CliContext {
  return {
    config: { apiUrl: 'x', renderFormat: 'text', isQuiet: false, verbose: false, agentMode: false },
    auth: { getToken: vi.fn().mockResolvedValue('tok') },
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
  } as unknown as CliContext;
}

const sample = {
  id: 'ec-ri-1',
  type: 'cache.m5.large',
  count: 1,
  region: 'us-west-2',
  state: 'active',
  platform: 'redis',
  paymentOption: 'No Upfront',
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2027-01-01T00:00:00Z',
  duration: 12,
  onDemandPrice: 80,
  commitmentPrice: 50,
  savings: 30,
  managedBy: 'milkstraw' as const,
  utilizationPercentage: 75,
  actualSavings: 22,
  originalPrice: 60,
  accountId: '111122223333',
};

describe('commitments elasticache list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listElasticacheCommitments).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[2][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['us-west-2'], state: ['active'] });

    expect(listElasticacheCommitments).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['us-west-2'],
      states: ['active'],
    });
    expect(result).toContain('ec-ri-1');
    expect(result).toContain('redis');
    expect(result).toContain('Engine');
    expect(result).toContain('1 items · 1 active · 1 accounts');
  });

  it('returns slim quiet projection including state', async () => {
    vi.mocked(listElasticacheCommitments).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[2][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: 'ec-ri-1', accountId: '111122223333', region: 'us-west-2', state: 'active' },
    ]);
  });
});
