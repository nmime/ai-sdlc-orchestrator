import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@app/common';
import type { AppError } from '@app/common';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export interface SessionToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class CredentialProxyClient {
  private baseUrl: string;

  private readonly internalToken: string;

  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext('CredentialProxyClient');
    this.baseUrl = process.env['CREDENTIAL_PROXY_URL'] || 'http://localhost:4000';
    this.internalToken = process.env['CREDENTIAL_PROXY_INTERNAL_TOKEN'] ?? '';
  }

  async createSession(tenantId: string, scopes: string[]): Promise<Result<SessionToken, AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
        body: JSON.stringify({ tenantId, scopes }),
      });

      if (!response.ok) {
        return ResultUtils.err('INTERNAL_ERROR', `Credential proxy returned ${response.status}`);
      }

      const data = (await response.json()) as SessionToken;
      return ResultUtils.ok(data);
    } catch (error) {
      return ResultUtils.err('INTERNAL_ERROR', `Credential proxy unreachable: ${(error as Error).message}`);
    }
  }

  async getGitCredential(sessionToken: string): Promise<Result<{ username: string; password: string }, AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/git-credential`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!response.ok) {
        return ResultUtils.err('UNAUTHORIZED', 'Invalid session token');
      }

      const data = (await response.json()) as { username: string; password: string };
      return ResultUtils.ok(data);
    } catch (error) {
      return ResultUtils.err('INTERNAL_ERROR', (error as Error).message);
    }
  }

  async getMcpToken(sessionToken: string, serverName: string): Promise<Result<{ token: string }, AppError>> {
    if (!SAFE_ID.test(serverName)) {
      return ResultUtils.err('VALIDATION_ERROR', 'Invalid server name');
    }
    try {
      const response = await fetch(`${this.baseUrl}/mcp-token/${serverName}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!response.ok) {
        return ResultUtils.err('UNAUTHORIZED', 'Invalid session token or server not configured');
      }

      const data = (await response.json()) as { token: string };
      return ResultUtils.ok(data);
    } catch (error) {
      return ResultUtils.err('INTERNAL_ERROR', (error as Error).message);
    }
  }

  async revokeSession(sessionToken: string): Promise<Result<void, AppError>> {
    try {
      await fetch(`${this.baseUrl}/sessions/${sessionToken}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.internalToken,
        },
      });
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('INTERNAL_ERROR', (error as Error).message);
    }
  }
}
