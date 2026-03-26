const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

export function sanitizeLog(input: string, maxLen = 500): string {
  return input.replace(CONTROL_CHAR_RE, '').slice(0, maxLen);
}
