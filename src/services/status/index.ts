import type { OrganizationContext } from '../../context/organization.js';
import type { AccessStatus, OnboardingStatus } from '../../lib/api/index.js';
import * as api from '../../lib/api/index.js';
import * as aws from '../../lib/aws/index.js';
import { summarizeSubAccounts } from '../../lib/organizations.js';

const HEALTHY_STATUSES = new Set(['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE', 'IMPORT_COMPLETE']);

function isStackHealthy(status: string): boolean {
  return HEALTHY_STATUSES.has(status);
}

export interface StatusData {
  organization: { id: string; name: string; onboarding: OnboardingStatus };
  managementAccount: { accountId: string; access: AccessStatus };
  managementStack: {
    name: string | null;
    status: string;
    healthy: boolean;
    deployedVersion: string | null;
    latestVersion: string;
  };
  stackSet: {
    name: string | null;
    status: string;
    healthy: boolean;
    deployedVersion: string | null;
    latestVersion: string;
  };
  subAccounts: {
    total: number;
    granted: number;
    byStatus: {
      granted: Array<{ accountId: string }>;
      denied: Array<{ accountId: string }>;
      suspended: Array<{ accountId: string }>;
      closed: Array<{ accountId: string }>;
    };
  };
}

export async function getStatus(
  token: string,
  organizationContext: OrganizationContext,
  awsProfile?: string,
): Promise<StatusData> {
  await api.checkConnectivity();

  const [organizationDetails, { templates }] = await Promise.all([
    api.getOrganization(token, organizationContext.organizationId),
    api.getCloudFormationTemplates(),
  ]);

  const managementStackInfo = organizationDetails.stacks?.managementStack;
  const stackSetInfo = organizationDetails.stacks?.stackset;

  const [stackStatus, stackSetStatus] = await Promise.all([
    managementStackInfo ? aws.getStackStatus(managementStackInfo.name, awsProfile) : null,
    stackSetInfo ? aws.getStackStatus(stackSetInfo.name, awsProfile) : null,
  ]);

  const subAccounts = summarizeSubAccounts(organizationDetails);

  const managementStack = buildStackStatus(managementStackInfo, stackStatus, templates.management.version);
  const stackSet = buildStackStatus(stackSetInfo, stackSetStatus, templates.stackset.version);

  return {
    organization: {
      id: organizationContext.organizationId,
      name: organizationDetails.name,
      onboarding: organizationDetails.onboarding,
    },
    managementAccount: {
      accountId: organizationDetails.managementAccount.accountId,
      access: organizationDetails.managementAccount.access,
    },
    managementStack,
    stackSet,
    subAccounts: {
      total: subAccounts.total,
      granted: subAccounts.granted,
      byStatus: {
        granted: subAccounts.byStatus.granted.map((account) => ({ accountId: account.accountId })),
        denied: subAccounts.byStatus.denied.map((account) => ({ accountId: account.accountId })),
        suspended: subAccounts.byStatus.suspended.map((account) => ({ accountId: account.accountId })),
        closed: subAccounts.byStatus.closed.map((account) => ({ accountId: account.accountId })),
      },
    },
  };
}

function buildStackStatus(
  stackInfo: { name: string; version: string } | null | undefined,
  awsStatus: { status: string; exists: boolean } | null,
  latestVersion: string,
): StatusData['managementStack'] {
  if (stackInfo && awsStatus?.exists) {
    return {
      name: stackInfo.name,
      status: awsStatus.status,
      healthy: isStackHealthy(awsStatus.status),
      deployedVersion: stackInfo.version,
      latestVersion,
    };
  }

  return {
    name: stackInfo?.name ?? null,
    status: 'not_deployed',
    healthy: false,
    deployedVersion: null,
    latestVersion,
  };
}
