import type { Command } from 'commander';
import { SummaryLineComponent } from '../components/summary-line.js';
import { TableComponent } from '../components/table.js';
import type { ComponentRenderFormat } from '../components/types.js';
import { PERMISSION_ACTIONS, withPermissionCheck } from '../context/permissions.js';
import type { CliContext } from '../core/context.js';
import type {
  EbsInventoryResponse,
  EbsVolume,
  Ec2Instance,
  Ec2InventoryResponse,
  EksCluster,
  EksInventoryResponse,
  EksNodegroupItem,
  EksNodegroupsResponse,
  ElasticacheCluster,
  ElasticacheInventoryResponse,
  NestedInventorySummary,
  OpensearchCluster,
  OpensearchInventoryResponse,
  OpensearchNode,
  OpensearchNodesResponse,
  RdsInstance,
  RdsInventoryResponse,
} from '../lib/api/inventory.js';
import { prettyJson } from '../lib/json.js';
import { listEbsInventory } from '../services/inventory/ebs.js';
import { listEc2Inventory } from '../services/inventory/ec2.js';
import { listEksInventory } from '../services/inventory/eks.js';
import { listEksNodegroups } from '../services/inventory/eks-nodegroups.js';
import { listElasticacheInventory } from '../services/inventory/elasticache.js';
import { listOpensearchInventory } from '../services/inventory/opensearch.js';
import { listOpensearchNodes } from '../services/inventory/opensearch-nodes.js';
import { listRdsInventory } from '../services/inventory/rds.js';
import { dash, formatBoolean, formatPriceMonthly } from './format.js';
import { prepareCall, wrapCommand } from './helpers.js';
import { collectString, parseInventoryFilters } from './inventory-options.js';

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerInventoryCommand(program: Command): void {
  const inventory = program.command('inventory').description('Inspect onboarded inventory');

  // Order here defines wrapCommand call indices used in tests.
  inventory
    .command('ec2')
    .description('List EC2 on-demand instances')
    .command('list')
    .description('List EC2 on-demand instances')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by state, e.g. running or stopped (repeatable)', collectString, [])
    .option('--lifecycle <lifecycle>', 'Filter by lifecycle, e.g. standard or spot (repeatable)', collectString, [])
    .option('--outdated', 'Show only instances flagged as outdated')
    .action(wrapCommand(ec2Handler));

  inventory
    .command('rds')
    .description('List RDS on-demand instances')
    .command('list')
    .description('List RDS on-demand instances')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .action(wrapCommand(rdsHandler));

  inventory
    .command('elasticache')
    .description('List ElastiCache on-demand clusters')
    .command('list')
    .description('List ElastiCache on-demand clusters')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by state, e.g. available (repeatable)', collectString, [])
    .action(wrapCommand(elasticacheHandler));

  const opensearch = inventory.command('opensearch').description('OpenSearch inventory');
  opensearch
    .command('list')
    .description('List OpenSearch on-demand clusters')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .action(wrapCommand(opensearchHandler));

  const eks = inventory.command('eks').description('EKS inventory');
  eks
    .command('list')
    .description('List EKS clusters')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by AWS cluster status (uppercase, e.g. ACTIVE) (repeatable)', collectString, [])
    .action(wrapCommand(eksHandler));

  inventory
    .command('ebs')
    .description('List EBS volumes')
    .command('list')
    .description('List EBS volumes')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by state, e.g. in-use or available (repeatable)', collectString, [])
    .action(wrapCommand(ebsHandler));

  // Nested-resource leaves registered last so existing wrapCommand mock indices
  // (0=ec2, 1=rds, 2=elasticache, 3=opensearch, 4=eks, 5=ebs) stay stable for
  // sibling tests. New indices: 6=eks/nodegroups, 7=opensearch/nodes.
  eks
    .command('nodegroups')
    .description('EKS node groups')
    .command('list')
    .description('List EKS node groups across all clusters')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by node-group status (uppercase, e.g. ACTIVE) (repeatable)', collectString, [])
    .option('--capacity <capacity>', 'Filter by capacity type (ON_DEMAND or SPOT) (repeatable)', collectString, [])
    .option('--cluster <id>', 'Filter by parent cluster ID (repeatable)', collectString, [])
    .option('--outdated', 'Show only node groups flagged as outdated')
    .action(wrapCommand(eksNodegroupsHandler));

  opensearch
    .command('nodes')
    .description('OpenSearch nodes')
    .command('list')
    .description('List OpenSearch nodes across all clusters')
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by node status (lowercase, e.g. active) (repeatable)', collectString, [])
    .option('--role <role>', 'Filter by role (data, master, or warm) (repeatable)', collectString, [])
    .option('--cluster <id>', 'Filter by parent cluster ID (repeatable)', collectString, [])
    .action(wrapCommand(opensearchNodesHandler));
}

