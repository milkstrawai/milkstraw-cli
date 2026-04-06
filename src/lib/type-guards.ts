export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasName(value: unknown): value is { name: string } {
  return isRecord(value) && typeof value.name === 'string';
}

export function hasMessage(value: unknown): value is { message: string } {
  return isRecord(value) && typeof value.message === 'string';
}

export function hasStatusCode(value: unknown): value is { statusCode: number } {
  return isRecord(value) && typeof value.statusCode === 'number';
}
