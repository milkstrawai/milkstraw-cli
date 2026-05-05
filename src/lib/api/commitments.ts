import { apiFetch } from './client.js';
import type { CommitmentsFilters } from './inventory.js';

export type { CommitmentsFilters } from './inventory.js';

// ---- Summary --------------------------------------------------------------

export interface CommitmentsSummary {
  total: number;
  active: number;
  accounts: number;
}

interface RawCommitmentsSummary {
  total: number;
  active: number;
  accounts: number;
}

// ---- RI base shapes -------------------------------------------------------

interface BaseReservedInstance {
  id: string;
  type: string;
  count: number;
  region: string;
  state: string;
  paymentOption: string;
  startTime: string;
  endTime: string;
  duration: number;
  onDemandPrice: number;
  commitmentPrice: number;
  savings: number;
  managedBy: string | null;
  utilizationPercentage: number | null;
  actualSavings: number | null;
  originalPrice: number | null;
  accountId: string;
}

interface RawBaseReservedInstance {
  id: string;
  type: string;
  count: number;
  region: string;
  state: string;
  payment_option: string;
  start_time: string;
  end_time: string;
  duration: number;
  on_demand_price: number;
  commitment_price: number;
  savings: number;
  managed_by?: 'aws' | 'milkstraw' | null;
  utilization_percentage?: number | null;
  actual_savings?: number | null;
  original_price?: number | null;
  account_id: string;
}

export interface Ec2ReservedInstance extends BaseReservedInstance {
  platform: string;
  offeringClass: string;
}
interface RawEc2ReservedInstance extends RawBaseReservedInstance {
  platform: string;
  offering_class: string;
}

export interface RdsReservedInstance extends BaseReservedInstance {
  platform: string;
  multiAz: boolean;
}
interface RawRdsReservedInstance extends RawBaseReservedInstance {
  platform: string;
  multi_az: boolean;
}

export interface ElasticacheReservedInstance extends BaseReservedInstance {
  platform: string;
}
interface RawElasticacheReservedInstance extends RawBaseReservedInstance {
  platform: string;
}

// OpenSearch RIs have no `platform` field on the wire — the type is just the
// base shape with no additions. Kept as a named alias for symmetry with the
// other RI types.
export type OpensearchReservedInstance = BaseReservedInstance;
type RawOpensearchReservedInstance = RawBaseReservedInstance;

export interface Ec2CommitmentsResponse {
  items: Ec2ReservedInstance[];
  summary: CommitmentsSummary;
}
export interface RdsCommitmentsResponse {
  items: RdsReservedInstance[];
  summary: CommitmentsSummary;
}
export interface ElasticacheCommitmentsResponse {
  items: ElasticacheReservedInstance[];
  summary: CommitmentsSummary;
}
export interface OpensearchCommitmentsResponse {
  items: OpensearchReservedInstance[];
  summary: CommitmentsSummary;
}

interface RawEc2CommitmentsResponse {
  items: RawEc2ReservedInstance[];
  summary: RawCommitmentsSummary;
}
interface RawRdsCommitmentsResponse {
  items: RawRdsReservedInstance[];
  summary: RawCommitmentsSummary;
}
interface RawElasticacheCommitmentsResponse {
  items: RawElasticacheReservedInstance[];
  summary: RawCommitmentsSummary;
}
interface RawOpensearchCommitmentsResponse {
  items: RawOpensearchReservedInstance[];
  summary: RawCommitmentsSummary;
}

// ---- Savings Plan ---------------------------------------------------------

export interface SavingsPlan {
  id: string;
  service: string;
  region: string;
  family: string;
  commitment: number;
  cost: number;
  paymentOption: string;
  upFrontAmount: string;
  recurringAmount: string;
  startTime: string;
  endTime: string;
  state: string;
  savings: number;
  managedBy: string | null;
  utilizationPercentage: number | null;
  actualSavings: number | null;
  originalPrice: number | null;
  accountId: string;
}

interface RawSavingsPlan {
  id: string;
  service: string;
  region: string;
  family: string;
  commitment: number;
  cost: number;
  payment_option: string;
  up_front_amount: string;
  recurring_amount: string;
  start_time: string;
  end_time: string;
  state: string;
  savings: number;
  managed_by?: 'aws' | 'milkstraw' | null;
  utilization_percentage?: number | null;
  actual_savings?: number | null;
  original_price?: number | null;
  account_id: string;
}

export interface SavingsPlansResponse {
  items: SavingsPlan[];
  summary: CommitmentsSummary;
}
interface RawSavingsPlansResponse {
  items: RawSavingsPlan[];
  summary: RawCommitmentsSummary;
}

// ---- Public client functions ----------------------------------------------

