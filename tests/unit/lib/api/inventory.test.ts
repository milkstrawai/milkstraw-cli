import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
vi.mock('../../../../src/lib/api/client.js', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  initializeApiTransport: vi.fn(),
}));

const {
  getEc2Inventory,
  getRdsInventory,
  getElasticacheInventory,
  getOpensearchInventory,
  getEksInventory,
  getEbsInventory,
  getEksNodegroups,
  getOpensearchNodes,
} = await import('../../../../src/lib/api/inventory.js');

function mockResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {},
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

beforeEach(() => mockApiFetch.mockReset());

const baseSummary = { total: 0, accounts: 0, regions: 0 };

// ---------------------------------------------------------------------------
// getEc2Inventory
// ---------------------------------------------------------------------------
describe('getEc2Inventory', () => {
  it('hits the inventory ec2 endpoint with no filters', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ instances: [], summary: baseSummary }));
    await getEc2Inventory('tok', 'org_1', {});
    expect(mockApiFetch).toHaveBeenCalledWith('/api/organizations/org_1/inventory/ec2', {}, 'tok');
  });

  it('builds [] arrays for accounts/regions/states/lifecycles and adds outdated as scalar', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ instances: [], summary: baseSummary }));
    await getEc2Inventory('tok', 'org_1', {
      accounts: ['111111111111', '222222222222'],
      regions: ['us-east-1'],
      states: ['running'],
      lifecycles: ['spot'],
      outdated: true,
    });
    expect(mockApiFetch.mock.calls[0][0]).toBe(
      '/api/organizations/org_1/inventory/ec2' +
        '?account[]=111111111111&account[]=222222222222' +
        '&region[]=us-east-1' +
        '&state[]=running' +
        '&lifecycle[]=spot' +
        '&outdated=true',
    );
  });

  it('omits outdated when undefined', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ instances: [], summary: baseSummary }));
    await getEc2Inventory('tok', 'org_1', { regions: ['us-east-1'] });
    expect(mockApiFetch.mock.calls[0][0]).not.toContain('outdated');
  });

  it('normalizes EC2 instance snake_case fields to camelCase', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        instances: [
          {
            id: 'i-a',
            type: 'm5.large',
            region: 'us-east-1',
            state: 'running',
            platform: 'Linux/UNIX',
            launch_time: '2026-04-15T12:00:00Z',
            lifecycle: 'standard',
            monitoring: 'disabled',
            outdated: false,
            managed_by: 'standalone',
            price: 0.096,
            tags: { env: 'prod' },
            ri_coverage_percentage: 80,
            sp_coverage_percentage: 10,
            account_id: '111111111111',
          },
        ],
        summary: { total: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getEc2Inventory('tok', 'org_1', {});
    expect(result.instances[0]).toEqual({
      id: 'i-a',
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
      riCoveragePercentage: 80,
      spCoveragePercentage: 10,
      accountId: '111111111111',
    });
    expect(result.summary).toEqual({ total: 1, accounts: 1, regions: 1 });
  });
});

// ---------------------------------------------------------------------------
// getRdsInventory
// ---------------------------------------------------------------------------
describe('getRdsInventory', () => {
  it('hits the inventory rds endpoint with no filters', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ instances: [], summary: baseSummary }));
    await getRdsInventory('tok', 'org_1', {});
    expect(mockApiFetch).toHaveBeenCalledWith('/api/organizations/org_1/inventory/rds', {}, 'tok');
  });

  it('forwards account + region only (rds has no state/lifecycle/outdated filter)', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ instances: [], summary: baseSummary }));
    await getRdsInventory('tok', 'org_1', {
      accounts: ['111'],
      regions: ['us-east-1'],
      // states/lifecycles/outdated should be silently dropped — RDS endpoint doesn't accept them
      states: ['available'],
      lifecycles: ['standard'],
      outdated: true,
    });
    expect(mockApiFetch.mock.calls[0][0]).toBe(
      '/api/organizations/org_1/inventory/rds?account[]=111&region[]=us-east-1',
    );
  });

  it('normalizes RDS rich fields including readers + perf insights', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        instances: [
          {
            id: 'atlas',
            type: 'db.t3.small',
            region: 'us-east-1',
            platform: 'postgresql',
            platform_version: '14.10',
            multi_az: false,
            aurora_io: false,
            cluster_id: 'N/A',
            readers_ids: ['r1', 'r2'],
            encrypted: true,
            performance_insights_enabled: false,
            performance_insights_retention_days: 0,
            outdated: false,
            launch_time: '2017-07-26T15:11:55.166Z',
            price: 26.27,
            tags: { proyecto: 'atlas' },
            account_id: '928751460984',
          },
        ],
        summary: { total: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getRdsInventory('tok', 'org_1', {});
    expect(result.instances[0]).toMatchObject({
      id: 'atlas',
      platform: 'postgresql',
      platformVersion: '14.10',
      multiAz: false,
      auroraIo: false,
      clusterId: 'N/A',
      readersIds: ['r1', 'r2'],
      encrypted: true,
      performanceInsightsEnabled: false,
      performanceInsightsRetentionDays: 0,
      launchTime: '2017-07-26T15:11:55.166Z',
      accountId: '928751460984',
    });
  });
});

