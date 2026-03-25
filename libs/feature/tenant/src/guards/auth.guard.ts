import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';
import { ApiKeyService } from '../api-key.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthenticatedUser }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) throw new UnauthorizedException('Missing authorization header');

    if (authHeader.startsWith('Bearer ')) {
      return this.validateBearerToken(authHeader.slice(7), request);
    }

    if (authHeader.startsWith('ApiKey ')) {
      return this.validateApiKey(authHeader.slice(7), request);
    }

    throw new UnauthorizedException('Unsupported authorization scheme');
  }

  private async validateBearerToken(token: string, request: { user?: AuthenticatedUser }): Promise<boolean> {
    const issuerUrl = this.configService.get('OIDC_ISSUER_URL');
    if (!issuerUrl) {
      request.user = { id: 'dev-user', email: 'dev@local', role: 'admin', tenantId: 'dev-tenant' };
      return true;
    }

    try {
      const response = await fetch(`${issuerUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new UnauthorizedException('Invalid OIDC token');

      const userInfo = await response.json() as { sub: string; email?: string; role?: string; tenant_id?: string };
      request.user = {
        id: userInfo.sub,
        email: userInfo.email ?? '',
        role: userInfo.role || 'viewer',
        tenantId: userInfo.tenant_id,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('OIDC validation failed');
    }
  }

  private async validateApiKey(rawKey: string, request: { user?: AuthenticatedUser }): Promise<boolean> {
    const result = await this.apiKeyService.validate(rawKey);
    if (result.isErr()) throw new UnauthorizedException(result.error.message);

    const apiKey = result.value;
    request.user = {
      id: `apikey:${apiKey.id}`,
      email: `apikey:${apiKey.name}`,
      role: apiKey.role,
      tenantId: apiKey.tenant.id,
    };
    return true;
  }
}
