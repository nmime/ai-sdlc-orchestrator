import { describe, it, expect } from 'vitest';
import { EncryptionService } from '../encryption/encryption.service';

function createService(key = 'test-secret-key-32-chars-long!!!', salt = 'test-salt') {
  const mockConfig = {
    get: (k: string) => {
      if (k === 'ENCRYPTION_KEY') return key;
      if (k === 'ENCRYPTION_SALT') return salt;
      return undefined;
    },
  };
  return new EncryptionService(mockConfig as any);
}

describe('EncryptionService', () => {
  it('encrypts and decrypts a string', () => {
    const service = createService();
    const plaintext = 'Hello, World!';
    const ciphertext = service.encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(':')).toHaveLength(3);
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const service = createService();
    const c1 = service.encrypt('same');
    const c2 = service.encrypt('same');
    expect(c1).not.toBe(c2);
  });

  it('handles short strings', () => {
    const service = createService();
    const ct = service.encrypt('a');
    expect(service.decrypt(ct)).toBe('a');
  });

  it('handles unicode', () => {
    const service = createService();
    const text = '\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8 \ud83c\udf89';
    expect(service.decrypt(service.encrypt(text))).toBe(text);
  });

  it('handles long strings', () => {
    const service = createService();
    const text = 'x'.repeat(10_000);
    expect(service.decrypt(service.encrypt(text))).toBe(text);
  });

  it('throws on invalid ciphertext format', () => {
    const service = createService();
    expect(() => service.decrypt('invalid')).toThrow('Invalid ciphertext format');
    expect(() => service.decrypt('a:b')).toThrow('Invalid ciphertext format');
  });

  it('throws on tampered ciphertext', () => {
    const service = createService();
    const ct = service.encrypt('test');
    const parts = ct.split(':');
    parts[2] = 'ff' + parts[2]!.slice(2);
    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });

  it('throws if ENCRYPTION_KEY is missing', () => {
    expect(() => createService('', 'salt')).toThrow('ENCRYPTION_KEY is required');
  });

  it('different keys produce different ciphertext that cannot cross-decrypt', () => {
    const s1 = createService('key-one-32-chars-long-xxxxxxxxxx', 'salt1');
    const s2 = createService('key-two-32-chars-long-xxxxxxxxxx', 'salt2');
    const ct = s1.encrypt('secret');
    expect(() => s2.decrypt(ct)).toThrow();
  });
});
