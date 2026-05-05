import type { Command } from 'commander';
import { SummaryLineComponent } from '../components/summary-line.js';
import { TableComponent } from '../components/table.js';
import type { ComponentRenderFormat } from '../components/types.js';
import { PERMISSION_ACTIONS, withPermissionCheck } from '../context/permissions.js';
import type { CliContext } from '../core/context.js';
import type {
  Ec2CommitmentsResponse,
  Ec2ReservedInstance,
  ElasticacheCommitmentsResponse,
  ElasticacheReservedInstance,
  OpensearchCommitmentsResponse,
  OpensearchReservedInstance,
  RdsCommitmentsResponse,
  RdsReservedInstance,
  SavingsPlan,
  SavingsPlansResponse,
} from '../lib/api/commitments.js';
import { prettyJson } from '../lib/json.js';
import { listEc2Commitments } from '../services/commitments/ec2.js';
import { listElasticacheCommitments } from '../services/commitments/elasticache.js';
import { listOpensearchCommitments } from '../services/commitments/opensearch.js';
import { listRdsCommitments } from '../services/commitments/rds.js';
import { listComputeSavingsPlans } from '../services/commitments/savings_plans/compute.js';
import { listDatabaseSavingsPlans } from '../services/commitments/savings_plans/database.js';
import { listEc2InstanceSavingsPlans } from '../services/commitments/savings_plans/ec2_instance.js';
import { listSageMakerSavingsPlans } from '../services/commitments/savings_plans/sage_maker.js';
import { dash, formatCommitmentHourly, formatPercentage, formatPriceMonthly } from './format.js';
import { prepareCall, wrapCommand } from './helpers.js';
import { collectString, parseCommitmentsFilters } from './inventory-options.js';

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCommitmentsCommand(program: Command): void {
  const commitments = program
    .command('commitments')
    .description('Inspect commitments (Reserved Instances + Savings Plans)');

  // 0..3: RI leaves (in order: ec2, rds, elasticache, opensearch).
  registerRiLeaf(commitments, 'ec2', 'EC2 Reserved Instances', ec2RiHandler);
  registerRiLeaf(commitments, 'rds', 'RDS Reserved Instances', rdsRiHandler);
  registerRiLeaf(commitments, 'elasticache', 'ElastiCache Reserved Instances', elasticacheRiHandler);
  registerRiLeaf(commitments, 'opensearch', 'OpenSearch Reserved Instances', opensearchRiHandler);

  // 4..7: SP leaves under `savings_plans`.
  const savingsPlans = commitments.command('savings_plans').description('Savings Plans by AWS service category');
  registerSpLeaf(savingsPlans, 'compute', 'Compute Savings Plans', computeSpHandler);
  registerSpLeaf(savingsPlans, 'ec2_instance', 'EC2 Instance Savings Plans', ec2InstanceSpHandler);
  registerSpLeaf(savingsPlans, 'sage_maker', 'SageMaker Savings Plans', sageMakerSpHandler);
  registerSpLeaf(savingsPlans, 'database', 'Database Savings Plans', databaseSpHandler);
}

function registerRiLeaf(
  parent: Command,
  name: string,
  description: string,
  handler: (context: CliContext, options: Record<string, unknown>) => Promise<string>,
): void {
  parent
    .command(name)
    .description(description)
    .command('list')
    .description(description)
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by state — defaults to active|returned|retired (repeatable)', collectString, [])
    .action(wrapCommand(handler));
}

function registerSpLeaf(
  parent: Command,
  name: string,
  description: string,
  handler: (context: CliContext, options: Record<string, unknown>) => Promise<string>,
): void {
  parent
    .command(name)
    .description(description)
    .command('list')
    .description(description)
    .option('--account <id>', 'Filter by AWS account ID (repeatable)', collectString, [])
    .option('--region <region>', 'Filter by region (repeatable)', collectString, [])
    .option('--state <state>', 'Filter by state — defaults to active|returned|retired (repeatable)', collectString, [])
    .action(wrapCommand(handler));
}

// ---------------------------------------------------------------------------
// RI handlers
// ---------------------------------------------------------------------------

async function ec2RiHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listEc2Commitments(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildEc2RiRows);
}

async function rdsRiHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listRdsCommitments(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildRdsRiRows);
}

async function elasticacheRiHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listElasticacheCommitments(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildElasticacheRiRows);
}

async function opensearchRiHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listOpensearchCommitments(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildOpensearchRiRows);
}

// ---------------------------------------------------------------------------
// SP handlers
// ---------------------------------------------------------------------------

async function computeSpHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listComputeSavingsPlans(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildSpRows);
}
async function ec2InstanceSpHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listEc2InstanceSavingsPlans(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildSpRows);
}
async function sageMakerSpHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listSageMakerSavingsPlans(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildSpRows);
}
async function databaseSpHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const { token, organizationId, organizationName } = await prepareCall(context, options);
  const filters = parseCommitmentsFilters(options);
  const data = await withPermissionCheck(
    () => listDatabaseSavingsPlans(token, organizationId, filters),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationId,
    organizationName,
  );
  return renderCommitments(context, data, buildSpRows);
}

