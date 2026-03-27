import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError, AppConfig } from '@ai-sdlc/common';

export interface SessionToken {
  token: string;
  expiresAt: Date;
}

const FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class CredentialProxyClient {
  readonly baseUrl: string;
  private readonly internalToken: string;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('CredentialProxyClient');
    this.baseUrl = this.config.get('CREDENTIAL_PROXY_URL');
    this.internalToken = this.config.get('CREDENTIAL_PROXY_INTERNAL_TOKEN');
  }

  async createSession(tenantId: string, scopes: string[]): Promise<Result<SessionToken, AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.internalToken,
        },
        body: JSON.stringify({ tenantId, scopes }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

  async getGitCredential(sessionToken: string, host = 'github.com'): Promise<Result<{ username: string; password: string }, AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/git-credential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ host }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('INTERNAL_ERROR', (error as Error).message);
    }
  }
}