// ---------------------------------------------------------------------------
// getElasticacheInventory
// ---------------------------------------------------------------------------
describe('getElasticacheInventory', () => {
  it('uses the elasticache endpoint and returns clusters key', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ clusters: [], summary: baseSummary }));
    const result = await getElasticacheInventory('tok', 'org_1', {});
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/elasticache');
    expect(result.clusters).toEqual([]);
  });

  it('forwards account + region + state', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ clusters: [], summary: baseSummary }));
    await getElasticacheInventory('tok', 'org_1', { regions: ['us-east-1'], states: ['available'] });
    expect(mockApiFetch.mock.calls[0][0]).toBe(
      '/api/organizations/org_1/inventory/elasticache?region[]=us-east-1&state[]=available',
    );
  });

  it('normalizes core fields', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        clusters: [
          {
            id: 'cluster-1',
            type: 'cache.t2.micro',
            region: 'us-east-1',
            state: 'available',
            platform: 'redis',
            nodes_count: 1,
            replication_group_id: 'rg-1',
            transit_encryption_enabled: false,
            transit_encryption_mode: 'N/A',
            at_rest_encryption_enabled: false,
            auth_token_enabled: false,
            log_delivery_enabled: false,
            backup_age_retention_in_days: 0,
            minor_version_upgrade_enabled: true,
            outdated: true,
            launch_time: '2023-05-08T15:23:15.604Z',
            price: 12.41,
            tags: {},
            arn: 'arn:aws:elasticache:...',
            account_id: '928751460984',
          },
        ],
        summary: { total: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getElasticacheInventory('tok', 'org_1', {});
    expect(result.clusters[0]).toMatchObject({
      id: 'cluster-1',
      type: 'cache.t2.micro',
      nodesCount: 1,
      replicationGroupId: 'rg-1',
      transitEncryptionEnabled: false,
      atRestEncryptionEnabled: false,
      authTokenEnabled: false,
      logDeliveryEnabled: false,
      backupAgeRetentionInDays: 0,
      minorVersionUpgradeEnabled: true,
      accountId: '928751460984',
    });
  });
});

// ---------------------------------------------------------------------------
// getOpensearchInventory
// ---------------------------------------------------------------------------
describe('getOpensearchInventory', () => {
  it('uses the opensearch endpoint and returns clusters key', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ clusters: [], summary: baseSummary }));
    await getOpensearchInventory('tok', 'org_1', {});
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/opensearch');
  });

  it('forwards account + region only (no state)', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ clusters: [], summary: baseSummary }));
    await getOpensearchInventory('tok', 'org_1', {
      regions: ['eu-west-1'],
      states: ['available'], // dropped silently
    });
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/opensearch?region[]=eu-west-1');
  });

  it('normalizes opensearch nested node fields', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        clusters: [
          {
            id: '688897985026/demo',
            region: 'eu-west-1',
            platform: 'Elasticsearch',
            platform_version: '7.10',
            data_nodes_count: 3,
            data_nodes_type: 'r7g.xlarge.search',
            master_nodes_count: 3,
            master_nodes_type: 'm6g.large.search',
            dedicated_master_enabled: false,
            warm_enabled: false,
            warm_nodes_count: 0,
            warm_nodes_type: 'N/A',
            multi_az: false,
            at_rest_encryption_enabled: false,
            node_to_node_encryption_enabled: false,
            nodes: [],
            price: 1274.58,
            tags: {},
            arn: 'arn:aws:es:...',
            account_id: '688897985026',
          },
        ],
        summary: { total: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getOpensearchInventory('tok', 'org_1', {});
    expect(result.clusters[0]).toMatchObject({
      dataNodesCount: 3,
      dataNodesType: 'r7g.xlarge.search',
      masterNodesCount: 3,
      masterNodesType: 'm6g.large.search',
      dedicatedMasterEnabled: false,
      warmEnabled: false,
      warmNodesCount: 0,
      warmNodesType: 'N/A',
      multiAz: false,
      nodeToNodeEncryptionEnabled: false,
    });
  });
});

