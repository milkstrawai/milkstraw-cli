import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../../../../src/core/errors.js';

// Mock client.ts to provide a controllable apiFetch
const mockApiFetch = vi.fn();
vi.mock('../../../../src/lib/api/client.js', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  initializeApiTransport: vi.fn(),
}));

const {
  listOrganizations,
  getOrganization,
  createOrganization,
  verifyManagementAccount,
  verifyAccounts,
  reportStacksUpdated,
} = await import('../../../../src/lib/api/organizations.js');

function mockResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {},
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

// ---------------------------------------------------------------------------
// listOrganizations
// ---------------------------------------------------------------------------
describe('listOrganizations', () => {
  it('returns organizations array', async () => {
    const rawOrganizations = [
      {
        id: '1',
        name: 'Org 1',
        onboarding: 'pending',
        management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
      },
      {
        id: '2',
        name: 'Org 2',
        onboarding: 'complete',
        management_account: { id: 'acc_2', account_id: '222222222222', nickname: '', access: 'granted' },
      },
    ];
    mockApiFetch.mockResolvedValueOnce(mockResponse({ organizations: rawOrganizations }));

    const result = await listOrganizations('token');
    expect(result).toEqual([
      {
        id: '1',
        name: 'Org 1',
        onboarding: 'pending',
        managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
      },
      {
        id: '2',
        name: 'Org 2',
        onboarding: 'complete',
        managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: '', access: 'granted' },
      },
    ]);
  });

  it('calls apiFetch with correct path and token', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ organizations: [] }));

    await listOrganizations('my-token');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/organizations', {}, 'my-token');
  });

  it('propagates errors from transport', async () => {
    mockApiFetch.mockRejectedValueOnce(new NetworkError());
    await expect(listOrganizations('token')).rejects.toThrow(NetworkError);
  });
});

// ---------------------------------------------------------------------------
// getOrganization
// ---------------------------------------------------------------------------
describe('getOrganization', () => {
  it('returns organization details', async () => {
    const rawOrganization = {
      id: '1',
      name: 'Test',
      onboarding: 'pending',
      external_id: 'ext-1',
      role_name: 'MilkStrawRoleV2',
      management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
      accounts: [],
      stacks: {
        management_stack: { name: 'MilkStrawAccessStackV2', version: '2.0' },
        stackset: { name: 'MilkStrawStackSetWrapper', version: '1.0' },
      },
    };
    mockApiFetch.mockResolvedValueOnce(mockResponse({ organization: rawOrganization }));

    const result = await getOrganization('token', '1');
    expect(result).toEqual({
      id: '1',
      name: 'Test',
      onboarding: 'pending',
      externalId: 'ext-1',
      roleName: 'MilkStrawRoleV2',
      managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
      accounts: [],
      stacks: {
        managementStack: { name: 'MilkStrawAccessStackV2', version: '2.0' },
        stackset: { name: 'MilkStrawStackSetWrapper', version: '1.0' },
      },
      rootId: undefined,
    });
  });

  it('calls the correct endpoint with org ID', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        organization: {
          id: 'org-42',
          name: 'Org 42',
          onboarding: 'pending',
          external_id: 'ext',
          role_name: 'Role',
          management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
          accounts: [],
          stacks: { management_stack: null, stackset: null },
        },
      }),
    );

    await getOrganization('token', 'org-42');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/organizations/org-42', {}, 'token');
  });
});

