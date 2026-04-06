import { setTimeout as sleep } from 'node:timers/promises';
import {
  type CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
  type Parameter,
  UpdateStackCommand,
} from '@aws-sdk/client-cloudformation';
import { hasMessage, hasName } from '../type-guards.js';
import {
  AwsPermissionsError,
  createCfnClient,
  extractMessage,
  StackError,
  StackSetsTrustedAccessError,
  throwIfInvalidToken,
} from './client.js';

const STACK_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const STACK_POLL_INTERVAL = 5000;

const USABLE_STATUSES = new Set(['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE', 'IMPORT_COMPLETE']);

const STUCK_STATUSES = new Set(['ROLLBACK_FAILED', 'UPDATE_FAILED', 'DELETE_FAILED']);

export interface StackOperationParams {
  stackName: string;
  templateUrl: string;
  parameters: Parameter[];
  profile?: string;
}

interface DeployManagementStackResult {
  stackId: string;
  status: string;
  skipped: boolean;
}

export async function getStackStatus(
  stackName: string,
  profile?: string,
): Promise<{ status: string; exists: boolean }> {
  const cfn = createCfnClient(profile);

  try {
    const result = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
    const stack = result.Stacks?.[0];

    if (!stack) return { status: 'NOT_FOUND', exists: false };

    return { status: stack.StackStatus ?? 'UNKNOWN', exists: true };
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes('does not exist')) {
      return { status: 'NOT_FOUND', exists: false };
    }

    throwIfInvalidToken(error, profile);
    throw new StackError(extractMessage(error));
  }
}

export async function deployStack(params: StackOperationParams): Promise<DeployManagementStackResult> {
  const cfn = createCfnClient(params.profile);
  const stackName = params.stackName;

  // Check existing stack state
  const current = await getStackStatus(stackName, params.profile);

  if (current.exists) {
    const status = current.status;

    if (USABLE_STATUSES.has(status)) {
      return { stackId: stackName, status, skipped: true };
    }

    if (STUCK_STATUSES.has(status)) {
      throw new StackError(
        `Stack ${stackName} is in state ${status} and requires manual intervention.\n\n` +
          `  Check the stack in the AWS CloudFormation console and resolve the issue,\n` +
          `  then re-run: milkstraw setup`,
      );
    }

    if (status === 'DELETE_IN_PROGRESS') {
      await waitForDeletion(cfn, stackName);
      // Fall through to create
    } else if (status.endsWith('_IN_PROGRESS')) {
      return await waitForStack(cfn, stackName);
    } else if (status === 'ROLLBACK_COMPLETE' || status === 'CREATE_FAILED') {
      await deleteStack(stackName, params.profile);
      // Fall through to create
    }
    // DELETE_COMPLETE: no action needed, fall through to create
  }

  // Create stack
  let stackId: string | undefined;
  try {
    const result = await cfn.send(
      new CreateStackCommand({
        StackName: stackName,
        TemplateURL: params.templateUrl,
        Parameters: params.parameters,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
      }),
    );
    stackId = result.StackId;
  } catch (error: unknown) {
    if (hasName(error) && (error.name === 'AccessDeniedException' || error.name === 'AccessDenied')) {
      throw new AwsPermissionsError(
        `Insufficient IAM permissions to create CloudFormation stack.\n\n` +
          `  Required permissions:\n` +
          `    - cloudformation:CreateStack\n` +
          `    - cloudformation:DescribeStacks\n` +
          `    - iam:CreateRole\n` +
          `    - iam:PutRolePolicy\n` +
          `    - iam:AttachRolePolicy`,
      );
    }

    throwIfInvalidToken(error, params.profile);
    throw new StackError(extractMessage(error));
  }

  return waitForStack(cfn, stackName, stackId);
}

export async function updateStack(params: StackOperationParams): Promise<{ status: string }> {
  const cfn = createCfnClient(params.profile);

  try {
    await cfn.send(
      new UpdateStackCommand({
        StackName: params.stackName,
        TemplateURL: params.templateUrl,
        Parameters: params.parameters,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
      }),
    );
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes('No updates are to be performed')) {
      return { status: 'UP_TO_DATE' };
    }

    throwIfInvalidToken(error, params.profile);
    throw new StackError(extractMessage(error));
  }

  const result = await waitForStack(cfn, params.stackName);
  return { status: result.status };
}

export async function deleteStack(stackName: string, profile?: string): Promise<void> {
  const cfn = createCfnClient(profile);

  try {
    await cfn.send(new DeleteStackCommand({ StackName: stackName }));
  } catch (error: unknown) {
    throw new StackError(extractMessage(error));
  }

  await waitForDeletion(cfn, stackName);
}

async function waitForDeletion(cfn: CloudFormationClient, stackName: string): Promise<void> {
  const startTime = Date.now();
  while (true) {
    if (Date.now() - startTime > STACK_TIMEOUT) {
      throw new StackError(`Stack ${stackName} deletion timed out after 30 minutes.`);
    }

    await sleep(STACK_POLL_INTERVAL);

    try {
      const result = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
      const stack = result.Stacks?.[0];

      if (!stack) return;

      const status = stack.StackStatus ?? 'UNKNOWN';

      if (status === 'DELETE_FAILED') {
        throw new StackError(`Failed to delete stack ${stackName}.`);
      }
    } catch (error: unknown) {
      if (error instanceof StackError) throw error;
      if (hasMessage(error) && error.message.includes('does not exist')) return;
      throw new StackError(extractMessage(error));
    }
  }
}

async function waitForStack(
  cfn: CloudFormationClient,
  stackName: string,
  stackId?: string,
): Promise<DeployManagementStackResult> {
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > STACK_TIMEOUT) {
      throw new StackError(`Stack ${stackName} operation timed out after 30 minutes.`);
    }

    await sleep(STACK_POLL_INTERVAL);

    const result = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
    const stack = result.Stacks?.[0];

    if (!stack) throw new StackError(`Stack ${stackName} not found during wait.`);

    const status = stack.StackStatus ?? 'UNKNOWN';

    if (status === 'CREATE_COMPLETE' || status === 'UPDATE_COMPLETE') {
      return { stackId: stackId || stack.StackId || stackName, status, skipped: false };
    }

    if (status.includes('FAILED') || status.includes('ROLLBACK_COMPLETE')) {
      const reason = stack.StackStatusReason || (await getFailureReasonFromEvents(cfn, stackName));

      if (reason.includes('You must enable organizations access to operate a service managed stack set')) {
        throw new StackSetsTrustedAccessError();
      }

      throw new StackError(`Stack ${stackName} failed: ${status} - ${reason}`);
    }
    // Still in progress, continue polling
  }
}

async function getFailureReasonFromEvents(cfn: CloudFormationClient, stackName: string): Promise<string> {
  try {
    const result = await cfn.send(new DescribeStackEventsCommand({ StackName: stackName }));
    const events = result.StackEvents ?? [];

    // Events are returned newest-first. Find the earliest failed resource (non-stack) event.
    const failedEvent = events
      .filter(
        (event) => event.ResourceStatus?.endsWith('_FAILED') && event.ResourceType !== 'AWS::CloudFormation::Stack',
      )
      .pop();

    return failedEvent?.ResourceStatusReason || 'Unknown reason';
  } catch {
    return 'Unknown reason';
  }
}
