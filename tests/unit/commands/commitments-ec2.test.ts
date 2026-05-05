// tests/unit/commands/commitments-ec2.test.ts
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
import { listEc2Commitments } from '../../../src/services/commitments/ec2.js';

function mockContext(renderFormat = 'text', isQuiet = false): CliContext {
  return {
    config: { apiUrl: 'x', renderFormat, isQuiet, verbose: false, agentMode: false },
    auth: { getToken: vi.fn().mockResolvedValue('tok') },
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
  } as unknown as CliContext;
}

// Registration order under `commitments`: 0=ec2, 1=rds, 2=elasticache, 3=opensearch,
// 4=savings_plans/compute, 5=savings_plans/ec2_instance, 6=savings_plans/sage_maker,
// 7=savings_plans/database.
function getHandler(index: number): CommandAction {
  wrapCommandMock.mockClear();
  const program = new Command();
  registerCommitmentsCommand(program);
  return wrapCommandMock.mock.calls[index][0] as CommandAction;
}

const sampleRi = {
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
  managedBy: 'milkstraw' as const,
  utilizationPercentage: 85.5,
  actualSavings: 25,
  originalPrice: 60,
  accountId: '123456789012',
};

describe('commitments ec2 list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table with the expected columns and summary', async () => {
    vi.mocked(listEc2Commitments).mockResolvedValue({
      items: [sampleRi],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const handler = getHandler(0);
    const result = await handler(mockContext(), { account: [], region: [], state: [] });

    expect(listEc2Commitments).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: [],
      regions: [],
      states: [],
    });
    expect(result).toContain('ri-1');
    expect(result).toContain('m5.large');
    expect(result).toContain('milkstraw');
    expect(result).toContain('85.5%');
    expect(result).toContain('Managed by');
    expect(result).toContain('1 items · 1 active · 1 accounts');
  });

  it('returns raw API body for json format', async () => {
    const body = { items: [], summary: { total: 0, active: 0, accounts: 0 } };
    vi.mocked(listEc2Commitments).mockResolvedValue(body);
    const handler = getHandler(0);
    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, renderFormat: 'json' } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual(body);
  });

  it('returns slim quiet projection including state', async () => {
    vi.mocked(listEc2Commitments).mockResolvedValue({
      items: [sampleRi],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const handler = getHandler(0);
    const result = await handler(mockContext('text', true), { account: [], region: [], state: [] });
    expect(JSON.parse(result)).toEqual([
      { id: 'ri-1', accountId: '123456789012', region: 'us-east-1', state: 'active' },
    ]);
  });

  it('forwards filters', async () => {
    vi.mocked(listEc2Commitments).mockResolvedValue({
      items: [],
      summary: { total: 0, active: 0, accounts: 0 },
    });
    const handler = getHandler(0);
    await handler(mockContext(), { account: ['111'], region: ['us-east-1'], state: ['active'] });
    expect(listEc2Commitments).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['111'],
      regions: ['us-east-1'],
      states: ['active'],
    });
  });

  it('renders "-" for null managedBy/utilizationPercentage', async () => {
    vi.mocked(listEc2Commitments).mockResolvedValue({
      items: [{ ...sampleRi, managedBy: null, utilizationPercentage: null } as any],
      summary: { total: 1, active: 1, accounts: 1 },
    });
    const handler = getHandler(0);
    const result = await handler(mockContext(), { account: [], region: [], state: [] });
    expect(result).toMatch(/-\s*\|\s*-/); // two dashes side-by-side, padded
  });
});