// ---------------------------------------------------------------------------
// Shared render dispatch
// ---------------------------------------------------------------------------

function renderInventory<T>(
  context: CliContext,
  data: T,
  buildQuiet: () => unknown,
  buildFormatted: (format: ComponentRenderFormat) => string,
): string {
  if (context.config.isQuiet) return prettyJson(buildQuiet());
  if (context.config.renderFormat === 'json') return prettyJson(data);
  return buildFormatted(context.config.renderFormat as ComponentRenderFormat);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function ec2Handler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listEc2Inventory(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () => data.instances.map((i) => ({ id: i.id, accountId: i.accountId, region: i.region, state: i.state })),
    (format) => renderEc2(format, data),
  );
}

async function rdsHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listRdsInventory(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () => data.instances.map((i) => ({ id: i.id, accountId: i.accountId, region: i.region })),
    (format) => renderRds(format, data),
  );
}

async function elasticacheHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listElasticacheInventory(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () => data.clusters.map((c) => ({ id: c.id, accountId: c.accountId, region: c.region, state: c.state })),
    (format) => renderElasticache(format, data),
  );
}

async function opensearchHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listOpensearchInventory(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () => data.clusters.map((c) => ({ id: c.id, accountId: c.accountId, region: c.region })),
    (format) => renderOpensearch(format, data),
  );
}

async function eksHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listEksInventory(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () => data.clusters.map((c) => ({ id: c.id, accountId: c.accountId, region: c.region, state: c.status })),
    (format) => renderEks(format, data),
  );
}

async function ebsHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listEbsInventory(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () => data.volumes.map((v) => ({ id: v.id, accountId: v.accountId, region: v.region, state: v.state })),
    (format) => renderEbs(format, data),
  );
}

async function eksNodegroupsHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listEksNodegroups(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () =>
      data.nodeGroups.map((n) => ({
        id: n.id,
        clusterId: n.clusterId,
        accountId: n.accountId,
        region: n.region,
        state: n.status,
      })),
    (format) => renderEksNodegroups(format, data),
  );
}

