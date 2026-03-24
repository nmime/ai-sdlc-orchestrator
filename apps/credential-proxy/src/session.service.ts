import { Injectable } from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';

interface SessionData {
  tenantId: string;
  workflowId: string;
  sessionId: string;
  expiresAt: number;
}

@Injectable()
export class SessionService {
  private sessions = new Map<string, SessionData>();
  private signingKey = process.env['SESSION_SIGNING_KEY'] || randomBytes(32).toString('hex');

  create(tenantId: string, workflowId: string, sessionId: string, ttlSeconds = 3600): { token: string; expiresAt: string } {
    const token = this.generateToken(sessionId);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sessions.set(token, { tenantId, workflowId, sessionId, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  validate(token: string): SessionData | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  revoke(sessionId: string): void {
    for (const [token, data] of this.sessions) {
      if (data.sessionId === sessionId) {
        this.sessions.delete(token);
      }
    }
  }

  private generateToken(sessionId: string): string {
    const nonce = randomBytes(16).toString('hex');
    const hmac = createHmac('sha256', this.signingKey).update(`${sessionId}:${nonce}`).digest('hex');
    return `${nonce}.${hmac}`;
  }
}
