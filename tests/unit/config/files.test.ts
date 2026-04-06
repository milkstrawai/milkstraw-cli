import { describe, expect, it, vi } from 'vitest';

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => '/tmp/milkstraw-home',
  };
});

import { getConfigDir } from '../../../src/config/files.js';

describe('config/files', () => {
  it('getConfigDir uses the home directory', () => {
    expect(getConfigDir()).toBe('/tmp/milkstraw-home/.config/milkstraw-cli');
  });
});