// ---------------------------------------------------------------------------
// getEksInventory
// ---------------------------------------------------------------------------
describe('getEksInventory', () => {
  it('uses the eks endpoint and returns clusters key', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ clusters: [], summary: baseSummary }));
    await getEksInventory('tok', 'org_1', {});
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/eks');
  });

  it('forwards state filter as state[] (api maps it to status)', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ clusters: [], summary: baseSummary }));
    await getEksInventory('tok', 'org_1', { states: ['ACTIVE'] });
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/eks?state[]=ACTIVE');
  });

  it('preserves the status field and node_groups array on the normalized cluster', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        clusters: [
          {
            id: 'eks-cluster',
            region: 'ap-south-1',
            version: '1.33',
            platform_version: 'eks.33',
            status: 'ACTIVE',
            endpoint: 'https://...eks...',
            node_groups: [{ id: 'ng-1', status: 'ACTIVE' }],
            created_at: '2026-03-24T11:37:52.332+00:00',
            price: 73.0,
            tags: {},
            arn: 'arn:aws:eks:...',
            account_id: '897722682562',
          },
        ],
        summary: { total: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getEksInventory('tok', 'org_1', {});
    expect(result.clusters[0]).toMatchObject({
      id: 'eks-cluster',
      status: 'ACTIVE',
      version: '1.33',
      platformVersion: 'eks.33',
      createdAt: '2026-03-24T11:37:52.332+00:00',
      nodeGroups: [{ id: 'ng-1', status: 'ACTIVE' }],
      accountId: '897722682562',
    });
  });
});

// ---------------------------------------------------------------------------
// getEbsInventory
// ---------------------------------------------------------------------------
describe('getEbsInventory', () => {
  it('uses the ebs endpoint and returns volumes key', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ volumes: [], summary: baseSummary }));
    await getEbsInventory('tok', 'org_1', {});
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/ebs');
  });

  it('forwards account + region + state', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ volumes: [], summary: baseSummary }));
    await getEbsInventory('tok', 'org_1', { states: ['in-use'] });
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/ebs?state[]=in-use');
  });

  it('normalizes ebs volume fields', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        volumes: [
          {
            id: 'vol-1',
            type: 'gp2',
            region: 'us-west-1',
            state: 'in-use',
            size: 8,
            iops: 100,
            throughput: 0,
            encrypted: false,
            availability_zone: 'us-west-1a',
            outpost_arn: 'N/A',
            outdated: true,
            launch_time: '2022-07-01T22:50:01.113Z',
            price: 0.96,
            tags: {},
            account_id: '628833624007',
          },
        ],
        summary: { total: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getEbsInventory('tok', 'org_1', {});
    expect(result.volumes[0]).toMatchObject({
      id: 'vol-1',
      type: 'gp2',
      availabilityZone: 'us-west-1a',
      outpostArn: 'N/A',
      launchTime: '2022-07-01T22:50:01.113Z',
      accountId: '628833624007',
    });
  });
});

