import { Type, Platform } from '@mikro-orm/core';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const secret = process.env['DB_ENCRYPTION_KEY'];
  if (!secret) throw new Error('DB_ENCRYPTION_KEY env var is required for encrypted fields');
  const salt = process.env['DB_ENCRYPTION_SALT'] || secret.slice(0, 16);
  return scryptSync(secret, salt, 32);
}

export class EncryptedType extends Type<string, string> {
  convertToDatabaseValue(value: string | undefined, _platform: Platform): string {
    if (value === undefined || value === null) return value as unknown as string;
    const key = getKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  convertToJSValue(value: string | undefined, _platform: Platform): string {
    if (value === undefined || value === null) return value as unknown as string;
    try {
      const buf = Buffer.from(value, 'base64');
      if (buf.length < IV_LEN + TAG_LEN) return value;
      const key = getKey();
      const iv = buf.subarray(0, IV_LEN);
      const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
      const encrypted = buf.subarray(IV_LEN + TAG_LEN);
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final('utf8');
    } catch {
      return value;
    }
  }

  getColumnType(): string {
    return 'text';
  }
}
