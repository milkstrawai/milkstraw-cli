import { apiFetch } from './client.js';

// ---- Filter input ----------------------------------------------------------

export interface InventoryFilters {
  accounts?: string[];
  regions?: string[];
  states?: string[];
  lifecycles?: string[];
  capacities?: string[];
  roles?: string[];
  clusters?: string[];
  outdated?: boolean;
}

// ---- Summary --------------------------------------------------------------

export interface InventorySummary {
  total: number;
  accounts: number;
  regions: number;
}

interface RawInventorySummary {
  total: number;
  accounts: number;
  regions: number;
}

// ---- EC2 -------------------------------------------------------------------

export interface Ec2Instance {
  id: string;
  type: string;
  region: string;
  state: string;
  platform: string;
  launchTime: string;
  lifecycle: string;
  monitoring: string;
  outdated: boolean;
  // AWS-side enum: 'autoscaling' | 'ecs' | 'eks' | 'elasticbeanstalk' | 'standalone'.
  // Nullable because older rows may pre-date the writer that populates it.
  managedBy: string | null;
  price: number;
  tags: Record<string, string>;
  riCoveragePercentage: number | null;
  spCoveragePercentage: number | null;
  accountId: string;
}

export interface Ec2InventoryResponse {
  instances: Ec2Instance[];
  summary: InventorySummary;
}

interface RawEc2Instance {
  id: string;
  type: string;
  region: string;
  state: string;
  platform: string;
  launch_time: string;
  lifecycle: string;
  monitoring: string;
  outdated: boolean;
  managed_by?: string | null;
  price: number;
  tags: Record<string, string>;
  ri_coverage_percentage?: number | null;
  sp_coverage_percentage?: number | null;
  account_id: string;
}

interface RawEc2InventoryResponse {
  instances: RawEc2Instance[];
  summary: RawInventorySummary;
}

// ---- RDS -------------------------------------------------------------------

export interface RdsInstance {
  id: string;
  type: string;
  region: string;
  platform: string;
  platformVersion: string;
  multiAz: boolean;
  auroraIo: boolean;
  clusterId: string;
  readersIds: string[];
  encrypted: boolean;
  performanceInsightsEnabled: boolean;
  performanceInsightsRetentionDays: number;
  outdated: boolean;
  launchTime: string;
  price: number;
  tags: Record<string, string>;
  riCoveragePercentage: number | null;
  spCoveragePercentage: number | null;
  accountId: string;
}

export interface RdsInventoryResponse {
  instances: RdsInstance[];
  summary: InventorySummary;
}

interface RawRdsInstance {
  id: string;
  type: string;
  region: string;
  platform: string;
  platform_version?: string;
  multi_az: boolean;
  aurora_io: boolean;
  cluster_id: string;
  readers_ids: string[];
  encrypted: boolean;
  performance_insights_enabled: boolean;
  performance_insights_retention_days: number;
  outdated: boolean;
  launch_time: string;
  price: number;
  tags: Record<string, string>;
  ri_coverage_percentage?: number | null;
  sp_coverage_percentage?: number | null;
  account_id: string;
}

interface RawRdsInventoryResponse {
  instances: RawRdsInstance[];
  summary: RawInventorySummary;
}

// ---- ElastiCache -----------------------------------------------------------

export interface ElasticacheCluster {
  id: string;
  type: string;
  region: string;
  state: string;
  platform: string;
  nodesCount: number;
  replicationGroupId: string;
  transitEncryptionEnabled: boolean;
  transitEncryptionMode: string;
  atRestEncryptionEnabled: boolean;
  authTokenEnabled: boolean;
  logDeliveryEnabled: boolean;
  backupAgeRetentionInDays: number;
  minorVersionUpgradeEnabled: boolean;
  outdated: boolean;
  launchTime: string;
  price: number;
  tags: Record<string, string>;
  arn: string;
  riCoveragePercentage: number | null;
  spCoveragePercentage: number | null;
  accountId: string;
}

export interface ElasticacheInventoryResponse {
  clusters: ElasticacheCluster[];
  summary: InventorySummary;
}

