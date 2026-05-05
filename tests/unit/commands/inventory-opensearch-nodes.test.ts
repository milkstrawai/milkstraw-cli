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
vi.mock('../../../src/services/inventory/eks-nodegroups.js', () => ({ listEksNodegroups: vi.fn() }));
vi.mock('../../../src/services/inventory/opensearch-nodes.js', () => ({ listOpensearchNodes: vi.fn() }));
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
import { listOpensearchNodes } from '../../../src/services/inventory/opensearch-nodes.js';

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
  id: 'node-a-1',
  role: 'data',
  type: 'r7g.xlarge.search',
  status: 'active',
  availabilityZone: 'eu-west-1a',
  storageSize: '200',
  storageType: 'EBS',
  storageVolumeType: 'gp3',
  price: 50,
  clusterId: '688897985026/demo',
  accountId: '688897985026',
  region: 'eu-west-1',
};

describe('inventory opensearch nodes list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table with key columns and summary footer', async () => {
    vi.mocked(listOpensearchNodes).mockResolvedValue({
      nodes: [sample],
      summary: { total: 1, clusters: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    // Index 7: opensearch/nodes is registered after eks/nodegroups
    const handler = wrapCommandMock.mock.calls[7][0] as any;

    const result = await handler(mockContext(), {
      account: ['1'],
      region: ['eu-west-1'],
      state: ['active'],
      role: ['data'],
      cluster: ['688897985026/demo'],
    });

    expect(listOpensearchNodes).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['eu-west-1'],
      states: ['active'],
      roles: ['data'],
      clusters: ['688897985026/demo'],
    });
    expect(result).toContain('node-a-1');
    expect(result).toContain('688897985026/demo');
    expect(result).toContain('data');
    expect(result).toContain('200 gp3');
    expect(result).toContain('eu-west-1a');
    expect(result).toContain('1 nodes · 1 clusters · 1 accounts · 1 regions');
  });

  it('quiet projection includes state (node status surfaced as state)', async () => {
    vi.mocked(listOpensearchNodes).mockResolvedValue({
      nodes: [sample],
      summary: { total: 1, clusters: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    const handler = wrapCommandMock.mock.calls[7][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [], role: [], cluster: [] },
    );
    expect(JSON.parse(result)).toEqual([
      {
        id: 'node-a-1',
        clusterId: '688897985026/demo',
        accountId: '688897985026',
        region: 'eu-west-1',
        state: 'active',
      },
    ]);
  });
});
