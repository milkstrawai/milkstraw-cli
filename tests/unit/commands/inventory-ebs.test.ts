// tests/unit/commands/inventory-ebs.test.ts
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
import { listEbsInventory } from '../../../src/services/inventory/ebs.js';

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
  id: 'vol-001',
  type: 'gp3',
  region: 'us-east-1',
  state: 'in-use',
  size: 100,
  iops: 3000,
  throughput: 125,
  encrypted: true,
  availabilityZone: 'us-east-1a',
  outpostArn: '',
  outdated: false,
  launchTime: '2023-01-01T00:00:00Z',
  price: 8.0,
  tags: {},
  accountId: '928751460984',
};

describe('inventory ebs list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listEbsInventory).mockResolvedValue({
      volumes: [sample],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    // EBS is the 6th leaf registered (index 5).
    const handler = wrapCommandMock.mock.calls[5][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['us-east-1'], state: ['in-use'] });

    expect(listEbsInventory).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['us-east-1'],
      states: ['in-use'],
    });
    expect(result).toContain('vol-001');
    expect(result).toContain('gp3');
    expect(result).toContain('1 volumes · 1 accounts · 1 regions');
  });

  it('quiet projection includes state', async () => {
    vi.mocked(listEbsInventory).mockResolvedValue({
      volumes: [sample],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    const handler = wrapCommandMock.mock.calls[5][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: 'vol-001', accountId: '928751460984', region: 'us-east-1', state: 'in-use' },
    ]);
  });
});
