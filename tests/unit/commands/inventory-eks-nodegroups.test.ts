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
import { listEksNodegroups } from '../../../src/services/inventory/eks-nodegroups.js';

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
  id: 'ng-a-1',
  status: 'ACTIVE',
  version: '1.33',
  amiType: 'AL2023_x86_64_STANDARD',
  instanceTypes: ['t3.medium'],
  capacityType: 'ON_DEMAND',
  scalingMin: 2,
  scalingDesired: 3,
  scalingMax: 8,
  diskSize: 20,
  outdated: false,
  createdAt: '2026-03-24T11:45:24.694+00:00',
  region: 'us-east-1',
  price: 100,
  labels: {},
  tags: {},
  arn: 'arn:aws:eks:...',
  clusterId: 'eks-cluster-a',
  accountId: '123456789012',
};

describe('inventory eks nodegroups list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table with key columns and summary footer', async () => {
    vi.mocked(listEksNodegroups).mockResolvedValue({
      nodeGroups: [sample],
      summary: { total: 1, clusters: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    // Index 6: nested-resource leaves are registered last
    // (0=ec2, 1=rds, 2=elasticache, 3=opensearch, 4=eks, 5=ebs, 6=eks/nodegroups, 7=opensearch/nodes)
    const handler = wrapCommandMock.mock.calls[6][0] as any;

    const result = await handler(mockContext(), {
      account: ['1'],
      region: ['us-east-1'],
      state: ['ACTIVE'],
      capacity: ['ON_DEMAND'],
      cluster: ['eks-cluster-a'],
      outdated: true,
    });

    expect(listEksNodegroups).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['us-east-1'],
      states: ['ACTIVE'],
      capacities: ['ON_DEMAND'],
      clusters: ['eks-cluster-a'],
      outdated: true,
    });
    expect(result).toContain('ng-a-1');
    expect(result).toContain('eks-cluster-a');
    expect(result).toContain('ON_DEMAND');
    expect(result).toContain('2-3-8');
    expect(result).toContain('t3.medium');
    expect(result).toContain('1 node groups · 1 clusters · 1 accounts · 1 regions');
  });

  it('quiet projection includes state (nodegroup status surfaced as state)', async () => {
    vi.mocked(listEksNodegroups).mockResolvedValue({
      nodeGroups: [sample],
      summary: { total: 1, clusters: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    const handler = wrapCommandMock.mock.calls[6][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [], state: [], capacity: [], cluster: [] },
    );
    expect(JSON.parse(result)).toEqual([
      {
        id: 'ng-a-1',
        clusterId: 'eks-cluster-a',
        accountId: '123456789012',
        region: 'us-east-1',
        state: 'ACTIVE',
      },
    ]);
  });
});
