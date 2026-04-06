import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock sleep to resolve immediately — avoids fake-timer/node:timers/promises compat issues
vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

const cfnMockSend = vi.fn();

const CreateStackCommand = vi.fn();
const DeleteStackCommand = vi.fn();
const DescribeStackEventsCommand = vi.fn();
const DescribeStacksCommand = vi.fn();
const UpdateStackCommand = vi.fn();

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn(() => ({ send: vi.fn() })),
  GetCallerIdentityCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-cloudformation', () => ({
  CloudFormationClient: vi.fn(() => ({ send: cfnMockSend })),
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
}));

const { CredentialsError, AwsPermissionsError, StackError, StackSetsTrustedAccessError } = await import(
  '../../../../src/lib/aws/client.js'
);
const { deployStack, getStackStatus, updateStack, deleteStack } = await import('../../../../src/lib/aws/stack.js');

beforeEach(() => {
  cfnMockSend.mockReset();
  CreateStackCommand.mockReset();
  DeleteStackCommand.mockReset();
  DescribeStackEventsCommand.mockReset();
  DescribeStacksCommand.mockReset();
  UpdateStackCommand.mockReset();
});

const defaultParams = {
  stackName: 'MilkStrawAccessStackV2',
  templateUrl: 'https://s3.example.com/template.json',
  parameters: [
    { ParameterKey: 'ExternalID', ParameterValue: 'ext-123' },
    { ParameterKey: 'RoleName', ParameterValue: 'MilkStrawRoleV2' },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: '801486250081' },
  ],
};

// ---------------------------------------------------------------------------
// getStackStatus
// ---------------------------------------------------------------------------
describe('getStackStatus', () => {
  it('returns status when stack exists', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'CREATE_COMPLETE' }],
    });
    const result = await getStackStatus('test-stack');
    expect(result).toEqual({ status: 'CREATE_COMPLETE', exists: true });
  });

  it('returns NOT_FOUND when API throws "does not exist"', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('Stack with id test-stack does not exist'));
    const result = await getStackStatus('test-stack');
    expect(result).toEqual({ status: 'NOT_FOUND', exists: false });
  });

  it('returns NOT_FOUND when Stacks array is empty', async () => {
    cfnMockSend.mockResolvedValueOnce({ Stacks: [] });
    const result = await getStackStatus('test-stack');
    expect(result).toEqual({ status: 'NOT_FOUND', exists: false });
  });

  it('throws StackError on unexpected errors', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('Network timeout'));
    await expect(getStackStatus('test-stack')).rejects.toThrow(StackError);
    await expect(getStackStatus('test-stack')).rejects.not.toThrow('does not exist');
  });

  it('throws CredentialsError when security token is invalid (plain Error)', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('The security token included in the request is invalid.'));
    const error = await getStackStatus('test-stack').catch((e) => e);
    expect(error).toBeInstanceOf(CredentialsError);
    expect(error.message).toMatch(/AWS credentials are invalid or expired/);
  });

  it('throws CredentialsError when security token is invalid (AWS SDK v3 shape)', async () => {
    const awsError = Object.assign(new Error('The security token included in the request is invalid.'), {
      name: 'UnrecognizedClientException',
      $fault: 'client',
      $metadata: { httpStatusCode: 403 },
    });
    cfnMockSend.mockRejectedValueOnce(awsError);
    const error = await getStackStatus('test-stack').catch((e) => e);
    expect(error).toBeInstanceOf(CredentialsError);
    expect(error.message).toMatch(/AWS credentials are invalid or expired/);
  });

  it('throws CredentialsError for InvalidClientTokenId from CloudFormation', async () => {
    const awsError = Object.assign(new Error('token invalid'), {
      name: 'InvalidClientTokenId',
    });
    cfnMockSend.mockRejectedValueOnce(awsError);
    const error = await getStackStatus('test-stack').catch((e) => e);
    expect(error).toBeInstanceOf(CredentialsError);
  });
});

