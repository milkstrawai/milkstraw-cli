import { hostname, platform } from 'node:os';

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
};

export function getDeviceName(): string {
  const name = hostname().replace(/\.local$/, '');
  const label = PLATFORM_LABELS[platform()] ?? platform();
  return `${name} (${label})`;
}
