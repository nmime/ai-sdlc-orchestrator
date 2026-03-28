import { describe, it, expect } from 'vitest';
import { isInternalUrl } from '../validation/is-internal-url';

describe('isInternalUrl', () => {
  it('blocks localhost', () => {
    expect(isInternalUrl('http://localhost/api')).toBe(true);
    expect(isInternalUrl('http://localhost:3000/api')).toBe(true);
  });

  it('blocks 127.0.0.1', () => {
    expect(isInternalUrl('http://127.0.0.1/api')).toBe(true);
    expect(isInternalUrl('http://127.0.0.1:8080/')).toBe(true);
  });

  it('blocks ::1 (IPv6 loopback)', () => {
    expect(isInternalUrl('http://[::1]/api')).toBe(true);
  });

  it('blocks 0.0.0.0', () => {
    expect(isInternalUrl('http://0.0.0.0/')).toBe(true);
  });

  it('blocks 10.x.x.x private range', () => {
    expect(isInternalUrl('http://10.0.0.1/')).toBe(true);
    expect(isInternalUrl('http://10.255.255.255/')).toBe(true);
  });

  it('blocks 172.16-31.x.x private range', () => {
    expect(isInternalUrl('http://172.16.0.1/')).toBe(true);
    expect(isInternalUrl('http://172.31.255.255/')).toBe(true);
    expect(isInternalUrl('http://172.15.0.1/')).toBe(false);
    expect(isInternalUrl('http://172.32.0.1/')).toBe(false);
  });

  it('blocks 192.168.x.x private range', () => {
    expect(isInternalUrl('http://192.168.1.1/')).toBe(true);
    expect(isInternalUrl('http://192.168.0.1/')).toBe(true);
  });

  it('blocks 169.254.x.x link-local', () => {
    expect(isInternalUrl('http://169.254.169.254/')).toBe(true);
  });

  it('blocks .local and .internal domains', () => {
    expect(isInternalUrl('http://myhost.local/')).toBe(true);
    expect(isInternalUrl('http://service.internal/')).toBe(true);
  });

  it('blocks non-http(s) protocols', () => {
    expect(isInternalUrl('ftp://example.com/file')).toBe(true);
    expect(isInternalUrl('file:///etc/passwd')).toBe(true);
  });

  it('blocks IPv6 addresses', () => {
    expect(isInternalUrl('http://[fe80::1]/')).toBe(true);
  });

  it('returns true on invalid URLs', () => {
    expect(isInternalUrl('not a url')).toBe(true);
    expect(isInternalUrl('')).toBe(true);
  });

  it('allows external URLs', () => {
    expect(isInternalUrl('https://api.github.com/repos')).toBe(false);
    expect(isInternalUrl('https://example.com/')).toBe(false);
    expect(isInternalUrl('http://8.8.8.8/')).toBe(false);
  });
});
