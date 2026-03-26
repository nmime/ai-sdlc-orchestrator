import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';

export interface SessionToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class CredentialProxyClient {
  readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('CredentialProxyClient');
    this.baseUrl = this.config.get<string>('CREDENTIAL_PROXY_URL') || 'http://localhost:4000';
  }

  async createSession(tenantId: string, scopes: string[]): Promise<Result<SessionToken, AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${this.baseUrl}/sessions/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('INTERNAL_ERROR', (error as Error).message);
    }
  }
}
