import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import type { AppConfig } from '../config/app-config.module';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const secret = this.configService.get('ENCRYPTION_KEY', { infer: true });
    if (!secret) {
      const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
      if (nodeEnv !== 'development' && nodeEnv !== 'test') {
        throw new Error('ENCRYPTION_KEY is required in production. Set it to a random 32+ character string.');
      }
    }
    const salt = this.configService.get('ENCRYPTION_SALT', { infer: true });
    this.key = scryptSync(secret || 'dev-only-key-do-not-use-in-production', salt, 32);
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