// ---------------------------------------------------------------------------
// getEksNodegroups
// ---------------------------------------------------------------------------
describe('getEksNodegroups', () => {
  const nestedSummary = { total: 0, clusters: 0, accounts: 0, regions: 0 };

  it('uses the eks/nodegroups endpoint with no filters', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ node_groups: [], summary: nestedSummary }));
    await getEksNodegroups('tok', 'org_1', {});
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/eks/nodegroups');
  });

  it('forwards account/region/state/capacity/cluster arrays + outdated scalar', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ node_groups: [], summary: nestedSummary }));
    await getEksNodegroups('tok', 'org_1', {
      accounts: ['111'],
      regions: ['us-east-1'],
      states: ['ACTIVE'],
      capacities: ['ON_DEMAND', 'SPOT'],
      clusters: ['eks-c1'],
      outdated: true,
    });
    expect(mockApiFetch.mock.calls[0][0]).toBe(
      '/api/organizations/org_1/inventory/eks/nodegroups' +
        '?account[]=111' +
        '&region[]=us-east-1' +
        '&state[]=ACTIVE' +
        '&capacity[]=ON_DEMAND&capacity[]=SPOT' +
        '&cluster[]=eks-c1' +
        '&outdated=true',
    );
  });

  it('normalizes the node-group fields including injected cluster_id/account_id', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        node_groups: [
          {
            id: 'ng-a-1',
            status: 'ACTIVE',
            version: '1.33',
            ami_type: 'AL2023_x86_64_STANDARD',
            instance_types: ['t3.medium'],
            capacity_type: 'ON_DEMAND',
            scaling_min: 2,
            scaling_desired: 3,
            scaling_max: 8,
            disk_size: 20,
            outdated: false,
            created_at: '2026-03-24T11:45:24.694+00:00',
            region: 'us-east-1',
            price: 100,
            labels: {},
            tags: {},
            arn: 'arn:aws:eks:...',
            cluster_id: 'eks-cluster-a',
            account_id: '123456789012',
          },
        ],
        summary: { total: 1, clusters: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getEksNodegroups('tok', 'org_1', {});
    expect(result.nodeGroups[0]).toEqual({
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
    });
    expect(result.summary).toEqual({ total: 1, clusters: 1, accounts: 1, regions: 1 });
  });
});

// ---------------------------------------------------------------------------
// getOpensearchNodes
// ---------------------------------------------------------------------------
describe('getOpensearchNodes', () => {
  const nestedSummary = { total: 0, clusters: 0, accounts: 0, regions: 0 };

  it('uses the opensearch/nodes endpoint with no filters', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ nodes: [], summary: nestedSummary }));
    await getOpensearchNodes('tok', 'org_1', {});
    expect(mockApiFetch.mock.calls[0][0]).toBe('/api/organizations/org_1/inventory/opensearch/nodes');
  });

  it('forwards account/region/state/role/cluster arrays', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ nodes: [], summary: nestedSummary }));
    await getOpensearchNodes('tok', 'org_1', {
      accounts: ['222'],
      regions: ['eu-west-1'],
      states: ['active'],
      roles: ['data', 'master'],
      clusters: ['opn-c1'],
    });
    expect(mockApiFetch.mock.calls[0][0]).toBe(
      '/api/organizations/org_1/inventory/opensearch/nodes' +
        '?account[]=222' +
        '&region[]=eu-west-1' +
        '&state[]=active' +
        '&role[]=data&role[]=master' +
        '&cluster[]=opn-c1',
    );
  });

  it('normalizes the node fields including injected cluster_id/account_id/region', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        nodes: [
          {
            id: 'node-a-1',
            role: 'data',
            type: 'r7g.xlarge.search',
            status: 'active',
            availability_zone: 'eu-west-1a',
            storage_size: '200',
            storage_type: 'EBS',
            storage_volume_type: 'gp3',
            price: 50.0,
            cluster_id: '688897985026/demo',
            account_id: '688897985026',
            region: 'eu-west-1',
          },
        ],
        summary: { total: 1, clusters: 1, accounts: 1, regions: 1 },
      }),
    );
    const result = await getOpensearchNodes('tok', 'org_1', {});
    expect(result.nodes[0]).toEqual({
      id: 'node-a-1',
      role: 'data',
      type: 'r7g.xlarge.search',
      status: 'active',
      availabilityZone: 'eu-west-1a',
      storageSize: '200',
      storageType: 'EBS',
      storageVolumeType: 'gp3',
      price: 50.0,
      clusterId: '688897985026/demo',
      accountId: '688897985026',
      region: 'eu-west-1',
    });
    expect(result.summary).toEqual({ total: 1, clusters: 1, accounts: 1, regions: 1 });
  });
});