// ---------------------------------------------------------------------------
// deployStack
// ---------------------------------------------------------------------------
describe('deployStack', () => {
  it('skips when stack is CREATE_COMPLETE', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'CREATE_COMPLETE' }],
    });
    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(true);
    expect(result.status).toBe('CREATE_COMPLETE');
    // Should not attempt to create
    expect(CreateStackCommand).not.toHaveBeenCalled();
  });

  it('skips when stack is UPDATE_ROLLBACK_COMPLETE', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'UPDATE_ROLLBACK_COMPLETE' }],
    });
    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(true);
    expect(result.status).toBe('UPDATE_ROLLBACK_COMPLETE');
    expect(CreateStackCommand).not.toHaveBeenCalled();
  });

  it('skips when stack is UPDATE_COMPLETE', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }],
    });
    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(true);
    expect(result.status).toBe('UPDATE_COMPLETE');
    expect(CreateStackCommand).not.toHaveBeenCalled();
  });

  it('creates stack with correct parameters when stack does not exist', async () => {
    // getStackStatus -> not found
    cfnMockSend.mockRejectedValueOnce(new Error('Stack with id MilkStrawAccessStackV2 does not exist'));
    // CreateStackCommand -> success
    cfnMockSend.mockResolvedValueOnce({ StackId: 'arn:aws:cfn:stack-123' });
    // waitForStack poll -> complete
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'arn:aws:cfn:stack-123', StackStatus: 'CREATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result).toEqual({
      stackId: 'arn:aws:cfn:stack-123',
      status: 'CREATE_COMPLETE',
      skipped: false,
    });

    expect(CreateStackCommand).toHaveBeenCalledWith({
      StackName: 'MilkStrawAccessStackV2',
      TemplateURL: 'https://s3.example.com/template.json',
      Parameters: defaultParams.parameters,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    });
  });

  it('waits when stack is CREATE_IN_PROGRESS', async () => {
    // getStackStatus -> in progress
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'CREATE_IN_PROGRESS' }],
    });
    // waitForStack poll 1 -> still in progress
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-123', StackStatus: 'CREATE_IN_PROGRESS' }],
    });
    // waitForStack poll 2 -> complete
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-123', StackStatus: 'CREATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(false);
    expect(result.status).toBe('CREATE_COMPLETE');
    // Should not create a new stack
    expect(CreateStackCommand).not.toHaveBeenCalled();
  });

  it('deletes and recreates when stack is ROLLBACK_COMPLETE', async () => {
    // getStackStatus -> rollback complete
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'ROLLBACK_COMPLETE' }],
    });
    // deleteStack: DeleteStackCommand -> ok
    cfnMockSend.mockResolvedValueOnce({});
    // deleteStack poll: getStackStatus -> gone
    cfnMockSend.mockRejectedValueOnce(new Error('Stack with id MilkStrawAccessStackV2 does not exist'));
    // CreateStackCommand -> success
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-new' });
    // waitForStack -> complete
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-new', StackStatus: 'CREATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(false);
    expect(result.status).toBe('CREATE_COMPLETE');
    expect(DeleteStackCommand).toHaveBeenCalled();
    expect(CreateStackCommand).toHaveBeenCalled();
  });

  it('deletes and recreates when stack is CREATE_FAILED', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'CREATE_FAILED' }],
    });
    cfnMockSend.mockResolvedValueOnce({});
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-retry' });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-retry', StackStatus: 'CREATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(false);
    expect(DeleteStackCommand).toHaveBeenCalled();
  });

  it('waits for deletion then creates when stack is DELETE_IN_PROGRESS', async () => {
    // getStackStatus -> DELETE_IN_PROGRESS
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'DELETE_IN_PROGRESS' }],
    });
    // waitForDeletion poll: gone
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    // CreateStackCommand -> success
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-new' });
    // waitForStack -> complete
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-new', StackStatus: 'CREATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(false);
    expect(result.status).toBe('CREATE_COMPLETE');
    // Should NOT send a duplicate DeleteStackCommand — just waits for the existing deletion
    expect(DeleteStackCommand).not.toHaveBeenCalled();
    expect(CreateStackCommand).toHaveBeenCalled();
  });

  it('throws AwsPermissionsError on AccessDeniedException', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    const error = new Error('Access Denied');
    (error as any).name = 'AccessDeniedException';
    cfnMockSend.mockRejectedValueOnce(error);
    await expect(deployStack(defaultParams)).rejects.toThrow(AwsPermissionsError);
  });

  it('throws AwsPermissionsError on AccessDenied name', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    const error = new Error('Forbidden');
    (error as any).name = 'AccessDenied';
    cfnMockSend.mockRejectedValueOnce(error);
    await expect(deployStack(defaultParams)).rejects.toThrow(AwsPermissionsError);
  });

  it('throws StackError on generic create failure', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockRejectedValueOnce(new Error('InternalServiceError'));
    await expect(deployStack(defaultParams)).rejects.toThrow(StackError);
  });

  it('throws StackError when waitForStack sees a FAILED status', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-fail' });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-fail', StackStatus: 'CREATE_FAILED', StackStatusReason: 'IAM role limit' }],
    });

    const error = await deployStack(defaultParams).catch((e) => e);
    expect(error).toBeInstanceOf(StackError);
    expect(error.message).toMatch(/IAM role limit/);
  });

  it('throws StackError when stack disappears during wait', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-gone' });
    cfnMockSend.mockResolvedValueOnce({ Stacks: [] });

    await expect(deployStack(defaultParams)).rejects.toThrow(StackError);
  });

  it('fetches failure reason from stack events when StackStatusReason is missing', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-rollback' });
    // waitForStack sees ROLLBACK_COMPLETE with no StackStatusReason
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-rollback', StackStatus: 'ROLLBACK_COMPLETE' }],
    });
    // DescribeStackEvents returns failed events (newest-first)
    cfnMockSend.mockResolvedValueOnce({
      StackEvents: [
        {
          ResourceType: 'AWS::CloudFormation::Stack',
          ResourceStatus: 'ROLLBACK_COMPLETE',
          ResourceStatusReason: 'The following resource(s) failed to create',
        },
        {
          ResourceType: 'AWS::CloudFormation::StackSet',
          ResourceStatus: 'CREATE_FAILED',
          ResourceStatusReason: 'StackSets service is not enabled for this account',
        },
      ],
    });

    const error = await deployStack(defaultParams).catch((e) => e);
    expect(error).toBeInstanceOf(StackError);
    expect(error.message).toMatch(/StackSets service is not enabled/);
  });

  it('falls back to "Unknown reason" when events cannot be fetched', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-rollback' });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-rollback', StackStatus: 'ROLLBACK_COMPLETE' }],
    });
    cfnMockSend.mockRejectedValueOnce(new Error('API failed'));

    const error = await deployStack(defaultParams).catch((e) => e);
    expect(error).toBeInstanceOf(StackError);
    expect(error.message).toMatch(/Unknown reason/);
  });

  it('throws StackSetsTrustedAccessError when "organizations access" reason is detected', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-rollback' });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-rollback', StackStatus: 'ROLLBACK_COMPLETE' }],
    });
    cfnMockSend.mockResolvedValueOnce({
      StackEvents: [
        {
          ResourceType: 'AWS::CloudFormation::StackSet',
          ResourceStatus: 'CREATE_FAILED',
          ResourceStatusReason:
            'Resource handler returned message: "You must enable organizations access to operate a service managed stack set (Service: CloudFormation...)"',
        },
      ],
    });

    const error = await deployStack(defaultParams).catch((e) => e);
    expect(error).toBeInstanceOf(StackSetsTrustedAccessError);
    expect(error.message).toMatch(/StackSet deployment requires AWS Organizations trusted access/);
    expect(error.message).toMatch(/cloudformation activate-organizations-access/);
    expect(error.message).toMatch(/AWS CloudFormation console on the StackSets page/);
  });

  it('creates stack when status is DELETE_COMPLETE', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'DELETE_COMPLETE' }],
    });
    cfnMockSend.mockResolvedValueOnce({ StackId: 'stack-new' });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-new', StackStatus: 'CREATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(false);
    expect(result.status).toBe('CREATE_COMPLETE');
    expect(CreateStackCommand).toHaveBeenCalled();
  });

  it('skips when stack is IMPORT_COMPLETE', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'IMPORT_COMPLETE' }],
    });
    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(true);
    expect(result.status).toBe('IMPORT_COMPLETE');
    expect(CreateStackCommand).not.toHaveBeenCalled();
  });

  it('waits when stack is UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', async () => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS' }],
    });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-1', StackStatus: 'UPDATE_COMPLETE' }],
    });

    const result = await deployStack(defaultParams);
    expect(result.skipped).toBe(false);
    expect(result.status).toBe('UPDATE_COMPLETE');
    expect(CreateStackCommand).not.toHaveBeenCalled();
  });

  it.each([
    'ROLLBACK_FAILED',
    'UPDATE_FAILED',
    'DELETE_FAILED',
  ])('throws StackError with manual intervention message for %s', async (status) => {
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: status }],
    });

    const error = await deployStack(defaultParams).catch((e) => e);
    expect(error).toBeInstanceOf(StackError);
    expect(error.message).toMatch(/requires manual intervention/);
  });
});

