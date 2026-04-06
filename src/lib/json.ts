export function prettyJson(value: unknown): string {
  return JSON.stringify(value, jsonReplacer, 2);
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();

  return value;
}
