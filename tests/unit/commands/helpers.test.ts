import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { buildContextMock, runCommandMock, runInteractiveCommandMock } = vi.hoisted(() => ({
  buildContextMock: vi.fn(),
  runCommandMock: vi.fn(),
  runInteractiveCommandMock: vi.fn(),
}));

vi.mock('../../../src/core/cli.js', () => ({
  buildContext: buildContextMock,
  runCommand: runCommandMock,
  runInteractiveCommand: runInteractiveCommandMock,
}));

import { wrapCommand, wrapInteractiveCommand } from '../../../src/commands/helpers.js';

describe('commands/helpers wrapCommand', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.resetAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('builds context from global flags and passes merged options to runCommand', async () => {
    const context = { auth: {}, config: {}, transport: {}, isInteractive: true, isTTY: true } as any;
    buildContextMock.mockReturnValue(context);
    runCommandMock.mockResolvedValue(0);

    const handler = vi.fn();
    const wrapped = wrapCommand(handler, ['organizationId']);

    const command = {
      optsWithGlobals: vi.fn(() => ({
        org: 'org_flag',
        awsProfile: 'aws-profile',
        json: true,
        quiet: false,
        markdown: false,
        verbose: true,
        agent: true,
      })),
    };

    await wrapped('org_123', {}, command);

    expect(buildContextMock).toHaveBeenCalledWith({
      org: 'org_flag',
      awsProfile: 'aws-profile',
      json: true,
      quiet: false,
      markdown: false,
      verbose: true,
      agent: true,
    });
    expect(runCommandMock).toHaveBeenCalledWith(handler, context, {
      org: 'org_flag',
      awsProfile: 'aws-profile',
      json: true,
      quiet: false,
      markdown: false,
      verbose: true,
      agent: true,
      organizationId: 'org_123',
    });
  });

  it('does not set process.exitCode when runCommand returns success', async () => {
    buildContextMock.mockReturnValue({} as any);
    runCommandMock.mockResolvedValue(0);

    await wrapCommand(vi.fn())({
      optsWithGlobals: vi.fn(() => ({})),
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('sets process.exitCode when runCommand returns a non-zero exit code', async () => {
    buildContextMock.mockReturnValue({} as any);
    runCommandMock.mockResolvedValue(7);

    await wrapCommand(vi.fn())({
      optsWithGlobals: vi.fn(() => ({})),
    });

    expect(process.exitCode).toBe(7);
  });
});

describe('commands/helpers wrapInteractiveCommand', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.resetAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('builds context from global flags and passes options to runInteractiveCommand', async () => {
    const context = { auth: {}, config: {}, transport: {}, isInteractive: true, isTTY: true } as any;
    buildContextMock.mockReturnValue(context);
    runInteractiveCommandMock.mockResolvedValue(0);

    const handler = vi.fn();
    const wrapped = wrapInteractiveCommand(handler);

    const command = {
      optsWithGlobals: vi.fn(() => ({
        org: 'org_flag',
        verbose: true,
      })),
    };

    await wrapped({}, command);

    expect(buildContextMock).toHaveBeenCalledWith({
      org: 'org_flag',
      verbose: true,
    });
    expect(runInteractiveCommandMock).toHaveBeenCalledWith(handler, context, {
      org: 'org_flag',
      verbose: true,
    });
  });

  it('does not set process.exitCode when runInteractiveCommand returns success', async () => {
    buildContextMock.mockReturnValue({} as any);
    runInteractiveCommandMock.mockResolvedValue(0);

    await wrapInteractiveCommand(vi.fn())({
      optsWithGlobals: vi.fn(() => ({})),
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('sets process.exitCode when runInteractiveCommand returns a non-zero exit code', async () => {
    buildContextMock.mockReturnValue({} as any);
    runInteractiveCommandMock.mockResolvedValue(11);

    await wrapInteractiveCommand(vi.fn())({
      optsWithGlobals: vi.fn(() => ({})),
    });

    expect(process.exitCode).toBe(11);
  });
});