// ---------------------------------------------------------------------------
// deployStack with wrapper params (4 parameters)
// ---------------------------------------------------------------------------
describe('deployStack with wrapper params (4 parameters)', () => {
  it('passes all 4 parameters to CreateStackCommand', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));
    cfnMockSend.mockResolvedValueOnce({ StackId: 'arn:stack-1' });
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'arn:stack-1', StackStatus: 'CREATE_COMPLETE' }],
    });

    const wrapperParams = {
      stackName: 'wrapper-stack',
      templateUrl: 'https://s3.example.com/wrapper.json',
      parameters: [
        { ParameterKey: 'ExternalID', ParameterValue: 'ext-1' },
        { ParameterKey: 'RoleName', ParameterValue: 'Role' },
        { ParameterKey: 'MilkStrawPrincipal', ParameterValue: '123' },
        { ParameterKey: 'OrganizationID', ParameterValue: 'r-abc1' },
      ],
    };

    const result = await deployStack(wrapperParams);
    expect(result.status).toBe('CREATE_COMPLETE');
    expect(CreateStackCommand).toHaveBeenCalledWith({
      StackName: 'wrapper-stack',
      TemplateURL: 'https://s3.example.com/wrapper.json',
      Parameters: wrapperParams.parameters,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    });
  });
});