async function opensearchNodesHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseInventoryFilters(options);
  const data = await withPermissionCheck(
    () => listOpensearchNodes(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderInventory(
    context,
    data,
    () =>
      data.nodes.map((n) => ({
        id: n.id,
        clusterId: n.clusterId,
        accountId: n.accountId,
        region: n.region,
        state: n.status,
      })),
    (format) => renderOpensearchNodes(format, data),
  );
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function summary(data: { summary: { total: number; accounts: number; regions: number } }, itemsLabel: string): string {
  return new SummaryLineComponent([
    [itemsLabel, data.summary.total],
    ['accounts', data.summary.accounts],
    ['regions', data.summary.regions],
  ]).renderText();
}

function renderEc2(format: ComponentRenderFormat, data: Ec2InventoryResponse): string {
  if (data.instances.length === 0) return `No instances found.\n\n${summary(data, 'instances')}`;
  const rows = data.instances.map((i: Ec2Instance) => ({
    id: i.id,
    type: i.type,
    region: i.region,
    state: i.state,
    managedBy: dash(i.managedBy),
    outdated: formatBoolean(i.outdated),
    account: i.accountId,
    price: formatPriceMonthly(i.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'managedBy', label: 'Managed by' },
      { key: 'outdated', label: 'Outdated' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${summary(data, 'instances')}`;
}

function renderRds(format: ComponentRenderFormat, data: RdsInventoryResponse): string {
  if (data.instances.length === 0) return `No instances found.\n\n${summary(data, 'instances')}`;
  const rows = data.instances.map((i: RdsInstance) => ({
    id: i.id,
    type: i.type,
    engine: i.platform,
    region: i.region,
    outdated: formatBoolean(i.outdated),
    account: i.accountId,
    price: formatPriceMonthly(i.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'engine', label: 'Engine' },
      { key: 'region', label: 'Region' },
      { key: 'outdated', label: 'Outdated' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${summary(data, 'instances')}`;
}

function renderElasticache(format: ComponentRenderFormat, data: ElasticacheInventoryResponse): string {
  if (data.clusters.length === 0) return `No clusters found.\n\n${summary(data, 'clusters')}`;
  const rows = data.clusters.map((c: ElasticacheCluster) => ({
    id: c.id,
    type: c.type,
    engine: c.platform,
    region: c.region,
    state: c.state,
    nodes: c.nodesCount,
    account: c.accountId,
    price: formatPriceMonthly(c.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'engine', label: 'Engine' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'nodes', label: 'Nodes' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${summary(data, 'clusters')}`;
}

function renderOpensearch(format: ComponentRenderFormat, data: OpensearchInventoryResponse): string {
  if (data.clusters.length === 0) return `No clusters found.\n\n${summary(data, 'clusters')}`;
  const rows = data.clusters.map((c: OpensearchCluster) => ({
    id: c.id,
    engine: c.platform,
    region: c.region,
    dataNodes: `${c.dataNodesCount}× ${c.dataNodesType}`,
    masterNodes: c.dedicatedMasterEnabled ? `${c.masterNodesCount}× ${c.masterNodesType}` : '-',
    multiAz: formatBoolean(c.multiAz),
    account: c.accountId,
    price: formatPriceMonthly(c.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'engine', label: 'Engine' },
      { key: 'region', label: 'Region' },
      { key: 'dataNodes', label: 'Data nodes' },
      { key: 'masterNodes', label: 'Master nodes' },
      { key: 'multiAz', label: 'Multi-AZ' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${summary(data, 'clusters')}`;
}

function renderEks(format: ComponentRenderFormat, data: EksInventoryResponse): string {
  if (data.clusters.length === 0) return `No clusters found.\n\n${summary(data, 'clusters')}`;
  const rows = data.clusters.map((c: EksCluster) => ({
    id: c.id,
    version: c.version,
    status: c.status,
    region: c.region,
    nodeGroups: c.nodeGroups.length,
    account: c.accountId,
    price: formatPriceMonthly(c.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'version', label: 'K8s version' },
      { key: 'status', label: 'Status' },
      { key: 'region', label: 'Region' },
      { key: 'nodeGroups', label: 'Node groups' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${summary(data, 'clusters')}`;
}

function renderEbs(format: ComponentRenderFormat, data: EbsInventoryResponse): string {
  if (data.volumes.length === 0) return `No volumes found.\n\n${summary(data, 'volumes')}`;
  const rows = data.volumes.map((v: EbsVolume) => ({
    id: v.id,
    type: v.type,
    region: v.region,
    state: v.state,
    size: v.size,
    outdated: formatBoolean(v.outdated),
    account: v.accountId,
    price: formatPriceMonthly(v.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'size', label: 'Size (GiB)' },
      { key: 'outdated', label: 'Outdated' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${summary(data, 'volumes')}`;
}

function nestedSummary(s: NestedInventorySummary, itemsLabel: string): string {
  return new SummaryLineComponent([
    [itemsLabel, s.total],
    ['clusters', s.clusters],
    ['accounts', s.accounts],
    ['regions', s.regions],
  ]).renderText();
}

function renderEksNodegroups(format: ComponentRenderFormat, data: EksNodegroupsResponse): string {
  if (data.nodeGroups.length === 0) return `No node groups found.\n\n${nestedSummary(data.summary, 'node groups')}`;
  const rows = data.nodeGroups.map((n: EksNodegroupItem) => ({
    id: n.id,
    cluster: n.clusterId,
    status: n.status,
    instanceTypes: n.instanceTypes.length === 0 ? '-' : n.instanceTypes.join(','),
    capacity: dash(n.capacityType),
    scaling: `${n.scalingMin}-${n.scalingDesired}-${n.scalingMax}`,
    outdated: formatBoolean(n.outdated),
    account: n.accountId,
    price: formatPriceMonthly(n.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'cluster', label: 'Cluster' },
      { key: 'status', label: 'Status' },
      { key: 'instanceTypes', label: 'Instance types' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'scaling', label: 'Scaling' },
      { key: 'outdated', label: 'Outdated' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${nestedSummary(data.summary, 'node groups')}`;
}

function renderOpensearchNodes(format: ComponentRenderFormat, data: OpensearchNodesResponse): string {
  if (data.nodes.length === 0) return `No nodes found.\n\n${nestedSummary(data.summary, 'nodes')}`;
  const rows = data.nodes.map((n: OpensearchNode) => ({
    id: n.id,
    cluster: n.clusterId,
    role: dash(n.role),
    type: n.type,
    status: n.status,
    az: n.availabilityZone,
    storage: `${n.storageSize} ${n.storageVolumeType}`,
    account: n.accountId,
    price: formatPriceMonthly(n.price),
  }));
  const table = new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'cluster', label: 'Cluster' },
      { key: 'role', label: 'Role' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'az', label: 'AZ' },
      { key: 'storage', label: 'Storage' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
  return `${table}\n\n${nestedSummary(data.summary, 'nodes')}`;
}
