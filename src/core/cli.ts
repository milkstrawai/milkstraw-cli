import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileTokenStore } from '../auth/file-store.js';
import { type CliFlags, resolveConfig } from '../config/resolver.js';
import { initializeApiTransport } from '../lib/api/client.js';
import { createTransport } from '../transport/client.js';
import type { CliContext, ResolvedRenderFormat } from './context.js';
import { EXIT_SUCCESS, exitCodeFromError } from './exit-codes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CommandHandler = (context: CliContext, args: Record<string, unknown>) => Promise<string>;
type InteractiveHandler = (context: CliContext, args: Record<string, unknown>) => Promise<void>;

export function buildContext(flags: CliFlags): CliContext {
  const resolvedConfig = resolveConfig(flags);
  const isTTY = process.stdout.isTTY ?? false;
  const isInteractive = isTTY && !resolvedConfig.agentMode;
  const config = resolveRenderFormat(resolvedConfig, isTTY);

  const auth = createFileTokenStore({ verbose: config.verbose });

  const version = readVersion();
  const transport = createTransport({
    baseUrl: config.apiUrl,
    userAgent: `milkstraw-cli/${version}`,
    timeout: 30_000,
    verbose: config.verbose,
  });

  initializeApiTransport(transport);

  return { config, auth, transport, isInteractive, isTTY };
}

export function handleError(error: unknown): number {
  writeError(error);
  return exitCodeFromError(error);
}

export async function runCommand(
  handler: CommandHandler,
  context: CliContext,
  args: Record<string, unknown>,
): Promise<number> {
  try {
    const result = await handler(context, args);
    process.stdout.write(`${result}\n`);
    return EXIT_SUCCESS;
  } catch (error) {
    if (isPromptCancelled(error)) {
      return 130;
    }

    return handleError(error);
  }
}

export async function runInteractiveCommand(
  handler: InteractiveHandler,
  context: CliContext,
  args: Record<string, unknown>,
): Promise<number> {
  try {
    await handler(context, args);
    return EXIT_SUCCESS;
  } catch (error) {
    if (isPromptCancelled(error)) {
      return 130;
    }

    return handleError(error);
  }
}

function isPromptCancelled(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ExitPromptError' ||
      error.message.includes('User force closed the prompt with SIGINT') ||
      error.message.includes('User force closed the prompt'))
  );
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function resolveRenderFormat(config: ReturnType<typeof resolveConfig>, isTTY: boolean): CliContext['config'] {
  return {
    ...config,
    renderFormat: normalizeRenderFormat(config.renderFormat, isTTY, config.agentMode),
  };
}

function normalizeRenderFormat(
  renderFormat: ReturnType<typeof resolveConfig>['renderFormat'],
  isTTY: boolean,
  agentMode: boolean,
): ResolvedRenderFormat {
  switch (renderFormat) {
    case 'auto':
      if (agentMode) return 'json';
      return isTTY ? 'text' : 'json';
    case 'json':
    case 'markdown':
      return renderFormat;
    default:
      return assertNever(renderFormat);
  }
}

function writeError(error: unknown): void {
  process.stderr.write(`Error: ${formatErrorMessage(error)}\n`);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
