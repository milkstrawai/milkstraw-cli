import { beforeEach, describe, expect, it } from 'vitest';
import { readEnvConfig } from '../../../src/config/env.js';

describe('readEnvConfig', () => {
  beforeEach(() => {
    delete process.env.MILKSTRAW_API_URL;
    delete process.env.MILKSTRAW_ORG;
    delete process.env.MILKSTRAW_AWS_PROFILE;
  });

  it('returns undefined for all fields when no env vars set', () => {
    const config = readEnvConfig();

    expect(config.apiUrl).toBeUndefined();
    expect(config.organizationId).toBeUndefined();
    expect(config.awsProfile).toBeUndefined();
  });

  it('reads MILKSTRAW_API_URL', () => {
    process.env.MILKSTRAW_API_URL = 'https://staging.milkstraw.ai';
    expect(readEnvConfig().apiUrl).toBe('https://staging.milkstraw.ai');
  });

  it('reads MILKSTRAW_ORG', () => {
    process.env.MILKSTRAW_ORG = 'org_123';
    expect(readEnvConfig().organizationId).toBe('org_123');
  });

  it('reads MILKSTRAW_AWS_PROFILE', () => {
    process.env.MILKSTRAW_AWS_PROFILE = 'prod-account';
    expect(readEnvConfig().awsProfile).toBe('prod-account');
  });
});
