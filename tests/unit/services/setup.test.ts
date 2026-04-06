import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies
vi.mock('../../../src/lib/api/index.js', () => ({
  requestDeviceCode: vi.fn(),
  pollForToken: vi.fn(),
  getOrganization: vi.fn(),
  getCloudFormationTemplates: vi.fn(),
  verifyManagementAccount: vi.fn(),
  verifyAccounts: vi.fn(),
  createOrganization: vi.fn(),
  listOrganizations: vi.fn(),
}));

vi.mock('../../../src/lib/aws/index.js', () => ({
  validateCredentials: vi.fn(),
  discoverManagementAccountId: vi.fn(),
  enableStackSetsTrustedAccess: vi.fn(),
  deployStack: vi.fn(),
  buildManagementStackParams: vi.fn().mockReturnValue([
    { ParameterKey: 'ExternalID', ParameterValue: 'ext_1' },
    { ParameterKey: 'RoleName', ParameterValue: 'MilkstrawRole' },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: '999999999999' },
  ]),
  buildStackSetWrapperParams: vi.fn().mockReturnValue([
    { ParameterKey: 'ExternalID', ParameterValue: 'ext_1' },
    { ParameterKey: 'RoleName', ParameterValue: 'MilkstrawRole' },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: '999999999999' },
    { ParameterKey: 'OrganizationID', ParameterValue: 'r-1234' },
  ]),
  AwsPermissionsError: class AwsPermissionsError extends Error {},
  StackSetsTrustedAccessError: class StackSetsTrustedAccessError extends Error {
    constructor() {
      super('StackSet deployment requires AWS Organizations trusted access for CloudFormation.');
      this.name = 'StackSetsTrustedAccessError';
    }
  },
}));

vi.mock('../../../src/services/setup/prompts.js', () => ({
  resolveOrganizationForSetup: vi.fn(),
  promptOrganizationDetails: vi.fn(),
}));

vi.mock('../../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn(),
}));

vi.mock('../../../src/services/auth/login.js', () => ({
  performLogin: vi.fn(),
}));

