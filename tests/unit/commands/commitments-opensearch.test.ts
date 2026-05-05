// tests/unit/commands/commitments-opensearch.test.ts
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
import { listOpensearchCommitments } from '../../../src/services/commitments/opensearch.js';

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
  id: 'os-ri-1',
  type: 'r5.large.search',
  count: 3,
  region: 'eu-west-1',
  state: 'active',
  platform: '',
  paymentOption: 'No Upfront',
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2027-01-01T00:00:00Z',
  duration: 12,
  onDemandPrice: 200,
  commitmentPrice: 130,
  savings: 70,
  managedBy: 'aws' as const,
  utilizationPercentage: 95,
  actualSavings: 50,
  originalPrice: 150,
  accountId: '444455556666',
};

describe('commitments opensearch list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listOpensearchCommitments).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[3][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['eu-west-1'], state: ['active'] });

    expect(listOpensearchCommitments).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['eu-west-1'],
      states: ['active'],
    });
    expect(result).toContain('os-ri-1');
    expect(result).toContain('r5.large.search');
    expect(result).toContain('1 items · 1 active · 1 accounts');
  });

  it('returns slim quiet projection including state', async () => {
    vi.mocked(listOpensearchCommitments).mockResolvedValue({
      items: [sample],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const program = new Command();
    registerCommitmentsCommand(program);
    const handler = wrapCommandMock.mock.calls[3][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: 'os-ri-1', accountId: '444455556666', region: 'eu-west-1', state: 'active' },
    ]);
  });
});
