import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/api/index.js', () => ({
  listOrganizations: vi.fn(),
}));

import * as api from '../../../src/lib/api/index.js';
import { listOrganizations } from '../../../src/services/organizations/index.js';

const mockOrganizations = [
  {
    id: 'org_1',
    name: 'Org One',
    onboarding: 'complete',
    managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  },
  {
    id: 'org_2',
    name: 'Org Two',
    onboarding: 'pending',
    managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: '', access: 'granted' },
  },
];

describe('services/organizations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.listOrganizations).mockResolvedValue(mockOrganizations as any);
  });

  describe('listOrganizations', () => {
    it('returns simplified organization list', async () => {
      const result = await listOrganizations('tok');
      expect(api.listOrganizations).toHaveBeenCalledWith('tok');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('org_1');
      expect(result[0].managementAccountId).toBe('111111111111');
    });
  });
});