vi.mock('../../../src/config/files.js', () => ({
  getConfigDir: vi.fn(() => '/tmp/test-config'),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import type { CliContext } from '../../../src/core/context.js';
import * as api from '../../../src/lib/api/index.js';
import * as aws from '../../../src/lib/aws/index.js';
import { performLogin } from '../../../src/services/auth/login.js';
import { resolveOrganizationForSetup } from '../../../src/services/setup/prompts.js';
import { authenticateStep } from '../../../src/services/setup/steps/authenticate.js';
import { deployManagementStackStep } from '../../../src/services/setup/steps/deploy-management-stack.js';
import { deployStackSetStep } from '../../../src/services/setup/steps/deploy-stackset.js';
import { finalizeStep } from '../../../src/services/setup/steps/finalize.js';
import { prepareDeploymentStep } from '../../../src/services/setup/steps/prepare-deployment.js';
import { resolveOrganizationStep } from '../../../src/services/setup/steps/resolve-organization.js';
import { validateAwsStep } from '../../../src/services/setup/steps/validate-aws.js';
import { verifyManagementAccountStep } from '../../../src/services/setup/steps/verify-management-account.js';
import { verifySubaccountsStep } from '../../../src/services/setup/steps/verify-subaccounts.js';
import type { SetupInput, SetupState } from '../../../src/services/setup/types.js';

function mockSession(token: string | null = 'tok_123'): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    setToken: vi.fn().mockResolvedValue(undefined),
    clearToken: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockResolvedValue(!!token),
  };
}

function mockCtx(overrides: Partial<CliContext> = {}): CliContext {
  return {
    config: {
      apiUrl: 'https://app.milkstraw.ai',
      renderFormat: 'text',
      isQuiet: false,
      verbose: false,
      agentMode: false,
    },
    auth: mockSession(),
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
    ...overrides,
  };
}

const mockOrg = {
  id: 'org_1',
  name: 'Test Org',
  onboarding: 'pending',
  managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  externalId: 'ext_1',
  roleName: 'MilkstrawRole',
} as any;

const mockTemplates = {
  templates: {
    management: { name: 'ms-stack', version: '1.0', url: 'https://tpl/mgmt' },
    stackset: { name: 'ms-stackset', version: '1.0', url: 'https://tpl/ss' },
  },
  milkstrawAccountId: '999999999999',
} as any;

describe('setup steps', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('authenticateStep', () => {
    it('uses existing token', async () => {
      const state: SetupState = {};
      const input: SetupInput = { context: mockCtx() };
      await authenticateStep(input, state);
      expect(state.token).toBe('tok_123');
    });

    it('uses interactive login when no token is available', async () => {
      vi.mocked(performLogin).mockResolvedValue('tok_new');

      const context = mockCtx({ auth: mockSession(null) });
      const state: SetupState = {};

      await authenticateStep({ context }, state);

      expect(performLogin).toHaveBeenCalledWith(
        context.auth,
        expect.objectContaining({
          isInteractive: true,
          agentMode: false,
        }),
      );
      expect(state.token).toBe('tok_new');
    });

    it('throws in non-interactive when no token', async () => {
      const context = mockCtx({ auth: mockSession(null), isInteractive: false });
      const state: SetupState = {};
      await expect(authenticateStep({ context }, state)).rejects.toThrow();
    });
  });

  describe('resolveOrganizationStep', () => {
    it('resolves org in interactive mode', async () => {
      vi.mocked(resolveOrganizationForSetup).mockResolvedValue(mockOrg);
      const state: SetupState = { token: 'tok' };
      await resolveOrganizationStep({ context: mockCtx() }, state);
      expect(state.organization).toBe(mockOrg);
    });

    it('throws in non-interactive without organizationFlag', async () => {
      const context = mockCtx({ isInteractive: false });
      const state: SetupState = { token: 'tok' };
      vi.mocked(resolveOrganizationFromContext).mockRejectedValue(new Error('No organization specified.'));
      await expect(resolveOrganizationStep({ context }, state)).rejects.toThrow();
    });

    it('uses shared org resolution in non-interactive mode', async () => {
      vi.mocked(api.getOrganization).mockResolvedValue(mockOrg);
      vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
        organizationId: 'org_1',
        organizationName: 'Test Org',
        source: 'flag',
      });
      const context = mockCtx({ isInteractive: false });
      const state: SetupState = { token: 'tok' };
      await resolveOrganizationStep({ context, organizationFlag: 'org_1' }, state);
      expect(state.organization).toBe(mockOrg);
    });

    it('creates a new organization after discovering the management account ID', async () => {
      vi.mocked(resolveOrganizationForSetup).mockResolvedValue(null);
      vi.mocked(api.createOrganization).mockResolvedValue(mockOrg);
      const { promptOrganizationDetails } = await import('../../../src/services/setup/prompts.js');
      vi.mocked(promptOrganizationDetails).mockResolvedValue({ name: 'Test Org' });
      vi.mocked(aws.discoverManagementAccountId).mockResolvedValue('111111111111');

      const state: SetupState = { token: 'tok' };
      await resolveOrganizationStep({ context: mockCtx(), awsProfile: 'dev' }, state);

      expect(aws.discoverManagementAccountId).toHaveBeenCalledWith('dev');
      expect(api.createOrganization).toHaveBeenCalledWith('tok', 'Test Org', '111111111111');
      expect(state.organization).toBe(mockOrg);
    });

    it('fails when the management account ID cannot be discovered', async () => {
      vi.mocked(resolveOrganizationForSetup).mockResolvedValue(null);
      const { promptOrganizationDetails } = await import('../../../src/services/setup/prompts.js');
      vi.mocked(promptOrganizationDetails).mockResolvedValue({ name: 'Test Org' });
      vi.mocked(aws.discoverManagementAccountId).mockRejectedValue(
        new Error('Unable to determine the AWS management account ID.'),
      );

      const state: SetupState = { token: 'tok' };
      await expect(resolveOrganizationStep({ context: mockCtx() }, state)).rejects.toThrow(
        'Unable to determine the AWS management account ID.',
      );
      expect(api.createOrganization).not.toHaveBeenCalled();
    });
  });

  describe('validateAwsStep', () => {
    it('passes when account IDs match', async () => {
      vi.mocked(aws.validateCredentials).mockResolvedValue({ accountId: '111111111111', arn: 'arn:...' } as any);
      const state: SetupState = { organization: mockOrg };
      await validateAwsStep({ context: mockCtx() }, state);
      expect(state.awsIdentity?.accountId).toBe('111111111111');
    });

    it('throws on account ID mismatch', async () => {
      vi.mocked(aws.validateCredentials).mockResolvedValue({ accountId: '999999999999', arn: 'arn:...' } as any);
      const state: SetupState = { organization: mockOrg };
      await expect(validateAwsStep({ context: mockCtx() }, state)).rejects.toThrow('mismatch');
    });
  });

  describe('prepareDeploymentStep', () => {
    it('fetches templates and org details', async () => {
      vi.mocked(api.getCloudFormationTemplates).mockResolvedValue(mockTemplates);
      vi.mocked(api.getOrganization).mockResolvedValue(mockOrg);
      const state: SetupState = { token: 'tok', organization: mockOrg };
      await prepareDeploymentStep({ context: mockCtx() }, state);
      expect(state.templates).toBe(mockTemplates);
      expect(state.organizationDetails).toBe(mockOrg);
    });
  });

  describe('deployManagementStackStep', () => {
    it('deploys stack and stores result', async () => {
      vi.mocked(aws.deployStack).mockResolvedValue({ skipped: false, status: 'CREATE_COMPLETE' } as any);
      const state: SetupState = { templates: mockTemplates, organizationDetails: mockOrg };
      const onStepStart = vi.fn();
      const onStepSuccess = vi.fn();
      const onProgress = vi.fn();

      await deployManagementStackStep({ context: mockCtx(), onStepStart, onStepSuccess, onProgress }, state);

      expect(onStepStart).toHaveBeenCalledWith('Deploying management stack');
      expect(onProgress).toHaveBeenCalledWith('Deploying management stack...');
      expect(onStepSuccess).toHaveBeenCalledWith('Management stack ready');
      expect(state.managementStackResult?.status).toBe('CREATE_COMPLETE');
    });
  });

  describe('verifyManagementAccountStep', () => {
    it('verifies and stores result', async () => {
      vi.mocked(api.verifyManagementAccount).mockResolvedValue({ ...mockOrg, onboarding: 'complete' });
      const state: SetupState = { token: 'tok', organization: mockOrg };
      const onStepStart = vi.fn();
      const onStepSuccess = vi.fn();

      await verifyManagementAccountStep({ context: mockCtx(), onStepStart, onStepSuccess }, state);

      expect(onStepStart).toHaveBeenCalledWith('Verifying management account');
      expect(onStepSuccess).toHaveBeenCalledWith('Management account verified');
      expect(state.managementAccountVerification?.onboarding).toBe('complete');
    });
  });

  describe('deployStackSetStep', () => {
    it('skips for single-account orgs', async () => {
      const onStepSuccess = vi.fn();
      const onInfo = vi.fn();
      const state: SetupState = {
        templates: mockTemplates,
        managementAccountVerification: { ...mockOrg, onboarding: 'complete' },
      };
      await deployStackSetStep({ context: mockCtx(), onStepSuccess, onInfo }, state);
      expect(onStepSuccess).not.toHaveBeenCalled();
      expect(onInfo.mock.calls).toEqual([
        ['StackSet deployment not required'],
        ['Single-account organization detected.'],
      ]);
      expect(aws.deployStack).not.toHaveBeenCalled();
    });

    it('deploys stackset wrapper stack for multi-account orgs', async () => {
      vi.mocked(aws.deployStack).mockResolvedValue({
        skipped: false,
        status: 'CREATE_COMPLETE',
        stackId: 'stack-1',
      } as any);
      const onStepStart = vi.fn();
      const onStepSuccess = vi.fn();
      const onProgress = vi.fn();
      const state: SetupState = {
        templates: mockTemplates,
        managementAccountVerification: { ...mockOrg, rootId: 'r-1234' },
      };
      await deployStackSetStep({ context: mockCtx(), onStepStart, onStepSuccess, onProgress }, state);
      expect(onStepStart).toHaveBeenCalledWith('Deploying StackSet wrapper stack');
      expect(onProgress).toHaveBeenCalledWith('Deploying StackSet wrapper stack...');
      expect(onStepSuccess).toHaveBeenCalledWith('StackSet wrapper stack deployed');
      expect(state.stackSetResult).toEqual({ skipped: false, status: 'CREATE_COMPLETE' });
    });

    it('re-throws AwsPermissionsError', async () => {
      const permError = new aws.AwsPermissionsError('Insufficient permissions');
      vi.mocked(aws.deployStack).mockRejectedValue(permError);
      const state: SetupState = {
        templates: mockTemplates,
        managementAccountVerification: { ...mockOrg, rootId: 'r-1234' },
      };
      await expect(
        deployStackSetStep({ context: mockCtx(), onStepStart: vi.fn(), onProgress: vi.fn() }, state),
      ).rejects.toThrow(permError);
      expect(state.stackSetResult).toBeUndefined();
    });

    it('enables trusted access and retries when StackSetsTrustedAccessError is thrown', async () => {
      vi.mocked(aws.deployStack)
        .mockRejectedValueOnce(new aws.StackSetsTrustedAccessError())
        .mockResolvedValueOnce({ skipped: false, status: 'CREATE_COMPLETE', stackId: 'stack-1' } as any);
      vi.mocked(aws.enableStackSetsTrustedAccess).mockResolvedValue(undefined);

      const onInfo = vi.fn();
      const onStepSuccess = vi.fn();
      const state: SetupState = {
        templates: mockTemplates,
        managementAccountVerification: { ...mockOrg, rootId: 'r-1234' },
      };

      await deployStackSetStep(
        { context: mockCtx(), onStepStart: vi.fn(), onProgress: vi.fn(), onInfo, onStepSuccess },
        state,
      );

      expect(aws.enableStackSetsTrustedAccess).toHaveBeenCalledTimes(1);
      expect(aws.deployStack).toHaveBeenCalledTimes(2);
      expect(onInfo).toHaveBeenCalledWith('StackSets trusted access is not enabled. Enabling it...');
      expect(onInfo).toHaveBeenCalledWith('Trusted access enabled. Retrying StackSet deployment...');
      expect(onStepSuccess).toHaveBeenCalledWith('StackSet wrapper stack deployed');
      expect(state.stackSetResult).toEqual({ skipped: false, status: 'CREATE_COMPLETE' });
    });

    it('throws original StackSetsTrustedAccessError when enabling trusted access fails', async () => {
      const originalError = new aws.StackSetsTrustedAccessError();
      vi.mocked(aws.deployStack).mockRejectedValueOnce(originalError);
      vi.mocked(aws.enableStackSetsTrustedAccess).mockRejectedValue(new Error('AccessDeniedException'));

      const state: SetupState = {
        templates: mockTemplates,
        managementAccountVerification: { ...mockOrg, rootId: 'r-1234' },
      };

      await expect(
        deployStackSetStep({ context: mockCtx(), onStepStart: vi.fn(), onProgress: vi.fn(), onInfo: vi.fn() }, state),
      ).rejects.toBe(originalError);
      expect(aws.enableStackSetsTrustedAccess).toHaveBeenCalledTimes(1);
      expect(aws.deployStack).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifySubaccountsStep', () => {
    it('skips when already complete', async () => {
      const onStepStart = vi.fn();
      const state: SetupState = {
        token: 'tok',
        organization: mockOrg,
        managementAccountVerification: { ...mockOrg, onboarding: 'complete' },
      };
      await verifySubaccountsStep({ context: mockCtx(), onStepStart }, state);
      expect(onStepStart).not.toHaveBeenCalled();
      expect(state.subaccountVerification?.onboarding).toBe('complete');
    });

    it('polls until complete', async () => {
      vi.mocked(api.verifyAccounts)
        .mockResolvedValueOnce({ ...mockOrg, onboarding: 'pending' })
        .mockResolvedValueOnce({ ...mockOrg, onboarding: 'complete' });
      const onStepStart = vi.fn();
      const onStepSuccess = vi.fn();
      const onProgress = vi.fn();
      const state: SetupState = {
        token: 'tok',
        organization: mockOrg,
        managementAccountVerification: { ...mockOrg, onboarding: 'pending', rootId: 'r-1' },
      };
      await verifySubaccountsStep({ context: mockCtx(), onStepStart, onStepSuccess, onProgress }, state);
      expect(onStepStart).toHaveBeenCalledWith('Verifying subaccounts');
      expect(onProgress).toHaveBeenCalledWith('Verifying subaccounts... attempt 1/5');
      expect(onProgress).toHaveBeenCalledWith('Verifying subaccounts... attempt 2/5');
      expect(onStepSuccess).toHaveBeenCalledWith('Subaccounts verified');
      expect(state.subaccountVerification?.onboarding).toBe('complete');
    });
  });

  describe('finalizeStep', () => {
    it('returns setup result', () => {
      const state: SetupState = {
        organization: mockOrg,
        managementAccountVerification: { ...mockOrg, onboarding: 'complete' },
        stackSetResult: { skipped: false, status: 'CREATE_COMPLETE' },
      };
      const result = finalizeStep({ context: mockCtx() }, state);
      expect(result.organizationId).toBe('org_1');
      expect(result.organizationName).toBe('Test Org');
      expect(result.dashboardUrl).toContain('org_1');
    });

    it('returns no warnings when stackSetResult is clean', () => {
      const state: SetupState = {
        organization: mockOrg,
        managementAccountVerification: { ...mockOrg, onboarding: 'complete' },
        stackSetResult: { skipped: false, status: 'CREATE_COMPLETE' },
      };
      const result = finalizeStep({ context: mockCtx() }, state);
      expect(result.warnings).toBeUndefined();
    });

    it('returns no warnings when stackSetResult is absent', () => {
      const state: SetupState = {
        organization: mockOrg,
        managementAccountVerification: { ...mockOrg, onboarding: 'complete' },
      };
      const result = finalizeStep({ context: mockCtx() }, state);
      expect(result.warnings).toBeUndefined();
    });
  });
});
