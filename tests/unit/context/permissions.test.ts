import { describe, expect, it } from 'vitest';
import { rethrowOrganizationPermissionError, withPermissionCheck } from '../../../src/context/permissions.js';
import { PermissionError } from '../../../src/core/errors.js';

describe('rethrowOrganizationPermissionError', () => {
  it('wraps PermissionError with organization context', () => {
    const error = new PermissionError('denied');

    expect(() => rethrowOrganizationPermissionError(error, 'deploy stacks', 'org_1', 'Acme')).toThrowError(
      /do not have permission to deploy stacks/,
    );
  });

  it('wraps 403 statusCode errors with organization context', () => {
    const error = new Error('Forbidden') as Error & { statusCode: number };
    error.statusCode = 403;

    expect(() => rethrowOrganizationPermissionError(error, 'update stacks', 'org_1', 'Acme')).toThrowError(
      /do not have permission to update stacks/,
    );
  });

  it('includes organization name in error when provided', () => {
    const error = new PermissionError('denied');

    try {
      rethrowOrganizationPermissionError(error, 'update', 'org_1', 'Acme');
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionError);
      expect((e as PermissionError).message).toContain('"Acme"');
      expect((e as PermissionError).organizationId).toBe('org_1');
      expect((e as PermissionError).organizationName).toBe('Acme');
    }
  });

  it('uses organization id when name is not provided', () => {
    const error = new PermissionError('denied');

    try {
      rethrowOrganizationPermissionError(error, 'update', 'org_2');
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionError);
      expect((e as PermissionError).message).toContain('org_2');
    }
  });

  it('rethrows non-permission errors unchanged', () => {
    const error = new Error('boom');

    expect(() => rethrowOrganizationPermissionError(error, 'update stacks', 'org_1')).toThrow(error);
  });
});

describe('withPermissionCheck', () => {
  it('returns the result when no permission error', async () => {
    const result = await withPermissionCheck(() => Promise.resolve('ok'), 'read', 'org_1');
    expect(result).toBe('ok');
  });

  it('wraps permission errors with organization context', async () => {
    const error = new PermissionError('denied');

    await expect(withPermissionCheck(() => Promise.reject(error), 'deploy', 'org_1', 'Acme')).rejects.toThrowError(
      /do not have permission to deploy/,
    );
  });

  it('rethrows non-permission errors unchanged', async () => {
    const error = new Error('network');

    await expect(withPermissionCheck(() => Promise.reject(error), 'deploy', 'org_1')).rejects.toThrow(error);
  });
});
