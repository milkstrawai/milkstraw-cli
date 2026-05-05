// tests/unit/commands/commitments-savings_plans-database.test.ts
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
import { listDatabaseSavingsPlans } from '../../../src/services/commitments/savings_plans/database.js';

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
  id: 'sp-db-1',
  service: 'database',
  region: 'eu-central-1',
  family: 'N/A',
  commitment: 0.12,
  cost: 87,
  paymentOption: 'No Upfront',
  upFrontAmount: '0',
  recurringAmount: '0.12',
  startTime: '2026-03-01T00:00:00Z',
  endTime: '2027-03-01T00:00:00Z',
  state: 'active',
  savings: 25,
  managedBy: 'milkstraw' as const,
  utilizationPercentage: 92.3,
  actualSavings: 20,
  originalPrice: 112,
  accountId: '101010101010',
};

describe('commitments savings_plans database list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listDatabaseSavingsPlans).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[7][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['eu-central-1'], state: ['active'] });

    expect(listDatabaseSavingsPlans).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['eu-central-1'],
      states: ['active'],
    });
    expect(result).toContain('sp-db-1');
    expect(result).toContain('92.3%');
    expect(result).toContain('1 items · 1 active · 1 accounts');
  });

  it('returns slim quiet projection including state', async () => {
    vi.mocked(listDatabaseSavingsPlans).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[7][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: 'sp-db-1', accountId: '101010101010', region: 'eu-central-1', state: 'active' },
    ]);
  });
});
