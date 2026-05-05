// tests/unit/commands/commitments-savings_plans-compute.test.ts
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
import type { CommandAction } from '../../../src/commands/helpers.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import type { CliContext } from '../../../src/core/context.js';
import { listComputeSavingsPlans } from '../../../src/services/commitments/savings_plans/compute.js';

function mockContext(renderFormat = 'text', isQuiet = false): CliContext {
  return {
    config: { apiUrl: 'x', renderFormat, isQuiet, verbose: false, agentMode: false },
    auth: { getToken: vi.fn().mockResolvedValue('tok') },
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
  } as unknown as CliContext;
}

function getHandler(index: number): CommandAction {
  wrapCommandMock.mockClear();
  const program = new Command();
  registerCommitmentsCommand(program);
  return wrapCommandMock.mock.calls[index][0] as CommandAction;
}

const sampleSp = {
  id: 'sp-1',
  service: 'compute',
  region: 'N/A',
  family: 'N/A',
  commitment: 0.1,
  cost: 73,
  paymentOption: 'No Upfront',
  upFrontAmount: '0',
  recurringAmount: '0.1',
  startTime: '2026-04-01T00:00:00Z',
  endTime: '2029-03-31T00:00:00Z',
  state: 'active',
  savings: 59.73,
  managedBy: 'aws' as const,
  utilizationPercentage: 100,
  actualSavings: 50,
  originalPrice: 110,
  accountId: '884128492282',
};

describe('commitments savings_plans compute list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table with SP-specific columns and summary', async () => {
    vi.mocked(listComputeSavingsPlans).mockResolvedValue({
      items: [sampleSp],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const handler = getHandler(4);
    const result = await handler(mockContext(), { account: [], region: [], state: [] });

    expect(listComputeSavingsPlans).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: [],
      regions: [],
      states: [],
    });
    expect(result).toContain('sp-1');
    expect(result).toContain('aws');
    expect(result).toContain('100.0%');
    expect(result).toContain('Commitment ($/hr)');
    expect(result).toContain('Savings ($/mo)');
    expect(result).toContain('1 items · 1 active · 1 accounts');
  });

  it('returns raw API body for json format', async () => {
    const body = { items: [], summary: { total: 0, active: 0, accounts: 0 } };
    vi.mocked(listComputeSavingsPlans).mockResolvedValue(body);
    const handler = getHandler(4);
    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, renderFormat: 'json' } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual(body);
  });

  it('returns slim quiet projection including state', async () => {
    vi.mocked(listComputeSavingsPlans).mockResolvedValue({
      items: [sampleSp],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const handler = getHandler(4);
    const result = await handler(mockContext('text', true), { account: [], region: [], state: [] });
    expect(JSON.parse(result)).toEqual([{ id: 'sp-1', accountId: '884128492282', region: 'N/A', state: 'active' }]);
  });

  it('forwards filters', async () => {
    vi.mocked(listComputeSavingsPlans).mockResolvedValue({
      items: [],
      summary: { total: 0, active: 0, accounts: 0 },
    });
    const handler = getHandler(4);
    await handler(mockContext(), { account: ['111'], region: ['us-east-1'], state: ['active'] });
    expect(listComputeSavingsPlans).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['111'],
      regions: ['us-east-1'],
      states: ['active'],
    });
  });

  it('renders "-" for null managedBy/utilizationPercentage', async () => {
    vi.mocked(listComputeSavingsPlans).mockResolvedValue({
      items: [{ ...sampleSp, managedBy: null, utilizationPercentage: null } as any],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const handler = getHandler(4);
    const result = await handler(mockContext(), { account: [], region: [], state: [] });
    // Util % and Managed by columns aren't adjacent in SP shape (separated by
    // Commitment and Savings), so just confirm dash cells appear in the row.
    expect(result).toMatch(/-\s*\|/);
    expect(result).toMatch(/\|\s*-/);
  });
});