// ---------------------------------------------------------------------------
// createOrganization
// ---------------------------------------------------------------------------
describe('createOrganization', () => {
  it('returns created organization', async () => {
    const rawOrganization = {
      id: '1',
      name: 'New Org',
      onboarding: 'pending',
      external_id: 'ext_1',
      role_name: 'Role',
      management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
    };
    mockApiFetch.mockResolvedValueOnce(mockResponse({ organization: rawOrganization }));

    const result = await createOrganization('token', 'New Org', '123456789012');
    expect(result).toEqual({
      id: '1',
      name: 'New Org',
      onboarding: 'pending',
      externalId: 'ext_1',
      roleName: 'Role',
      managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
    });
  });

  it('sends correct request body with POST', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        organization: {
          id: '1',
          name: 'My Org',
          onboarding: 'pending',
          external_id: 'ext_1',
          role_name: 'Role',
          management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
        },
      }),
    );

    await createOrganization('token', 'My Org', '999888777666');

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/organizations',
      {
        method: 'POST',
        body: {
          organization: { name: 'My Org', main_account_id: '999888777666' },
        },
      },
      'token',
    );
  });

  it('passes token to apiFetch', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        organization: {
          id: '1',
          name: 'Org',
          onboarding: 'pending',
          external_id: 'ext_1',
          role_name: 'Role',
          management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
        },
      }),
    );

    await createOrganization('my-token', 'Org', '111222333444');

    expect(mockApiFetch.mock.calls[0][2]).toBe('my-token');
  });
});

// ---------------------------------------------------------------------------
// verifyManagementAccount
// ---------------------------------------------------------------------------
describe('verifyManagementAccount', () => {
  it('returns organization after verification', async () => {
    const rawOrganization = {
      id: '1',
      name: 'Test',
      onboarding: 'complete',
      external_id: 'ext_1',
      role_name: 'Role',
      management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
      accounts: [],
      stacks: { management_stack: null, stackset: null },
    };
    mockApiFetch.mockResolvedValueOnce(mockResponse({ organization: rawOrganization }));

    const result = await verifyManagementAccount('token', '1');
    expect(result.onboarding).toBe('complete');
  });

  it('POSTs to the correct endpoint with token', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        organization: {
          id: 'org-7',
          name: 'Org 7',
          onboarding: 'complete',
          external_id: 'ext_1',
          role_name: 'Role',
          management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
          accounts: [],
          stacks: { management_stack: null, stackset: null },
        },
      }),
    );

    await verifyManagementAccount('my-token', 'org-7');

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/organizations/org-7/management_account',
      { method: 'POST' },
      'my-token',
    );
  });
});

// ---------------------------------------------------------------------------
// verifyAccounts
// ---------------------------------------------------------------------------
describe('verifyAccounts', () => {
  it('returns organization after account verification', async () => {
    const rawOrganization = {
      id: '1',
      name: 'Test',
      onboarding: 'complete',
      external_id: 'ext_1',
      role_name: 'Role',
      management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
      accounts: [],
      stacks: { management_stack: null, stackset: null },
    };
    mockApiFetch.mockResolvedValueOnce(mockResponse({ organization: rawOrganization }));

    const result = await verifyAccounts('token', '1');
    expect(result.onboarding).toBe('complete');
  });

  it('POSTs to the correct endpoint with token', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        organization: {
          id: 'org-9',
          name: 'Org 9',
          onboarding: 'complete',
          external_id: 'ext_1',
          role_name: 'Role',
          management_account: { id: 'acc_1', account_id: '111111111111', nickname: '', access: 'granted' },
          accounts: [],
          stacks: { management_stack: null, stackset: null },
        },
      }),
    );

    await verifyAccounts('my-token', 'org-9');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/organizations/org-9/accounts', { method: 'POST' }, 'my-token');
  });
});

// ---------------------------------------------------------------------------
// reportStacksUpdated
// ---------------------------------------------------------------------------
describe('reportStacksUpdated', () => {
  it('sends PATCH to the correct endpoint with token', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(null, 200));

    await reportStacksUpdated('my-token', 'org_42');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/organizations/org_42/stacks', { method: 'PATCH' }, 'my-token');
  });

  it('propagates errors from transport', async () => {
    mockApiFetch.mockRejectedValueOnce(new NetworkError());
    await expect(reportStacksUpdated('token', 'org_1')).rejects.toThrow(NetworkError);
  });
});
