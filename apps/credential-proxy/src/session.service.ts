import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHmac } from 'crypto';
import Redis from 'ioredis';

interface SessionData {
  tenantId: string;
  workflowId: string;
  sessionId: string;
  expiresAt: number;
}

const SESSION_PREFIX = 'cp:sess:';
const REVOKE_PREFIX = 'cp:rev:';

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly signingKey: string;

  constructor(private readonly config: ConfigService) {
    this.signingKey = this.config.get<string>('SESSION_SIGNING_KEY') || randomBytes(32).toString('hex');
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
    this.redis.connect().catch(() => {});
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async create(tenantId: string, workflowId: string, sessionId: string, ttlSeconds = 3600): Promise<{ token: string; expiresAt: string }> {
    const token = this.generateToken(sessionId);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const data: SessionData = { tenantId, workflowId, sessionId, expiresAt };
    const pipe = this.redis.pipeline();
    pipe.set(`${SESSION_PREFIX}${token}`, JSON.stringify(data), 'EX', ttlSeconds);
    pipe.sadd(`${REVOKE_PREFIX}${sessionId}`, token);
    pipe.expire(`${REVOKE_PREFIX}${sessionId}`, ttlSeconds);
    await pipe.exec();
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  async validate(token: string): Promise<SessionData | null> {
    const raw = await this.redis.get(`${SESSION_PREFIX}${token}`);
    if (!raw) return null;
    const session = JSON.parse(raw) as SessionData;
    if (Date.now() > session.expiresAt) {
      await this.redis.del(`${SESSION_PREFIX}${token}`);
      return null;
    }
    return session;
  }

  async revoke(sessionId: string): Promise<void> {
    const tokens = await this.redis.smembers(`${REVOKE_PREFIX}${sessionId}`);
    if (tokens.length === 0) return;
    const pipe = this.redis.pipeline();
    for (const t of tokens) {
      pipe.del(`${SESSION_PREFIX}${t}`);
    }
    pipe.del(`${REVOKE_PREFIX}${sessionId}`);
    await pipe.exec();
  }

  private generateToken(sessionId: string): string {
    const nonce = randomBytes(16).toString('hex');
    const hmac = createHmac('sha256', this.signingKey).update(`${sessionId}:${nonce}`).digest('hex');
    return `${nonce}.${hmac}`;
  }
}
