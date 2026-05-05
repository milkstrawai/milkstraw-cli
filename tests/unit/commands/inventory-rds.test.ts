// tests/unit/commands/inventory-rds.test.ts
import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));
vi.mock('../../../src/services/inventory/ec2.js', () => ({ listEc2Inventory: vi.fn() }));
vi.mock('../../../src/services/inventory/rds.js', () => ({ listRdsInventory: vi.fn() }));
vi.mock('../../../src/services/inventory/elasticache.js', () => ({ listElasticacheInventory: vi.fn() }));
vi.mock('../../../src/services/inventory/opensearch.js', () => ({ listOpensearchInventory: vi.fn() }));
vi.mock('../../../src/services/inventory/eks.js', () => ({ listEksInventory: vi.fn() }));
vi.mock('../../../src/services/inventory/ebs.js', () => ({ listEbsInventory: vi.fn() }));
vi.mock('../../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn().mockResolvedValue({ organizationId: 'org_1', organizationName: 'Acme' }),
}));
vi.mock('../../../src/context/permissions.js', () => ({
  PERMISSION_ACTIONS: { VIEW_STATUS: 'view_status' },
  withPermissionCheck: vi.fn(async (fn) => await fn()),
}));

import { registerInventoryCommand } from '../../../src/commands/inventory.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import type { CliContext } from '../../../src/core/context.js';
import { listRdsInventory } from '../../../src/services/inventory/rds.js';

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
  id: 'atlas',
  type: 'db.t3.small',
  region: 'us-east-1',
  platform: 'postgresql',
  platformVersion: '14',
  multiAz: false,
  auroraIo: false,
  clusterId: 'N/A',
  readersIds: [],
  encrypted: true,
  performanceInsightsEnabled: false,
  performanceInsightsRetentionDays: 0,
  outdated: false,
  launchTime: '2017-07-26T15:11:55.166Z',
  price: 26.27,
  tags: {},
  riCoveragePercentage: null,
  spCoveragePercentage: null,
  accountId: '928751460984',
};

describe('inventory rds list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listRdsInventory).mockResolvedValue({
      instances: [sample],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    // RDS is the 2nd leaf registered (index 1).
    const handler = wrapCommandMock.mock.calls[1][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['us-east-1'] });

    expect(listRdsInventory).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['us-east-1'],
    });
    expect(result).toContain('atlas');
    expect(result).toContain('postgresql');
    expect(result).toContain('1 instances · 1 accounts · 1 regions');
  });

  it('omits state from quiet projection (rds has no state)', async () => {
    vi.mocked(listRdsInventory).mockResolvedValue({
      instances: [sample],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    const handler = wrapCommandMock.mock.calls[1][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: 'atlas', accountId: '928751460984', region: 'us-east-1' }, // no state
    ]);
  });
});
