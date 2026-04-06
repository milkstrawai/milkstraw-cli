import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testDir = join(tmpdir(), `milkstraw-test-tokens-${Date.now()}`);

let unlinkShouldFail = false;

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    unlinkSync: (...args: Parameters<typeof actual.unlinkSync>) => {
      if (unlinkShouldFail) throw new Error('EACCES');
      return actual.unlinkSync(...args);
    },
  };
});

vi.mock('../../../src/config/files.js', () => ({
  getConfigDir: vi.fn(() => testDir),
}));

import { createFileTokenStore } from '../../../src/auth/file-store.js';

describe('FileTokenStore', () => {
  let store: ReturnType<typeof createFileTokenStore>;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    store = createFileTokenStore();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns null for missing token', async () => {
    const token = await store.getToken();
    expect(token).toBeNull();
  });

  it('stores and retrieves a token', async () => {
    await store.setToken('my-token-123');
    const token = await store.getToken();
    expect(token).toBe('my-token-123');
  });

  it('overwrites an existing token', async () => {
    await store.setToken('old-token');
    await store.setToken('new-token');
    const token = await store.getToken();
    expect(token).toBe('new-token');
  });

  it('deletes a token', async () => {
    await store.setToken('my-token');
    await store.clearToken();
    const token = await store.getToken();
    expect(token).toBeNull();
  });

  it('handles deleting non-existent token', async () => {
    await expect(store.clearToken()).resolves.not.toThrow();
  });

  it('isAuthenticated returns true when token exists', async () => {
    await store.setToken('my-token');
    expect(await store.isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when no token', async () => {
    expect(await store.isAuthenticated()).toBe(false);
  });

  it('getToken returns null when token file is unreadable', async () => {
    mkdirSync(join(testDir, 'token'), { recursive: true });

    const token = await store.getToken();
    expect(token).toBeNull();

    rmSync(join(testDir, 'token'), { recursive: true });
  });

  it('clearToken swallows errors when token file cannot be deleted', async () => {
    await store.setToken('tok');
    unlinkShouldFail = true;

    await expect(store.clearToken()).resolves.not.toThrow();

    unlinkShouldFail = false;
  });

  it('creates config directory if it does not exist', async () => {
    rmSync(testDir, { recursive: true, force: true });
    await store.setToken('test');
    const token = await store.getToken();
    expect(token).toBe('test');
  });
});
