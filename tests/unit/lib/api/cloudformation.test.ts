import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock client.ts to provide a controllable apiFetch
const mockApiFetch = vi.fn();
vi.mock('../../../../src/lib/api/client.js', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  initializeApiTransport: vi.fn(),
}));

const { getCloudFormationTemplates } = await import('../../../../src/lib/api/cloudformation.js');

function mockResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {},
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('getCloudFormationTemplates', () => {
  const templateBody = {
    templates: {
      management: {
        name: 'MilkStrawAccessStackV2',
        url: 'https://s3.example.com/mgmt.json',
        version: '2.0',
      },
      stackset: {
        name: 'MilkStrawStackSetWrapper',
        url: 'https://s3.example.com/stackset.json',
        version: '1.0',
      },
    },
    milkstraw_account_id: '801486250081',
  };

  it('returns templates response', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(templateBody));

    const result = await getCloudFormationTemplates();
    expect(result).toEqual({
      templates: templateBody.templates,
      milkstrawAccountId: '801486250081',
    });
  });

  it('calls the correct endpoint', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(templateBody));

    await getCloudFormationTemplates();

    expect(mockApiFetch).toHaveBeenCalledWith('/api/cloudformation/templates');
  });
});
