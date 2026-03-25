import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhookSignatureService {
  verifyGitHub(payload: string, signatureHeader: string | undefined, secret: string): void {
    if (!signatureHeader) throw new BadRequestException('Missing x-hub-signature-256 header');
    const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
    if (!this.safeCompare(expected, signatureHeader)) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  verifyGitLab(tokenHeader: string | undefined, secret: string): void {
    if (!tokenHeader) throw new BadRequestException('Missing X-Gitlab-Token header');
    if (!this.safeCompare(secret, tokenHeader)) {
      throw new BadRequestException('Invalid webhook token');
    }
  }

  verifyJira(payload: string, signatureHeader: string | undefined, secret: string): void {
    if (!signatureHeader) return;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (!this.safeCompare(expected, signatureHeader)) {
      throw new BadRequestException('Invalid Jira webhook signature');
    }
  }

  verifyLinear(payload: string, signatureHeader: string | undefined, secret: string): void {
    if (!signatureHeader) throw new BadRequestException('Missing Linear-Signature header');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (!this.safeCompare(expected, signatureHeader)) {
      throw new BadRequestException('Invalid Linear webhook signature');
    }
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
