import type { OrganizationContext } from '../../context/organization.js';
import { UsageError } from '../../core/errors.js';
import * as api from '../../lib/api/index.js';
import * as aws from '../../lib/aws/index.js';

interface UpdateResult {
  updates: Array<{ name: string; status: string }>;
}

interface UpdateCheckResult {
  needsManagementUpdate: boolean;
  needsStackSetUpdate: boolean;
  updates: Array<{ name: string; from: string | null; to: string }>;
  organizationDetails: api.Organization;
  templates: api.CloudFormationTemplates;
}

export async function checkForUpdates(
  token: string,
  organizationContext: OrganizationContext,
  awsProfile?: string,
): Promise<UpdateCheckResult> {
  await api.checkConnectivity();
  await aws.validateCredentials(awsProfile);

  const [organizationDetails, templateData] = await Promise.all([
    api.getOrganization(token, organizationContext.organizationId),
    api.getCloudFormationTemplates(),
  ]);

  const managementStackInfo = organizationDetails.stacks?.managementStack;
  const stackSetInfo = organizationDetails.stacks?.stackset;

  if (!managementStackInfo) {
    throw new UsageError('No stacks deployed yet. Run `milkstraw setup` first.');
  }

  const needsManagementUpdate = managementStackInfo.version !== templateData.templates.management.version;
  const needsStackSetUpdate = !!(stackSetInfo && stackSetInfo.version !== templateData.templates.stackset.version);

  const updates: Array<{ name: string; from: string | null; to: string }> = [];
  if (needsManagementUpdate) {
    updates.push({
      name: managementStackInfo.name,
      from: managementStackInfo.version,
      to: templateData.templates.management.version,
    });
  }
  if (needsStackSetUpdate && stackSetInfo) {
    updates.push({ name: stackSetInfo.name, from: stackSetInfo.version, to: templateData.templates.stackset.version });
  }

  return { needsManagementUpdate, needsStackSetUpdate, updates, organizationDetails, templates: templateData };
}

export async function applyUpdates(
  token: string,
  organizationContext: OrganizationContext,
  check: UpdateCheckResult,
  awsProfile?: string,
): Promise<UpdateResult> {
  const results: Array<{ name: string; status: string }> = [];

  const { organizationDetails, templates } = check;
  const managementStackInfo = organizationDetails.stacks?.managementStack;
  const stackSetInfo = organizationDetails.stacks?.stackset;

  if (check.needsManagementUpdate && managementStackInfo) {
    const result = await aws.updateStack({
      stackName: managementStackInfo.name,
      templateUrl: templates.templates.management.url,
      parameters: aws.buildManagementStackParams({
        externalId: organizationDetails.externalId,
        roleName: organizationDetails.roleName,
        milkstrawPrincipal: templates.milkstrawAccountId,
      }),
      profile: awsProfile,
    });

    results.push({ name: managementStackInfo.name, status: result.status });
  }

  if (check.needsStackSetUpdate && stackSetInfo) {
    if (!organizationDetails.rootId) {
      throw new UsageError('Organization root ID is required for StackSet wrapper update.');
    }

    const result = await aws.updateStack({
      stackName: stackSetInfo.name,
      templateUrl: templates.templates.stackset.url,
      parameters: aws.buildStackSetWrapperParams({
        externalId: organizationDetails.externalId,
        roleName: organizationDetails.roleName,
        milkstrawPrincipal: templates.milkstrawAccountId,
        organizationId: organizationDetails.rootId,
      }),
      profile: awsProfile,
    });

    results.push({ name: stackSetInfo.name, status: result.status });
  }

  await api.reportStacksUpdated(token, organizationContext.organizationId);

  return { updates: results };
}
