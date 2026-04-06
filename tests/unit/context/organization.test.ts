import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}));

vi.mock('../../../src/lib/api/organizations.js', () => ({
  listOrganizations: vi.fn(),
}));

import { select } from '@inquirer/prompts';
import { resolveOrganizationContext, resolveOrganizationFromContext } from '../../../src/context/organization.js';
import { listOrganizations } from '../../../src/lib/api/organizations.js';

const mockOrgs = [
  {
    id: 'org_1',
    name: 'Org One',
    onboarding: 'complete',
    managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  },
  {
    id: 'org_2',
    name: 'Org Two',
    onboarding: 'complete',
    managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: '', access: 'granted' },
  },
  {
    id: 'org_3',
    name: 'Org Three',
    onboarding: 'pending',
    managementAccount: { id: 'acc_3', accountId: '333333333333', nickname: '', access: 'granted' },
  },
];

describe('resolveOrganizationContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listOrganizations).mockResolvedValue(mockOrgs);
  });

  it('uses flag org (highest priority)', async () => {
    const result = await resolveOrganizationContext({
      flagOrganizationId: 'org_1',
      environmentOrganizationId: 'org_2',
      isInteractive: false,
      token: 'test-token',
    });

    expect(result.organizationId).toBe('org_1');
    expect(result.source).toBe('flag');
  });

  it('falls back to env when no flag', async () => {
    const result = await resolveOrganizationContext({
      environmentOrganizationId: 'org_2',
      isInteractive: false,
      token: 'test-token',
    });

    expect(result.organizationId).toBe('org_2');
    expect(result.source).toBe('env');
  });

  it('throws when flag org is not accessible', async () => {
    await expect(
      resolveOrganizationContext({
        flagOrganizationId: 'org_unknown',
        isInteractive: false,
        token: 'test-token',
      }),
    ).rejects.toThrow('not accessible');
  });

  it('throws when env org is not accessible', async () => {
    await expect(
      resolveOrganizationContext({
        environmentOrganizationId: 'org_unknown',
        isInteractive: false,
        token: 'test-token',
      }),
    ).rejects.toThrow('not accessible');
  });

  it('auto-selects single org when no flag or env specified', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([mockOrgs[0]]);

    const result = await resolveOrganizationContext({
      isInteractive: false,
      token: 'test-token',
    });

    expect(result.organizationId).toBe('org_1');
    expect(result.source).toBe('auto');
  });

  it('throws in non-interactive mode when no org resolved', async () => {
    await expect(
      resolveOrganizationContext({
        isInteractive: false,
        token: 'test-token',
      }),
    ).rejects.toThrow('No organization specified');
  });

  it('throws when user has no accessible orgs', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([]);

    await expect(
      resolveOrganizationContext({
        isInteractive: false,
        token: 'test-token',
      }),
    ).rejects.toThrow('No organizations found');
  });

  it('returns organization name in result', async () => {
    const result = await resolveOrganizationContext({
      flagOrganizationId: 'org_2',
      isInteractive: false,
      token: 'test-token',
    });

    expect(result.organizationName).toBe('Org Two');
  });

  it('prompts interactively when multiple organizations are accessible', async () => {
    vi.mocked(select).mockResolvedValue('org_2');

    const result = await resolveOrganizationContext({
      isInteractive: true,
      token: 'test-token',
    });

    expect(result).toEqual({
      organizationId: 'org_2',
      organizationName: 'Org Two',
      source: 'interactive',
    });
    expect(select).toHaveBeenCalledWith({
      message: 'Select an organization:',
      choices: [
        { name: 'Org One (111111111111)', value: 'org_1' },
        { name: 'Org Two (222222222222)', value: 'org_2' },
        { name: 'Org Three (333333333333)', value: 'org_3' },
      ],
    });
  });

  it('throws when interactive selection returns an unknown organization id', async () => {
    vi.mocked(select).mockResolvedValue('org_missing');

    await expect(
      resolveOrganizationContext({
        isInteractive: true,
        token: 'test-token',
      }),
    ).rejects.toThrow();
  });
});

describe('resolveOrganizationFromContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listOrganizations).mockResolvedValue(mockOrgs);
  });

  it('uses explicit flag organization', async () => {
    const result = await resolveOrganizationFromContext(
      {
        isInteractive: false,
        config: {},
      } as any,
      'tok',
      'org_1',
    );

    expect(result.source).toBe('flag');
    expect(result.organizationId).toBe('org_1');
  });

  it('auto-selects single org when no flag provided', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([mockOrgs[0]]);

    const result = await resolveOrganizationFromContext(
      {
        isInteractive: false,
        config: {},
      } as any,
      'tok',
    );

    expect(result.organizationId).toBe('org_1');
    expect(result.source).toBe('auto');
  });
});