interface RawElasticacheCluster {
  id: string;
  type: string;
  region: string;
  state: string;
  platform: string;
  nodes_count: number;
  replication_group_id: string;
  transit_encryption_enabled: boolean;
  transit_encryption_mode: string;
  at_rest_encryption_enabled: boolean;
  auth_token_enabled: boolean;
  log_delivery_enabled: boolean;
  backup_age_retention_in_days: number;
  minor_version_upgrade_enabled: boolean;
  outdated: boolean;
  launch_time: string;
  price: number;
  tags: Record<string, string>;
  arn: string;
  ri_coverage_percentage?: number | null;
  sp_coverage_percentage?: number | null;
  account_id: string;
}

interface RawElasticacheInventoryResponse {
  clusters: RawElasticacheCluster[];
  summary: RawInventorySummary;
}

// ---- OpenSearch ------------------------------------------------------------

export interface OpensearchCluster {
  id: string;
  region: string;
  platform: string;
  platformVersion: string;
  dataNodesCount: number;
  dataNodesType: string;
  masterNodesCount: number;
  masterNodesType: string;
  dedicatedMasterEnabled: boolean;
  warmEnabled: boolean;
  warmNodesCount: number;
  warmNodesType: string;
  multiAz: boolean;
  atRestEncryptionEnabled: boolean;
  nodeToNodeEncryptionEnabled: boolean;
  nodes: unknown[];
  price: number;
  tags: Record<string, string>;
  arn: string;
  riCoveragePercentage: number | null;
  spCoveragePercentage: number | null;
  accountId: string;
}

export interface OpensearchInventoryResponse {
  clusters: OpensearchCluster[];
  summary: InventorySummary;
}

interface RawOpensearchCluster {
  id: string;
  region: string;
  platform: string;
  platform_version: string;
  data_nodes_count: number;
  data_nodes_type: string;
  master_nodes_count: number;
  master_nodes_type: string;
  dedicated_master_enabled: boolean;
  warm_enabled: boolean;
  warm_nodes_count: number;
  warm_nodes_type: string;
  multi_az: boolean;
  at_rest_encryption_enabled: boolean;
  node_to_node_encryption_enabled: boolean;
  nodes: unknown[];
  price: number;
  tags: Record<string, string>;
  arn: string;
  ri_coverage_percentage?: number | null;
  sp_coverage_percentage?: number | null;
  account_id: string;
}

interface RawOpensearchInventoryResponse {
  clusters: RawOpensearchCluster[];
  summary: RawInventorySummary;
}

// ---- EKS -------------------------------------------------------------------

export interface EksNodeGroup {
  id: string;
  status: string;
  // We don't fully type node_groups — pass through the rest as unknowns to
  // keep this client narrow. CLI default table only shows count.
  [key: string]: unknown;
}

export interface EksCluster {
  id: string;
  region: string;
  version: string;
  platformVersion: string;
  status: string;
  endpoint: string;
  nodeGroups: EksNodeGroup[];
  createdAt: string;
  price: number;
  tags: Record<string, string>;
  arn: string;
  accountId: string;
}

export interface EksInventoryResponse {
  clusters: EksCluster[];
  summary: InventorySummary;
}

interface RawEksCluster {
  id: string;
  region: string;
  version: string;
  platform_version: string;
  status: string;
  endpoint: string;
  node_groups: Array<{ id: string; status: string; [key: string]: unknown }>;
  created_at: string;
  price: number;
  tags: Record<string, string>;
  arn: string;
  account_id: string;
}

interface RawEksInventoryResponse {
  clusters: RawEksCluster[];
  summary: RawInventorySummary;
}

// ---- EBS -------------------------------------------------------------------

export interface EbsVolume {
  id: string;
  type: string;
  region: string;
  state: string;
  size: number;
  iops: number;
  throughput: number;
  encrypted: boolean;
  availabilityZone: string;
  outpostArn: string;
  outdated: boolean;
  launchTime: string;
  price: number;
  tags: Record<string, string>;
  accountId: string;
}

export interface EbsInventoryResponse {
  volumes: EbsVolume[];
  summary: InventorySummary;
}

interface RawEbsVolume {
  id: string;
  type: string;
  region: string;
  state: string;
  size: number;
  iops: number;
  throughput: number;
  encrypted: boolean;
  availability_zone: string;
  outpost_arn: string;
  outdated: boolean;
  launch_time: string;
  price: number;
  tags: Record<string, string>;
  account_id: string;
}

interface RawEbsInventoryResponse {
  volumes: RawEbsVolume[];
  summary: RawInventorySummary;
}

// ---- Nested-resource summary (EKS nodegroups + OpenSearch nodes) -----------