// ---------------------------------------------------------------------------
// updateStack
// ---------------------------------------------------------------------------
describe('updateStack', () => {
  it('updates stack with correct parameters and waits for completion', async () => {
    // UpdateStackCommand -> success
    cfnMockSend.mockResolvedValueOnce({});
    // waitForStack -> complete
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackId: 'stack-123', StackStatus: 'UPDATE_COMPLETE' }],
    });

    const result = await updateStack(defaultParams);
    expect(result.status).toBe('UPDATE_COMPLETE');

    expect(UpdateStackCommand).toHaveBeenCalledWith({
      StackName: 'MilkStrawAccessStackV2',
      TemplateURL: 'https://s3.example.com/template.json',
      Parameters: defaultParams.parameters,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    });
  });

  it('returns UP_TO_DATE when no updates needed', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('No updates are to be performed'));
    const result = await updateStack(defaultParams);
    expect(result.status).toBe('UP_TO_DATE');
  });

  it('throws StackError on unexpected update failure', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('ValidationError: template invalid'));
    await expect(updateStack(defaultParams)).rejects.toThrow(StackError);
  });

  it('throws StackError when update completes with FAILED status', async () => {
    cfnMockSend.mockResolvedValueOnce({});
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'UPDATE_FAILED', StackStatusReason: 'Resource handler failed' }],
    });

    await expect(updateStack(defaultParams)).rejects.toThrow(StackError);
  });
});

// ---------------------------------------------------------------------------
// deleteStack
// ---------------------------------------------------------------------------
describe('deleteStack', () => {
  it('deletes stack and waits until gone', async () => {
    // DeleteStackCommand -> ok
    cfnMockSend.mockResolvedValueOnce({});
    // poll 1: still deleting
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'DELETE_IN_PROGRESS' }],
    });
    // poll 2: gone
    cfnMockSend.mockRejectedValueOnce(new Error('does not exist'));

    await expect(deleteStack('my-stack')).resolves.toBeUndefined();
    expect(DeleteStackCommand).toHaveBeenCalledWith({ StackName: 'my-stack' });
  });

  it('throws StackError when deletion fails', async () => {
    cfnMockSend.mockResolvedValueOnce({});
    cfnMockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'DELETE_FAILED' }],
    });

    const error = await deleteStack('my-stack').catch((e) => e);
    expect(error).toBeInstanceOf(StackError);
    expect(error.message).toMatch(/Failed to delete stack/);
  });

  it('wraps unexpected errors as StackError', async () => {
    cfnMockSend.mockRejectedValueOnce(new Error('Connection refused'));
    await expect(deleteStack('my-stack')).rejects.toThrow(StackError);
  });
});
