import { PermissionError } from '../core/errors.js';
import { hasStatusCode } from '../lib/type-guards.js';

export const PERMISSION_ACTIONS = {
  VIEW_STATUS: 'view status',
  UPDATE_STACKS: 'update stacks',
  RUN_SETUP: 'run setup',
} as const;

export function rethrowOrganizationPermissionError(
  error: unknown,
  action: string,
  organizationId: string,
  organizationName?: string,
): never {
  if (isPermissionDenied(error)) {
    throw createPermissionError(action, organizationId, organizationName);
  }

  throw error;
}

export async function withPermissionCheck<T>(
  fn: () => Promise<T>,
  action: string,
  organizationId: string,
  organizationName?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    rethrowOrganizationPermissionError(error, action, organizationId, organizationName);
  }
}

function createPermissionError(action: string, organizationId: string, organizationName?: string): PermissionError {
  const organizationDisplay = organizationName ? `"${organizationName}"` : organizationId;

  return new PermissionError(
    `You can access organization ${organizationDisplay}, but you do not have permission to ${action} there.`,
    { organizationId, organizationName },
  );
}

function isPermissionDenied(error: unknown): boolean {
  if (error instanceof PermissionError) return true;
  if (hasStatusCode(error) && error.statusCode === 403) return true;

  return false;
}
