import { BadRequestException } from '@nestjs/common';
import { assertSafeUrl } from '../ssrf.validator';

describe('assertSafeUrl', () => {
  it('should accept valid HTTPS URLs', () => {
    const url = assertSafeUrl('https://github.com/org/repo');
    expect(url.hostname).toBe('github.com');
  });

  it('should accept HTTPS on port 443', () => {
    const url = assertSafeUrl('https://example.com:443/path');
    expect(url.hostname).toBe('example.com');
  });

  it('should reject HTTP URLs', () => {
    expect(() => assertSafeUrl('http://example.com')).toThrow(BadRequestException);
    expect(() => assertSafeUrl('http://example.com')).toThrow('Only HTTPS URLs are allowed');
  });

  it('should reject invalid URLs', () => {
    expect(() => assertSafeUrl('not-a-url')).toThrow(BadRequestException);
    expect(() => assertSafeUrl('not-a-url')).toThrow('Invalid URL');
  });

  it('should reject localhost', () => {
    expect(() => assertSafeUrl('https://localhost/foo')).toThrow('Localhost URLs are not allowed');
    expect(() => assertSafeUrl('https://[::1]/foo')).toThrow('Localhost URLs are not allowed');
  });

  it('should reject private 127.x IPs', () => {
    expect(() => assertSafeUrl('https://127.0.0.1/foo')).toThrow('Private IP addresses are not allowed');
    expect(() => assertSafeUrl('https://127.255.255.255/foo')).toThrow('Private IP addresses are not allowed');
  });

  it('should reject private 10.x IPs', () => {
    expect(() => assertSafeUrl('https://10.0.0.1/foo')).toThrow('Private IP addresses are not allowed');
    expect(() => assertSafeUrl('https://10.255.0.1/foo')).toThrow('Private IP addresses are not allowed');
  });

  it('should reject private 172.16-31.x IPs', () => {
    expect(() => assertSafeUrl('https://172.16.0.1/foo')).toThrow('Private IP addresses are not allowed');
    expect(() => assertSafeUrl('https://172.31.255.1/foo')).toThrow('Private IP addresses are not allowed');
  });

  it('should reject private 192.168.x IPs', () => {
    expect(() => assertSafeUrl('https://192.168.1.1/foo')).toThrow('Private IP addresses are not allowed');
  });

  it('should reject 0.x IPs', () => {
    expect(() => assertSafeUrl('https://0.0.0.0/foo')).toThrow('Private IP addresses are not allowed');
  });

  it('should reject link-local 169.254.x IPs', () => {
    expect(() => assertSafeUrl('https://169.254.169.254/foo')).toThrow('Private IP addresses are not allowed');
  });

  it('should reject non-standard ports', () => {
    expect(() => assertSafeUrl('https://example.com:8080/foo')).toThrow('Non-standard ports are not allowed');
    expect(() => assertSafeUrl('https://example.com:3000/foo')).toThrow('Non-standard ports are not allowed');
  });

  it('should allow public IPs', () => {
    const url = assertSafeUrl('https://8.8.8.8/path');
    expect(url.hostname).toBe('8.8.8.8');
  });

  it('should reject FTP scheme', () => {
    expect(() => assertSafeUrl('ftp://example.com/file')).toThrow('Only HTTPS URLs are allowed');
  });

  it('should not reject 172.32.x (outside private range)', () => {
    const url = assertSafeUrl('https://172.32.0.1/path');
    expect(url.hostname).toBe('172.32.0.1');
  });
});
