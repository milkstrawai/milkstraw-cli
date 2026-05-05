import type { Command } from 'commander';
import type { CliFlags } from '../config/resolver.js';
import { resolveOrganizationFromContext } from '../context/organization.js';
import { buildContext, runCommand, runInteractiveCommand } from '../core/cli.js';
import type { CliContext } from '../core/context.js';
import { AuthRequiredError } from '../core/errors.js';

export type CommandAction = (context: CliContext, options: Record<string, unknown>) => Promise<string>;
export type InteractiveAction = (context: CliContext, options: Record<string, unknown>) => Promise<void>;

export function wrapCommand(
  handler: CommandAction,
  positionalArgumentNames: string[] = [],
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    const command = args[args.length - 1] as Command;
    const positionalArguments = args.slice(0, Math.max(0, args.length - 2));
    const { flags, options } = parseFlags(command);

    positionalArgumentNames.forEach((argumentName, index) => {
      options[argumentName] = positionalArguments[index];
    });

    const context = buildContext(flags);
    const exitCode = await runCommand(handler, context, options);

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  };
}

export function wrapInteractiveCommand(handler: InteractiveAction): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    const command = args[args.length - 1] as Command;
    const { flags, options } = parseFlags(command);

    const context = buildContext(flags);
    const exitCode = await runInteractiveCommand(handler, context, options);

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  };
}

export async function requireToken(context: CliContext): Promise<string> {
  const token = await context.auth.getToken();
  if (token) return token;

  throw new AuthRequiredError();
}

export interface ResolvedCall {
  token: string;
  organizationId: string;
  organizationName: string;
}

export async function prepareCall(context: CliContext, options: Record<string, unknown>): Promise<ResolvedCall> {
  const token = await requireToken(context);
  const org = await resolveOrganizationFromContext(context, token, options.org as string | undefined);
  return { token, organizationId: org.organizationId, organizationName: org.organizationName };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function parseFlags(command: Command): { flags: CliFlags; options: Record<string, unknown> } {
  const commandOptions = command.optsWithGlobals();
  const options: Record<string, unknown> = { ...commandOptions };

  const flags: CliFlags = {
    org: optionalString(options.org),
    awsProfile: optionalString(options.awsProfile),
    json: optionalBoolean(options.json),
    quiet: optionalBoolean(options.quiet),
    markdown: optionalBoolean(options.markdown),
    verbose: optionalBoolean(options.verbose),
    agent: optionalBoolean(options.agent),
  };

  return { flags, options };
}
