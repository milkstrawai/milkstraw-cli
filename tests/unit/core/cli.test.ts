const { createFileTokenStoreMock, initializeApiTransportMock, createTransportMock, resolveConfigMock } = vi.hoisted(
  () => ({
    createFileTokenStoreMock: vi.fn(() => ({})),
    initializeApiTransportMock: vi.fn(),
    createTransportMock: vi.fn((config) => ({ config })),
    resolveConfigMock: vi.fn(() => ({
      apiUrl: 'https://api.milkstraw.ai',
      renderFormat: 'json' as const,
      isQuiet: false,
      verbose: false,
      agentMode: false,
    })),
  }),
);

vi.mock('../../../src/auth/file-store.js', () => ({
  createFileTokenStore: createFileTokenStoreMock,
}));

vi.mock('../../../src/lib/api/client.js', () => ({
  initializeApiTransport: initializeApiTransportMock,
}));

vi.mock('../../../src/transport/client.js', () => ({
  createTransport: createTransportMock,
}));

vi.mock('../../../src/config/resolver.js', () => ({
  resolveConfig: resolveConfigMock,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContext, handleError, runCommand } from '../../../src/core/cli.js';
import { AuthRequiredError, NetworkError, UsageError } from '../../../src/core/errors.js';

describe('handleError', () => {
  it('writes errors directly to stderr and returns the exit code from CliError', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const error = new AuthRequiredError();

    const code = handleError(error);

    expect(code).toBe(4);
    expect(stderrWrite).toHaveBeenCalledWith(`Error: ${error.message}\n`);
    stderrWrite.mockRestore();
  });

  it('returns exit code 7 for NetworkError', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const error = new NetworkError();

    const code = handleError(error);

    expect(code).toBe(7);
    expect(stderrWrite).toHaveBeenCalledWith(`Error: ${error.message}\n`);
    stderrWrite.mockRestore();
  });

  it('returns exit code 2 for UsageError', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = handleError(new UsageError('bad arg'));

    expect(code).toBe(2);
    expect(stderrWrite).toHaveBeenCalledWith('Error: bad arg\n');
    stderrWrite.mockRestore();
  });

  it('returns exit code 1 for unknown errors', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = handleError(new Error('something'));

    expect(code).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith('Error: something\n');
    stderrWrite.mockRestore();
  });

  it('handles non-Error values', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = handleError('string error');

    expect(code).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith('Error: string error\n');
    stderrWrite.mockRestore();
  });
});

describe('runCommand', () => {
  it('prints the returned string directly to stdout and returns EXIT_SUCCESS', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitCode = await runCommand(
      async () => 'Done',
      {
        config: {} as any,
        auth: {} as any,
        transport: {} as any,
        isInteractive: false,
        isTTY: false,
      },
      {},
    );

    expect(exitCode).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith('Done\n');
    stdoutWrite.mockRestore();
  });

  it('returns exit code 130 without printing when a prompt is cancelled', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitCode = await runCommand(
      async () => {
        const error = new Error('User force closed the prompt with SIGINT');
        error.name = 'ExitPromptError';
        throw error;
      },
      {
        config: {} as any,
        auth: {} as any,
        transport: {} as any,
        isInteractive: true,
        isTTY: true,
      },
      {},
    );

    expect(exitCode).toBe(130);
    expect(stdoutWrite).not.toHaveBeenCalled();
    stdoutWrite.mockRestore();
  });

  it('prints markdown strings directly to stdout too', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitCode = await runCommand(
      async () => '## MARKDOWN OUTPUT',
      {
        config: { renderFormat: 'markdown' } as any,
        auth: {} as any,
        transport: {} as any,
        isInteractive: false,
        isTTY: false,
      },
      {},
    );

    expect(exitCode).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith('## MARKDOWN OUTPUT\n');
    stdoutWrite.mockRestore();
  });
});

describe('buildContext', () => {
  const originalIsTTY = process.stdout.isTTY;

  function setStdoutIsTTY(value: boolean): void {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value,
    });
  }

  beforeEach(() => {
    resolveConfigMock.mockImplementation(() => ({
      apiUrl: 'https://api.milkstraw.ai',
      renderFormat: 'json',
      isQuiet: false,
      verbose: false,
      agentMode: false,
    }));
    createFileTokenStoreMock.mockImplementation(() => ({}));
    createTransportMock.mockImplementation((config) => ({ config }));
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: originalIsTTY,
    });
    vi.clearAllMocks();
  });

  it('builds token store and transport and resolves auto render format in context', async () => {
    const tokenStore = { getToken: vi.fn(), setToken: vi.fn(), clearToken: vi.fn(), isAuthenticated: vi.fn() };
    const transport = { fetch: vi.fn() };

    resolveConfigMock.mockReturnValueOnce({
      apiUrl: 'https://staging-api.milkstraw.ai',
      renderFormat: 'auto',
      isQuiet: false,
      verbose: true,
      agentMode: false,
    });
    createFileTokenStoreMock.mockReturnValueOnce(tokenStore);
    createTransportMock.mockReturnValueOnce(transport);
    setStdoutIsTTY(true);

    const context = await buildContext({} as any);

    expect(resolveConfigMock).toHaveBeenCalledWith({});
    expect(createFileTokenStoreMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://staging-api.milkstraw.ai',
        verbose: true,
        timeout: 30000,
      }),
    );
    expect(initializeApiTransportMock).toHaveBeenCalledWith(transport);
    expect(context).toMatchObject({
      config: {
        apiUrl: 'https://staging-api.milkstraw.ai',
        renderFormat: 'text',
        isQuiet: false,
        verbose: true,
        agentMode: false,
      },
      auth: tokenStore,
      transport,
      isInteractive: true,
      isTTY: true,
    });
  });

  it('resolves auto render format to json in agent mode even when stdout is a TTY', async () => {
    resolveConfigMock.mockReturnValueOnce({
      apiUrl: 'https://staging-api.milkstraw.ai',
      renderFormat: 'auto',
      isQuiet: false,
      verbose: false,
      agentMode: true,
    });
    setStdoutIsTTY(true);

    const context = await buildContext({ agent: true } as any);

    expect(context).toMatchObject({
      config: {
        renderFormat: 'json',
        agentMode: true,
      },
      isInteractive: false,
      isTTY: true,
    });
  });
});
