const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 5;
const MAX_KEYS = 100;
const MAX_STRING_LENGTH = 10_000;

export function sanitizeRecord(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > MAX_DEPTH) {
    throw new Error('Object exceeds maximum nesting depth');
  }
  const keys = Object.keys(obj);
  if (keys.length > MAX_KEYS) {
    throw new Error(`Object exceeds maximum key count of ${MAX_KEYS}`);
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const val = obj[key];
    if (typeof val === 'string') {
      if (val.length > MAX_STRING_LENGTH) {
        throw new Error(`String value exceeds maximum length of ${MAX_STRING_LENGTH}`);
      }
      result[key] = val;
    } else if (Array.isArray(val)) {
      if (val.length > MAX_KEYS) {
        throw new Error(`Array exceeds maximum length of ${MAX_KEYS}`);
      }
      result[key] = val.map(item =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? sanitizeRecord(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeRecord(val as Record<string, unknown>, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}
