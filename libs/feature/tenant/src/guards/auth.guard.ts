import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@ai-sdlc/common';
import { VALID_ROLES, type UserRole, type AuthenticatedRequest } from '@ai-sdlc/common';
import { ApiKeyService } from '../api-key.service';

interface OidcUserInfo {
  sub: string;
  email?: string;
  role?: string;
  tenant_id?: string;
}

const OIDC_TIMEOUT_MS = 10_000;

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) return false;

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      return this.validateToken(token, request);
    }

    if (authHeader.startsWith('ApiKey ')) {
      const apiKey = authHeader.slice(7);
      return this.validateApiKey(apiKey, request);
    }

    return false;
  }

  private isValidRole(role: string): role is UserRole {
    return (VALID_ROLES as readonly string[]).includes(role);
  }

  private async validateToken(token: string, request: AuthenticatedRequest): Promise<boolean> {
    const issuerUrl = this.configService.get('OIDC_ISSUER_URL');
    const nodeEnv = this.configService.get('NODE_ENV');
    if (!issuerUrl) {
      if (nodeEnv !== 'development') {
        throw new UnauthorizedException('OIDC not configured');
      }
      this.logger.warn('OIDC not configured \u2014 using dev-mode bypass. DO NOT use in production.');
      request.user = { id: 'dev-user', email: 'dev@local', role: 'admin', tenantId: '00000000-0000-4000-a000-000000000001' };
      return true;
    }

    try {
      const response = await fetch(`${issuerUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(OIDC_TIMEOUT_MS),
      });

      if (!response.ok) return false;

      const userInfo = await response.json() as OidcUserInfo;
      const claimedRole = userInfo.role || 'viewer';
      request.user = {
        id: userInfo.sub,
        email: userInfo.email,
        role: this.isValidRole(claimedRole) ? claimedRole : 'viewer',
        tenantId: userInfo.tenant_id || '',
      };
      return true;
    } catch {
      return false;
    }
  }

  private async validateApiKey(apiKey: string, request: AuthenticatedRequest): Promise<boolean> {
    const result = await this.apiKeyService.validate(apiKey);
    if (result.isErr()) return false;
    const key = result.value;
    const role = key.role;
    request.user = {
      id: `apikey-${key.id}`,
      role: this.isValidRole(role) ? role : 'viewer',
      tenantId: key.tenant.id,
    };
    return true;
  }
}
