import { beforeEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../../../src/config/resolver.js';

describe('resolveConfig', () => {
  beforeEach(() => {
    delete process.env.MILKSTRAW_API_URL;
    delete process.env.MILKSTRAW_AWS_PROFILE;
  });

  it('returns defaults when no config exists', () => {
    const config = resolveConfig();
    expect(config.apiUrl).toBe('https://app.milkstraw.ai');
    expect(config.renderFormat).toBe('auto');
    expect(config.isQuiet).toBe(false);
    expect(config.verbose).toBe(false);
    expect(config.agentMode).toBe(false);
  });

  describe('aws profile precedence', () => {
    it('flag > env', () => {
      process.env.MILKSTRAW_AWS_PROFILE = 'env_aws';

      const config = resolveConfig({ awsProfile: 'flag_aws' });
      expect(config.awsProfile).toBe('flag_aws');
    });

    it('env fallback when no flag', () => {
      process.env.MILKSTRAW_AWS_PROFILE = 'env_aws';

      const config = resolveConfig();
      expect(config.awsProfile).toBe('env_aws');
    });
  });

  describe('API URL', () => {
    it('uses MILKSTRAW_API_URL when set', () => {
      process.env.MILKSTRAW_API_URL = 'http://localhost:3000';

      const config = resolveConfig();
      expect(config.apiUrl).toBe('http://localhost:3000');
    });
  });

  describe('output format', () => {
    it('--json sets json', () => {
      const config = resolveConfig({ json: true });
      expect(config.renderFormat).toBe('json');
      expect(config.isQuiet).toBe(false);
    });

    it('--quiet sets quiet', () => {
      const config = resolveConfig({ quiet: true });
      expect(config.renderFormat).toBe('json');
      expect(config.isQuiet).toBe(true);
    });

    it('--quiet wins over other render flags', () => {
      const config = resolveConfig({ quiet: true, markdown: true, json: true });
      expect(config.renderFormat).toBe('json');
      expect(config.isQuiet).toBe(true);
    });

    it('--markdown sets markdown', () => {
      const config = resolveConfig({ markdown: true });
      expect(config.renderFormat).toBe('markdown');
      expect(config.isQuiet).toBe(false);
    });

    it('--agent alone keeps auto rendering and non-quiet output', () => {
      const config = resolveConfig({ agent: true });
      expect(config.renderFormat).toBe('auto');
      expect(config.isQuiet).toBe(false);
    });
  });

  describe('boolean flags', () => {
    it('--agent enables agent mode', () => {
      expect(resolveConfig({ agent: true }).agentMode).toBe(true);
    });

    it('--verbose enables verbose', () => {
      expect(resolveConfig({ verbose: true }).verbose).toBe(true);
    });
  });
});