export interface NestedInventorySummary {
  total: number;
  clusters: number;
  accounts: number;
  regions: number;
}

interface RawNestedInventorySummary {
  total: number;
  clusters: number;
  accounts: number;
  regions: number;
}

// ---- EKS NodegroupItem (new flat-list endpoint) ----------------------------
// Distinct from the loose `EksNodeGroup` type embedded in EksCluster — this
// is the strict shape returned by GET /inventory/eks/nodegroups, with the
// parent's cluster_id and account_id injected per row.

export interface EksNodegroupItem {
  id: string;
  status: string;
  version: string;
  amiType: string;
  instanceTypes: string[];
  capacityType: string;
  scalingMin: number;
  scalingDesired: number;
  scalingMax: number;
  diskSize: number;
  outdated: boolean;
  createdAt: string;
  region: string;
  price: number;
  labels: Record<string, string>;
  tags: Record<string, string>;
  arn: string;
  clusterId: string;
  accountId: string;
}

export interface EksNodegroupsResponse {
  nodeGroups: EksNodegroupItem[];
  summary: NestedInventorySummary;
}

interface RawEksNodegroupItem {
  id: string;
  status: string;
  version: string;
  ami_type: string;
  instance_types: string[];
  capacity_type: string;
  scaling_min: number;
  scaling_desired: number;
  scaling_max: number;
  disk_size: number;
  outdated: boolean;
  created_at: string;
  region: string;
  price: number;
  labels?: Record<string, string>;
  tags?: Record<string, string>;
  arn: string;
  cluster_id: string;
  account_id: string;
}

interface RawEksNodegroupsResponse {
  node_groups: RawEksNodegroupItem[];
  summary: RawNestedInventorySummary;
}

// ---- OpenSearch Node -------------------------------------------------------

export interface OpensearchNode {
  id: string;
  role: string;
  type: string;
  status: string;
  availabilityZone: string;
  storageSize: string;
  storageType: string;
  storageVolumeType: string;
  price: number;
  clusterId: string;
  accountId: string;
  region: string;
}

export interface OpensearchNodesResponse {
  nodes: OpensearchNode[];
  summary: NestedInventorySummary;
}

interface RawOpensearchNode {
  id: string;
  role: string;
  type: string;
  status: string;
  availability_zone: string;
  storage_size: string;
  storage_type: string;
  storage_volume_type: string;
  price: number;
  cluster_id: string;
  account_id: string;
  region: string;
}

interface RawOpensearchNodesResponse {
  nodes: RawOpensearchNode[];
  summary: RawNestedInventorySummary;
}

// ---- Re-used type shared with commitments client ---------------------------

export interface CommitmentsFilters {
  accounts?: string[];
  regions?: string[];
  states?: string[];
}

// ---- Public client functions ----------------------------------------------

