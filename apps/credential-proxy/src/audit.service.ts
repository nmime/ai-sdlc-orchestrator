import { Injectable } from '@nestjs/common';

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
export class AuditService {
  private entries: AuditEntry[] = [];
  private readonly maxEntries = 10_000;

  log(entry: AuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries / 2);
    }
  }

  getRecent(limit = 100): AuditEntry[] {
    return this.entries.slice(-limit);
  }

  getBySession(sessionId: string, limit = 100): AuditEntry[] {
    return this.entries.filter(e => e.sessionId === sessionId).slice(-limit);
  }
}
