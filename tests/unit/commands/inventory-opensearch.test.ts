// tests/unit/commands/inventory-opensearch.test.ts
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
import { listOpensearchInventory } from '../../../src/services/inventory/opensearch.js';

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
  id: '688897985026/demo',
  region: 'eu-west-1',
  platform: 'Elasticsearch',
  platformVersion: '7.10',
  dataNodesCount: 3,
  dataNodesType: 'r7g.xlarge.search',
  masterNodesCount: 3,
  masterNodesType: 'm6g.large.search',
  dedicatedMasterEnabled: false,
  warmEnabled: false,
  warmNodesCount: 0,
  warmNodesType: 'N/A',
  multiAz: false,
  atRestEncryptionEnabled: false,
  nodeToNodeEncryptionEnabled: false,
  nodes: [],
  price: 1274.58,
  tags: {},
  arn: 'arn:aws:es:...',
  riCoveragePercentage: null,
  spCoveragePercentage: null,
  accountId: '688897985026',
};

describe('inventory opensearch list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table and forwards filters', async () => {
    vi.mocked(listOpensearchInventory).mockResolvedValue({
      clusters: [sample],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    // OpenSearch is the 4th leaf registered (index 3).
    const handler = wrapCommandMock.mock.calls[3][0] as any;

    const result = await handler(mockContext(), { account: ['1'], region: ['eu-west-1'] });

    expect(listOpensearchInventory).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['1'],
      regions: ['eu-west-1'],
    });
    expect(result).toContain('688897985026/demo');
    expect(result).toContain('Elasticsearch');
    expect(result).toContain('1 clusters · 1 accounts · 1 regions');
  });

  it('omits state from quiet projection (opensearch has no state)', async () => {
    vi.mocked(listOpensearchInventory).mockResolvedValue({
      clusters: [sample],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const program = new Command();
    registerInventoryCommand(program);
    const handler = wrapCommandMock.mock.calls[3][0] as any;

    const result = await handler(
      { ...mockContext(), config: { ...mockContext().config, isQuiet: true } } as CliContext,
      { account: [], region: [] },
    );
    expect(JSON.parse(result)).toEqual([
      { id: '688897985026/demo', accountId: '688897985026', region: 'eu-west-1' }, // no state
    ]);
  });
});
