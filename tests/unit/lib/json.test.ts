import { describe, expect, it } from 'vitest';
import { prettyJson } from '../../../src/lib/json.js';

describe('prettyJson', () => {
  it('formats objects as pretty JSON', () => {
    expect(prettyJson({ ok: true })).toBe('{\n  "ok": true\n}');
  });

  it('serializes bigint values safely', () => {
    expect(prettyJson({ count: 42n })).toBe('{\n  "count": "42"\n}');
  });
});