export async function getEc2Inventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<Ec2InventoryResponse> {
  const path = `/api/organizations/${organizationId}/inventory/ec2${buildQuery(filters, ['accounts', 'regions', 'states', 'lifecycles', 'outdated'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawEc2InventoryResponse>();
  return {
    instances: raw.instances.map(normalizeEc2Instance),
    summary: { ...raw.summary },
  };
}

export async function getRdsInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<RdsInventoryResponse> {
  const path = `/api/organizations/${organizationId}/inventory/rds${buildQuery(filters, ['accounts', 'regions'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawRdsInventoryResponse>();
  return {
    instances: raw.instances.map(normalizeRdsInstance),
    summary: { ...raw.summary },
  };
}

export async function getElasticacheInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<ElasticacheInventoryResponse> {
  const path = `/api/organizations/${organizationId}/inventory/elasticache${buildQuery(filters, ['accounts', 'regions', 'states'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawElasticacheInventoryResponse>();
  return {
    clusters: raw.clusters.map(normalizeElasticacheCluster),
    summary: { ...raw.summary },
  };
}

export async function getOpensearchInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<OpensearchInventoryResponse> {
  const path = `/api/organizations/${organizationId}/inventory/opensearch${buildQuery(filters, ['accounts', 'regions'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawOpensearchInventoryResponse>();
  return {
    clusters: raw.clusters.map(normalizeOpensearchCluster),
    summary: { ...raw.summary },
  };
}

export async function getEksInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<EksInventoryResponse> {
  const path = `/api/organizations/${organizationId}/inventory/eks${buildQuery(filters, ['accounts', 'regions', 'states'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawEksInventoryResponse>();
  return {
    clusters: raw.clusters.map(normalizeEksCluster),
    summary: { ...raw.summary },
  };
}

export async function getEbsInventory(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<EbsInventoryResponse> {
  const path = `/api/organizations/${organizationId}/inventory/ebs${buildQuery(filters, ['accounts', 'regions', 'states'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawEbsInventoryResponse>();
  return {
    volumes: raw.volumes.map(normalizeEbsVolume),
    summary: { ...raw.summary },
  };
}

export async function getEksNodegroups(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<EksNodegroupsResponse> {
  const path = `/api/organizations/${organizationId}/inventory/eks/nodegroups${buildQuery(filters, ['accounts', 'regions', 'states', 'capacities', 'clusters', 'outdated'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawEksNodegroupsResponse>();
  return {
    nodeGroups: raw.node_groups.map(normalizeEksNodegroupItem),
    summary: { ...raw.summary },
  };
}

export async function getOpensearchNodes(
  token: string,
  organizationId: string,
  filters: InventoryFilters,
): Promise<OpensearchNodesResponse> {
  const path = `/api/organizations/${organizationId}/inventory/opensearch/nodes${buildQuery(filters, ['accounts', 'regions', 'states', 'roles', 'clusters'])}`;
  const response = await apiFetch(path, {}, token);
  const raw = await response.json<RawOpensearchNodesResponse>();
  return {
    nodes: raw.nodes.map(normalizeOpensearchNode),
    summary: { ...raw.summary },
  };
}

// ---- Query string builder --------------------------------------------------

type FilterKey = keyof InventoryFilters;

const ARRAY_FILTER_TO_PARAM: Record<Exclude<FilterKey, 'outdated'>, string> = {
  accounts: 'account',
  regions: 'region',
  states: 'state',
  lifecycles: 'lifecycle',
  capacities: 'capacity',
  roles: 'role',
  clusters: 'cluster',
};

function buildQuery(filters: InventoryFilters, allowed: FilterKey[]): string {
  const parts: string[] = [];
  for (const key of allowed) {
    if (key === 'outdated') {
      if (filters.outdated === true) parts.push('outdated=true');
      continue;
    }
    const param = ARRAY_FILTER_TO_PARAM[key];
    for (const value of filters[key] ?? []) {
      parts.push(`${param}[]=${encodeURIComponent(value)}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---- Normalizers -----------------------------------------------------------

function normalizeEc2Instance(raw: RawEc2Instance): Ec2Instance {
  return {
    id: raw.id,
    type: raw.type,
    region: raw.region,
    state: raw.state,
    platform: raw.platform,
    launchTime: raw.launch_time,
    lifecycle: raw.lifecycle,
    monitoring: raw.monitoring,
    outdated: raw.outdated,
    managedBy: raw.managed_by ?? null,
    price: raw.price,
    tags: raw.tags ?? {},
    riCoveragePercentage: raw.ri_coverage_percentage ?? null,
    spCoveragePercentage: raw.sp_coverage_percentage ?? null,
    accountId: raw.account_id,
  };
}

function normalizeRdsInstance(raw: RawRdsInstance): RdsInstance {
  return {
    id: raw.id,
    type: raw.type,
    region: raw.region,
    platform: raw.platform,
    platformVersion: raw.platform_version ?? '',
    multiAz: raw.multi_az,
    auroraIo: raw.aurora_io,
    clusterId: raw.cluster_id,
    readersIds: raw.readers_ids ?? [],
    encrypted: raw.encrypted,
    performanceInsightsEnabled: raw.performance_insights_enabled,
    performanceInsightsRetentionDays: raw.performance_insights_retention_days,
    outdated: raw.outdated,
    launchTime: raw.launch_time,
    price: raw.price,
    tags: raw.tags ?? {},
    riCoveragePercentage: raw.ri_coverage_percentage ?? null,
    spCoveragePercentage: raw.sp_coverage_percentage ?? null,
    accountId: raw.account_id,
  };
}

function normalizeElasticacheCluster(raw: RawElasticacheCluster): ElasticacheCluster {
  return {
    id: raw.id,
    type: raw.type,
    region: raw.region,
    state: raw.state,
    platform: raw.platform,
    nodesCount: raw.nodes_count,
    replicationGroupId: raw.replication_group_id,
    transitEncryptionEnabled: raw.transit_encryption_enabled,
    transitEncryptionMode: raw.transit_encryption_mode,
    atRestEncryptionEnabled: raw.at_rest_encryption_enabled,
    authTokenEnabled: raw.auth_token_enabled,
    logDeliveryEnabled: raw.log_delivery_enabled,
    backupAgeRetentionInDays: raw.backup_age_retention_in_days,
    minorVersionUpgradeEnabled: raw.minor_version_upgrade_enabled,
    outdated: raw.outdated,
    launchTime: raw.launch_time,
    price: raw.price,
    tags: raw.tags ?? {},
    arn: raw.arn,
    riCoveragePercentage: raw.ri_coverage_percentage ?? null,
    spCoveragePercentage: raw.sp_coverage_percentage ?? null,
    accountId: raw.account_id,
  };
}

function normalizeOpensearchCluster(raw: RawOpensearchCluster): OpensearchCluster {
  return {
    id: raw.id,
    region: raw.region,
    platform: raw.platform,
    platformVersion: raw.platform_version,
    dataNodesCount: raw.data_nodes_count,
    dataNodesType: raw.data_nodes_type,
    masterNodesCount: raw.master_nodes_count,
    masterNodesType: raw.master_nodes_type,
    dedicatedMasterEnabled: raw.dedicated_master_enabled,
    warmEnabled: raw.warm_enabled,
    warmNodesCount: raw.warm_nodes_count,
    warmNodesType: raw.warm_nodes_type,
    multiAz: raw.multi_az,
    atRestEncryptionEnabled: raw.at_rest_encryption_enabled,
    nodeToNodeEncryptionEnabled: raw.node_to_node_encryption_enabled,
    nodes: raw.nodes ?? [],
    price: raw.price,
    tags: raw.tags ?? {},
    arn: raw.arn,
    riCoveragePercentage: raw.ri_coverage_percentage ?? null,
    spCoveragePercentage: raw.sp_coverage_percentage ?? null,
    accountId: raw.account_id,
  };
}

function normalizeEksCluster(raw: RawEksCluster): EksCluster {
  return {
    id: raw.id,
    region: raw.region,
    version: raw.version,
    platformVersion: raw.platform_version,
    status: raw.status,
    endpoint: raw.endpoint,
    nodeGroups: raw.node_groups ?? [],
    createdAt: raw.created_at,
    price: raw.price,
    tags: raw.tags ?? {},
    arn: raw.arn,
    accountId: raw.account_id,
  };
}

function normalizeEbsVolume(raw: RawEbsVolume): EbsVolume {
  return {
    id: raw.id,
    type: raw.type,
    region: raw.region,
    state: raw.state,
    size: raw.size,
    iops: raw.iops,
    throughput: raw.throughput,
    encrypted: raw.encrypted,
    availabilityZone: raw.availability_zone,
    outpostArn: raw.outpost_arn,
    outdated: raw.outdated,
    launchTime: raw.launch_time,
    price: raw.price,
    tags: raw.tags ?? {},
    accountId: raw.account_id,
  };
}

function normalizeEksNodegroupItem(raw: RawEksNodegroupItem): EksNodegroupItem {
  return {
    id: raw.id,
    status: raw.status,
    version: raw.version,
    amiType: raw.ami_type,
    instanceTypes: raw.instance_types ?? [],
    capacityType: raw.capacity_type,
    scalingMin: raw.scaling_min,
    scalingDesired: raw.scaling_desired,
    scalingMax: raw.scaling_max,
    diskSize: raw.disk_size,
    outdated: raw.outdated,
    createdAt: raw.created_at,
    region: raw.region,
    price: raw.price,
    labels: raw.labels ?? {},
    tags: raw.tags ?? {},
    arn: raw.arn,
    clusterId: raw.cluster_id,
    accountId: raw.account_id,
  };
}

function normalizeOpensearchNode(raw: RawOpensearchNode): OpensearchNode {
  return {
    id: raw.id,
    role: raw.role,
    type: raw.type,
    status: raw.status,
    availabilityZone: raw.availability_zone,
    storageSize: raw.storage_size,
    storageType: raw.storage_type,
    storageVolumeType: raw.storage_volume_type,
    price: raw.price,
    clusterId: raw.cluster_id,
    accountId: raw.account_id,
    region: raw.region,
  };
}
