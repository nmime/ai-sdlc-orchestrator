import { EncryptedType } from '../entities/encrypted.type';

const TEST_KEY = 'test-encryption-key-for-unit-tests-32ch';
const TEST_SALT = 'test-salt-value1';

describe('EncryptedType', () => {
  const type = new EncryptedType();
  const platform = {} as any;

  beforeAll(() => {
    process.env['DB_ENCRYPTION_KEY'] = TEST_KEY;
    process.env['DB_ENCRYPTION_SALT'] = TEST_SALT;
  });

  afterAll(() => {
    delete process.env['DB_ENCRYPTION_KEY'];
    delete process.env['DB_ENCRYPTION_SALT'];
  });

  it('should encrypt and decrypt a string value', () => {
    const plaintext = 'my-secret-api-key-12345';
    const encrypted = type.convertToDatabaseValue(plaintext, platform);

    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');

    const decrypted = type.convertToJSValue(encrypted, platform);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-value';
    const enc1 = type.convertToDatabaseValue(plaintext, platform);
    const enc2 = type.convertToDatabaseValue(plaintext, platform);
    expect(enc1).not.toBe(enc2);
  });

  it('should handle null/undefined values', () => {
    expect(type.convertToDatabaseValue(undefined, platform)).toBeUndefined();
    expect(type.convertToDatabaseValue(null as any, platform)).toBeNull();
    expect(type.convertToJSValue(undefined, platform)).toBeUndefined();
    expect(type.convertToJSValue(null as any, platform)).toBeNull();
  });

  it('should handle empty string', () => {
    const encrypted = type.convertToDatabaseValue('', platform);
    const decrypted = type.convertToJSValue(encrypted, platform);
    expect(decrypted).toBe('');
  });

  it('should handle unicode strings', () => {
    const plaintext = '日本語テスト 🔐 émojis';
    const encrypted = type.convertToDatabaseValue(plaintext, platform);
    const decrypted = type.convertToJSValue(encrypted, platform);
    expect(decrypted).toBe(plaintext);
  });

  it('should handle long strings', () => {
    const plaintext = 'a'.repeat(10000);
    const encrypted = type.convertToDatabaseValue(plaintext, platform);
    const decrypted = type.convertToJSValue(encrypted, platform);
    expect(decrypted).toBe(plaintext);
  });

  it('should return raw value if too short to be encrypted (graceful degradation)', () => {
    const shortVal = Buffer.from('short').toString('base64');
    const result = type.convertToJSValue(shortVal, platform);
    expect(result).toBe(shortVal);
  });

  it('should return raw value if decryption fails (tampered ciphertext)', () => {
    const validEncrypted = type.convertToDatabaseValue('test', platform);
    const buf = Buffer.from(validEncrypted, 'base64');
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');
    const result = type.convertToJSValue(tampered, platform);
    expect(result).toBe(tampered);
  });

  it('should throw if DB_ENCRYPTION_KEY is not set', () => {
    const originalKey = process.env['DB_ENCRYPTION_KEY'];
    delete process.env['DB_ENCRYPTION_KEY'];
    expect(() => type.convertToDatabaseValue('test', platform)).toThrow('DB_ENCRYPTION_KEY env var is required');
    process.env['DB_ENCRYPTION_KEY'] = originalKey;
  });

  it('should return text column type', () => {
    expect(type.getColumnType()).toBe('text');
  });
});