export async function getEc2Commitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<Ec2CommitmentsResponse> {
  const path = `/api/organizations/${organizationId}/commitments/ec2${buildQuery(filters)}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawEc2CommitmentsResponse>();
  return {
    items: raw.items.map(normalizeEc2Ri),
    summary: { ...raw.summary },
  };
}

export async function getRdsCommitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<RdsCommitmentsResponse> {
  const path = `/api/organizations/${organizationId}/commitments/rds${buildQuery(filters)}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawRdsCommitmentsResponse>();
  return {
    items: raw.items.map(normalizeRdsRi),
    summary: { ...raw.summary },
  };
}

export async function getElasticacheCommitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<ElasticacheCommitmentsResponse> {
  const path = `/api/organizations/${organizationId}/commitments/elasticache${buildQuery(filters)}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawElasticacheCommitmentsResponse>();
  return {
    items: raw.items.map(normalizeElasticacheRi),
    summary: { ...raw.summary },
  };
}

export async function getOpensearchCommitments(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<OpensearchCommitmentsResponse> {
  const path = `/api/organizations/${organizationId}/commitments/opensearch${buildQuery(filters)}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawOpensearchCommitmentsResponse>();
  return {
    items: raw.items.map(normalizeOpensearchRi),
    summary: { ...raw.summary },
  };
}

export async function getComputeSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getSavingsPlans(token, organizationId, filters, 'compute');
}
export async function getEc2InstanceSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getSavingsPlans(token, organizationId, filters, 'ec2_instance');
}
export async function getSageMakerSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getSavingsPlans(token, organizationId, filters, 'sage_maker');
}
export async function getDatabaseSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
): Promise<SavingsPlansResponse> {
  return getSavingsPlans(token, organizationId, filters, 'database');
}

async function getSavingsPlans(
  token: string,
  organizationId: string,
  filters: CommitmentsFilters,
  service: 'compute' | 'ec2_instance' | 'sage_maker' | 'database',
): Promise<SavingsPlansResponse> {
  const path = `/api/organizations/${organizationId}/commitments/savings_plans/${service}${buildQuery(filters)}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawSavingsPlansResponse>();
  return {
    items: raw.items.map(normalizeSavingsPlan),
    summary: { ...raw.summary },
  };
}

// ---- Query builder --------------------------------------------------------

function buildQuery(filters: CommitmentsFilters): string {
  const parts: string[] = [];
  for (const v of filters.accounts ?? []) parts.push(`account[]=${encodeURIComponent(v)}`);
  for (const v of filters.regions ?? []) parts.push(`region[]=${encodeURIComponent(v)}`);
  for (const v of filters.states ?? []) parts.push(`state[]=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---- Normalizers ----------------------------------------------------------

function normalizeBaseRi(raw: RawBaseReservedInstance): BaseReservedInstance {
  return {
    id: raw.id,
    type: raw.type,
    count: raw.count,
    region: raw.region,
    state: raw.state,
    paymentOption: raw.payment_option,
    startTime: raw.start_time,
    endTime: raw.end_time,
    duration: raw.duration,
    onDemandPrice: raw.on_demand_price,
    commitmentPrice: raw.commitment_price,
    savings: raw.savings,
    managedBy: raw.managed_by ?? null,
    utilizationPercentage: raw.utilization_percentage ?? null,
    actualSavings: raw.actual_savings ?? null,
    originalPrice: raw.original_price ?? null,
    accountId: raw.account_id,
  };
}

function normalizeEc2Ri(raw: RawEc2ReservedInstance): Ec2ReservedInstance {
  return {
    ...normalizeBaseRi(raw),
    platform: raw.platform,
    offeringClass: raw.offering_class,
  };
}

function normalizeRdsRi(raw: RawRdsReservedInstance): RdsReservedInstance {
  return {
    ...normalizeBaseRi(raw),
    platform: raw.platform,
    multiAz: raw.multi_az,
  };
}

function normalizeElasticacheRi(raw: RawElasticacheReservedInstance): ElasticacheReservedInstance {
  return {
    ...normalizeBaseRi(raw),
    platform: raw.platform,
  };
}

function normalizeOpensearchRi(raw: RawOpensearchReservedInstance): OpensearchReservedInstance {
  return normalizeBaseRi(raw);
}

function normalizeSavingsPlan(raw: RawSavingsPlan): SavingsPlan {
  return {
    id: raw.id,
    service: raw.service,
    region: raw.region,
    family: raw.family,
    commitment: raw.commitment,
    cost: raw.cost,
    paymentOption: raw.payment_option,
    upFrontAmount: raw.up_front_amount,
    recurringAmount: raw.recurring_amount,
    startTime: raw.start_time,
    endTime: raw.end_time,
    state: raw.state,
    savings: raw.savings,
    managedBy: raw.managed_by ?? null,
    utilizationPercentage: raw.utilization_percentage ?? null,
    actualSavings: raw.actual_savings ?? null,
    originalPrice: raw.original_price ?? null,
    accountId: raw.account_id,
  };
}
