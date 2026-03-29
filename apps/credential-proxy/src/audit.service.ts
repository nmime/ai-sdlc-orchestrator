import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';

export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  tenantId: string;
  action: string;
  resource: string;
  status: 'success' | 'denied' | 'error';
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService implements OnModuleInit {
  private entries: AuditEntry[] = [];
  private readonly maxEntries = 10_000;
  private readonly logDir: string;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('AUDIT_LOG_DIR') || '/var/log/credential-proxy';
    const base = '/var/log';
    const resolved = resolve(base, raw);
    this.logDir = resolved.startsWith(base) ? resolved : '/var/log/credential-proxy';
  }

  async onModuleInit(): Promise<void> {
    try {
      await mkdir(this.logDir, { recursive: true });
    } catch {}
  }

  log(entry: AuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries / 2);
    }
    this.persistEntry(entry).catch(() => {});
  }

  getRecent(limit = 100): AuditEntry[] {
    return this.entries.slice(-limit);
  }

  getBySession(sessionId: string, limit = 100): AuditEntry[] {
    return this.entries.filter(e => e.sessionId === sessionId).slice(-limit);
  }

  getByTenant(tenantId: string, limit = 100): AuditEntry[] {
    return this.entries.filter(e => e.tenantId === tenantId).slice(-limit);
  }

  private async persistEntry(entry: AuditEntry): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const logFile = join(this.logDir, `audit-${date}.jsonl`);
    await appendFile(logFile, `${JSON.stringify(entry)  }\n`);
  }
}
