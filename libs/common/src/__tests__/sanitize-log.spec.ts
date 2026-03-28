import { describe, it, expect } from 'vitest';
import { sanitizeLog } from '../validation/sanitize-log';

describe('sanitizeLog', () => {
  it('removes control characters', () => {
    expect(sanitizeLog('hello\x00world')).toBe('helloworld');
    expect(sanitizeLog('line1\nline2')).toBe('line1line2');
    expect(sanitizeLog('tab\there')).toBe('tabhere');
    expect(sanitizeLog('del\x7fchar')).toBe('delchar');
  });

  it('preserves normal text', () => {
    expect(sanitizeLog('Hello, World!')).toBe('Hello, World!');
  });

  it('truncates to default maxLen of 500', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeLog(long)).toHaveLength(500);
  });

  it('truncates to custom maxLen', () => {
    expect(sanitizeLog('abcdefgh', 5)).toBe('abcde');
  });

  it('handles empty string', () => {
    expect(sanitizeLog('')).toBe('');
  });

  it('removes all control chars then truncates', () => {
    const input = '\x00'.repeat(10) + 'a'.repeat(100);
    expect(sanitizeLog(input, 50)).toBe('a'.repeat(50));
  });
});
