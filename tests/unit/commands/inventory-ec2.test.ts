// tests/unit/commands/inventory-ec2.test.ts
import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));

vi.mock('../../../src/services/inventory/ec2.js', () => ({
  listEc2Inventory: vi.fn(),
}));
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

import type { TokenStore } from '../../../src/auth/session.js';
import type { CommandAction } from '../../../src/commands/helpers.js';
import { registerInventoryCommand } from '../../../src/commands/inventory.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import type { CliContext } from '../../../src/core/context.js';
import { listEc2Inventory } from '../../../src/services/inventory/ec2.js';

function mockSession(): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue('tok'),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    isAuthenticated: vi.fn().mockResolvedValue(true),
  };
}

function mockContext(renderFormat = 'text', isQuiet = false): CliContext {
  return {
    config: { apiUrl: 'x', renderFormat, isQuiet, verbose: false, agentMode: false },
    auth: mockSession(),
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
  } as CliContext;
}

// `wrapCommand` is invoked once per leaf, in registration order:
// 0=ec2, 1=rds, 2=elasticache, 3=opensearch, 4=eks, 5=ebs.
function getHandler(index: number): CommandAction {
  wrapCommandMock.mockClear();
  const program = new Command();
  registerInventoryCommand(program);
  return wrapCommandMock.mock.calls[index][0] as CommandAction;
}

const sampleInstance = {
  id: 'i-acc1-001',
  type: 'm5.large',
  region: 'us-east-1',
  state: 'running',
  platform: 'Linux/UNIX',
  launchTime: '2026-04-15T12:00:00Z',
  lifecycle: 'standard',
  monitoring: 'disabled',
  outdated: false,
  managedBy: 'standalone',
  price: 0.096,
  tags: { env: 'prod' },
  riCoveragePercentage: null,
  spCoveragePercentage: null,
  accountId: '123456789012',
};

describe('inventory ec2 list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
    } as any);
  });

  it('renders text table with the expected columns and summary footer', async () => {
    vi.mocked(listEc2Inventory).mockResolvedValue({
      instances: [sampleInstance],
      summary: { total: 1, accounts: 1, regions: 1 },
    });

    const handler = getHandler(0);
    const result = await handler(mockContext(), { account: [], region: [], state: [], lifecycle: [] });

    expect(listEc2Inventory).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: [],
      regions: [],
      states: [],
      lifecycles: [],
    });
    expect(result).toContain('ID');
    expect(result).toContain('Managed by');
    expect(result).toContain('Price ($/mo)');
    expect(result).toContain('i-acc1-001');
    expect(result).toContain('standalone');
    expect(result).toContain('1 instances · 1 accounts · 1 regions');
  });

  it('returns raw API body for --json', async () => {
    const body = { instances: [], summary: { total: 0, accounts: 0, regions: 0 } };
    vi.mocked(listEc2Inventory).mockResolvedValue(body);

    const handler = getHandler(0);
    const result = await handler(mockContext('text', false), {
      account: [],
      region: [],
      state: [],
      lifecycle: [],
    });
    // text format with empty list:
    expect(result).toContain('No instances found.');

    const json = await handler(mockContext('text', false), {
      account: [],
      region: [],
      state: [],
      lifecycle: [],
    });
    expect(json).toBeDefined();

    // Now actual --json mode
    vi.mocked(listEc2Inventory).mockResolvedValueOnce(body);
    const jsonHandler = getHandler(0);
    const jsonResult = await jsonHandler(
      { ...mockContext(), config: { ...mockContext().config, renderFormat: 'json' } } as CliContext,
      { account: [], region: [], state: [], lifecycle: [] },
    );
    expect(JSON.parse(jsonResult)).toEqual(body);
  });

  it('returns slim projection for --quiet (includes state)', async () => {
    vi.mocked(listEc2Inventory).mockResolvedValue({
      instances: [sampleInstance],
      summary: { total: 1, accounts: 1, regions: 1 },
    });

    const handler = getHandler(0);
    const result = await handler(mockContext('json', true), {
      account: [],
      region: [],
      state: [],
      lifecycle: [],
    });
    expect(JSON.parse(result)).toEqual([
      { id: 'i-acc1-001', accountId: '123456789012', region: 'us-east-1', state: 'running' },
    ]);
  });

  it('forwards filters from Commander options including outdated', async () => {
    vi.mocked(listEc2Inventory).mockResolvedValue({
      instances: [],
      summary: { total: 0, accounts: 0, regions: 0 },
    });

    const handler = getHandler(0);
    await handler(mockContext(), {
      account: ['123456789012'],
      region: ['us-east-1'],
      state: ['running'],
      lifecycle: ['spot'],
      outdated: true,
    });

    expect(listEc2Inventory).toHaveBeenCalledWith('tok', 'org_1', {
      accounts: ['123456789012'],
      regions: ['us-east-1'],
      states: ['running'],
      lifecycles: ['spot'],
      outdated: true,
    });
  });

  it('renders "-" for null managedBy', async () => {
    vi.mocked(listEc2Inventory).mockResolvedValue({
      instances: [{ ...sampleInstance, managedBy: '' }],
      summary: { total: 1, accounts: 1, regions: 1 },
    });
    const handler = getHandler(0);
    const result = await handler(mockContext(), {
      account: [],
      region: [],
      state: [],
      lifecycle: [],
    });
    expect(result).toMatch(/-\s*\|/); // dash followed by separator (text)
  });
});
