import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

interface SessionData {
  tenantId: string;
  workflowId: string;
  sessionId: string;
  scopes: string[];
  expiresAt: number;
  requestCount: number;
  createdAt: number;
}

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private sessions = new Map<string, SessionData>();
  private signingKey!: Buffer;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  onModuleInit() {
    const keyHex = process.env['SESSION_SIGNING_KEY'];
    if (!keyHex) {
      const nodeEnv = process.env['NODE_ENV'];
      if (nodeEnv !== 'development' && nodeEnv !== 'test') {
        throw new Error('SESSION_SIGNING_KEY is required in production');
      }
    }
    this.signingKey = Buffer.from(keyHex || randomBytes(32).toString('hex'), 'hex');
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60_000);
  }

  create(
    tenantId: string,
    workflowId: string,
    sessionId: string,
    ttlSeconds = 3600,
    scopes: string[] = ['git', 'mcp', 'ai-api'],
  ): { token: string; expiresAt: string } {
    const tenantSessions = Array.from(this.sessions.values()).filter(s => s.tenantId === tenantId).length;
    if (tenantSessions >= 100) {
      throw new Error(`Session limit exceeded for tenant ${tenantId}`);
    }

    const nonce = randomBytes(16).toString('hex');
    const payload = `${sessionId}:${nonce}:${Date.now()}`;
    const hmac = createHmac('sha256', this.signingKey).update(payload).digest('hex');
    const token = `${nonce}.${hmac}`;

    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sessions.set(token, {
      tenantId,
      workflowId,
      sessionId,
      scopes,
      expiresAt,
      requestCount: 0,
      createdAt: Date.now(),
    });

    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  validate(token: string): SessionData | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    session.requestCount++;
    return session;
  }

  hasScope(token: string, scope: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;
    return session.scopes.includes(scope);
  }

  revoke(sessionId: string): void {
    for (const [token, data] of this.sessions) {
      if (data.sessionId === sessionId) {
        this.sessions.delete(token);
      }
    }
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [token, data] of this.sessions) {
      if (now > data.expiresAt) this.sessions.delete(token);
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}
