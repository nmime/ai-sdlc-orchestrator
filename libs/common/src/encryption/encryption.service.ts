import { Injectable } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    const secret = process.env['ENCRYPTION_KEY'] || process.env['DATABASE_PASSWORD'] || 'dev-fallback-key-not-for-production';
    this.key = scryptSync(secret, 'ai-sdlc-salt', 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid ciphertext format');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
