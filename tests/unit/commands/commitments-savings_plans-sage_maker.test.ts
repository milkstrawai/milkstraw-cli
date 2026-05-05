// tests/unit/commands/commitments-savings_plans-sage_maker.test.ts
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
import { listSageMakerSavingsPlans } from '../../../src/services/commitments/savings_plans/sage_maker.js';

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
  id: 'sp-sm-1',
  service: 'sage_maker',
  region: 'us-east-2',
  family: 'N/A',
  commitment: 0.08,
  cost: 58,
  paymentOption: 'No Upfront',
  upFrontAmount: '0',
  recurringAmount: '0.08',
  startTime: '2026-02-01T00:00:00Z',
  endTime: '2027-02-01T00:00:00Z',
  state: 'active',
  savings: 18,
  managedBy: 'aws' as const,
  utilizationPercentage: 60,
  actualSavings: 14,
  originalPrice: 76,
  accountId: '777788889999',
};

describe('commitments savings_plans sage_maker list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listSageMakerSavingsPlans).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[6][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['us-east-2'], state: ['active'] });

    expect(listSageMakerSavingsPlans).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['us-east-2'],
      states: ['active'],
    });
    expect(result).toContain('sp-sm-1');
    expect(result).toContain('1 items · 1 active · 1 accounts');
  });

  it('returns slim quiet projection including state', async () => {
    vi.mocked(listSageMakerSavingsPlans).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[6][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: 'sp-sm-1', accountId: '777788889999', region: 'us-east-2', state: 'active' },
    ]);
  });
});