// ---------------------------------------------------------------------------
// Shared render plumbing
// ---------------------------------------------------------------------------

interface CommitmentsBody {
  items: Array<{ id: string; accountId: string; region: string; state: string }>;
  summary: { total: number; active: number; accounts: number };
}

function renderCommitments<T extends CommitmentsBody>(
  context: CliContext,
  data: T,
  buildTable: (data: T, format: ComponentRenderFormat) => string,
): string {
  if (context.config.isQuiet) {
    return prettyJson(
      data.items.map((it) => ({
        id: it.id,
        accountId: it.accountId,
        region: it.region,
        state: it.state,
      })),
    );
  }
  if (context.config.renderFormat === 'json') return prettyJson(data);
  // The JSON branch above already returned, so renderFormat is now narrowed
  // to text|markdown — both valid ComponentRenderFormat values.
  const format = context.config.renderFormat as ComponentRenderFormat;
  const body = data.items.length === 0 ? 'No items found.' : buildTable(data, format);
  const summary = new SummaryLineComponent([
    ['items', data.summary.total],
    ['active', data.summary.active],
    ['accounts', data.summary.accounts],
  ]).renderText();
  return `${body}\n\n${summary}`;
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function buildEc2RiRows(data: Ec2CommitmentsResponse, format: ComponentRenderFormat): string {
  const rows = data.items.map((r: Ec2ReservedInstance) => ({
    id: r.id,
    type: r.type,
    count: r.count,
    region: r.region,
    state: r.state,
    util: formatPercentage(r.utilizationPercentage),
    managedBy: dash(r.managedBy),
    account: r.accountId,
    price: formatPriceMonthly(r.commitmentPrice),
  }));
  return new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'count', label: 'Count' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'util', label: 'Util %' },
      { key: 'managedBy', label: 'Managed by' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
}

function buildRdsRiRows(data: RdsCommitmentsResponse, format: ComponentRenderFormat): string {
  const rows = data.items.map((r: RdsReservedInstance) => ({
    id: r.id,
    type: r.type,
    count: r.count,
    engine: r.platform,
    region: r.region,
    state: r.state,
    util: formatPercentage(r.utilizationPercentage),
    managedBy: dash(r.managedBy),
    account: r.accountId,
    price: formatPriceMonthly(r.commitmentPrice),
  }));
  return new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'count', label: 'Count' },
      { key: 'engine', label: 'Engine' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'util', label: 'Util %' },
      { key: 'managedBy', label: 'Managed by' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
}

function buildElasticacheRiRows(data: ElasticacheCommitmentsResponse, format: ComponentRenderFormat): string {
  const rows = data.items.map((r: ElasticacheReservedInstance) => ({
    id: r.id,
    type: r.type,
    count: r.count,
    engine: r.platform,
    region: r.region,
    state: r.state,
    util: formatPercentage(r.utilizationPercentage),
    managedBy: dash(r.managedBy),
    account: r.accountId,
    price: formatPriceMonthly(r.commitmentPrice),
  }));
  return new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'count', label: 'Count' },
      { key: 'engine', label: 'Engine' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'util', label: 'Util %' },
      { key: 'managedBy', label: 'Managed by' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
}

function buildOpensearchRiRows(data: OpensearchCommitmentsResponse, format: ComponentRenderFormat): string {
  const rows = data.items.map((r: OpensearchReservedInstance) => ({
    id: r.id,
    type: r.type,
    count: r.count,
    region: r.region,
    state: r.state,
    util: formatPercentage(r.utilizationPercentage),
    managedBy: dash(r.managedBy),
    account: r.accountId,
    price: formatPriceMonthly(r.commitmentPrice),
  }));
  return new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'count', label: 'Count' },
      { key: 'region', label: 'Region' },
      { key: 'state', label: 'State' },
      { key: 'util', label: 'Util %' },
      { key: 'managedBy', label: 'Managed by' },
      { key: 'account', label: 'Account' },
      { key: 'price', label: 'Price ($/mo)' },
    ],
  }).render(format);
}

function buildSpRows(data: SavingsPlansResponse, format: ComponentRenderFormat): string {
  const rows = data.items.map((s: SavingsPlan) => ({
    id: s.id,
    region: s.region,
    family: s.family,
    state: s.state,
    util: formatPercentage(s.utilizationPercentage),
    commitment: formatCommitmentHourly(s.commitment),
    savings: formatPriceMonthly(s.savings),
    managedBy: dash(s.managedBy),
    account: s.accountId,
  }));
  return new TableComponent({
    rows,
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'region', label: 'Region' },
      { key: 'family', label: 'Family' },
      { key: 'state', label: 'State' },
      { key: 'util', label: 'Util %' },
      { key: 'commitment', label: 'Commitment ($/hr)' },
      { key: 'savings', label: 'Savings ($/mo)' },
      { key: 'managedBy', label: 'Managed by' },
      { key: 'account', label: 'Account' },
    ],
  }).render(format);
}
