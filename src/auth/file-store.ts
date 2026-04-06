import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from '../config/files.js';
import type { TokenStore } from './session.js';

export function createFileTokenStore(options?: { verbose?: boolean }): TokenStore {
  const verbose = options?.verbose ?? false;

  return {
    async getToken(): Promise<string | null> {
      const path = getTokenPath();

      if (!existsSync(path)) return null;

      try {
        const token = readFileSync(path, 'utf-8').trim();

        return token || null;
      } catch (error) {
        if (verbose) {
          process.stderr.write(`[auth] Failed to read token at ${path}: ${error}\n`);
        }

        return null;
      }
    },

    async setToken(token: string): Promise<void> {
      const dir = getConfigDir();

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      writeFileSync(getTokenPath(), token, { encoding: 'utf-8', mode: 0o600 });
    },

    async clearToken(): Promise<void> {
      const path = getTokenPath();

      if (existsSync(path)) {
        try {
          unlinkSync(path);
        } catch (error) {
          if (verbose) {
            process.stderr.write(`[auth] Failed to delete token at ${path}: ${error}\n`);
          }
        }
      }
    },

    async isAuthenticated(): Promise<boolean> {
      const token = await this.getToken();
      return token !== null;
    },
  };
}

function getTokenPath(): string {
  return join(getConfigDir(), 'token');
}
