import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/api/organizations.js', () => ({
  listOrganizations: vi.fn(),
  getOrganization: vi.fn(),
}));

import { resolveOrganizationContext } from '../../src/context/organization.js';
import { listOrganizations } from '../../src/lib/api/organizations.js';
import {
  inaccessibleOrgScenario,
  noOrganizations,
  singleOrganization,
  threeOrganizations,
} from '../fixtures/multi-organization.js';

describe('multi-organization integration tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('user with 1 org', () => {
    it('auto-selects the single org', async () => {
      vi.mocked(listOrganizations).mockResolvedValue(singleOrganization as any);

      const result = await resolveOrganizationContext({
        isInteractive: false,
        token: 'tok',
      });

      expect(result.organizationId).toBe('org_single');
      expect(result.source).toBe('auto');
    });
  });

  describe('user with 3 orgs', () => {
    it('requires explicit selection in non-interactive mode', async () => {
      vi.mocked(listOrganizations).mockResolvedValue(threeOrganizations as any);

      await expect(
        resolveOrganizationContext({
          isInteractive: false,
          token: 'tok',
        }),
      ).rejects.toThrow('No organization specified');
    });

    it('accepts flag org', async () => {
      vi.mocked(listOrganizations).mockResolvedValue(threeOrganizations as any);

      const result = await resolveOrganizationContext({
        flagOrganizationId: 'org_staging',
        isInteractive: false,
        token: 'tok',
      });

      expect(result.organizationId).toBe('org_staging');
      expect(result.source).toBe('flag');
    });

    it('accepts env org', async () => {
      vi.mocked(listOrganizations).mockResolvedValue(threeOrganizations as any);

      const result = await resolveOrganizationContext({
        environmentOrganizationId: 'org_dev',
        isInteractive: false,
        token: 'tok',
      });

      expect(result.organizationId).toBe('org_dev');
      expect(result.source).toBe('env');
    });
  });

  describe('inaccessible org chosen by explicit input', () => {
    it('throws when flag org is not accessible', async () => {
      vi.mocked(listOrganizations).mockResolvedValue(inaccessibleOrgScenario.accessibleOrganizations as any);

      await expect(
        resolveOrganizationContext({
          flagOrganizationId: inaccessibleOrgScenario.flagOrganizationId,
          isInteractive: false,
          token: 'tok',
        }),
      ).rejects.toThrow('not accessible');
    });
  });

  describe('no orgs', () => {
    it('throws when user has no accessible orgs', async () => {
      vi.mocked(listOrganizations).mockResolvedValue(noOrganizations);

      await expect(
        resolveOrganizationContext({
          isInteractive: false,
          token: 'tok',
        }),
      ).rejects.toThrow('No organizations found');
    });
  });
});
