import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@ai-sdlc/common';

interface OidcUserInfo {
  sub: string;
  email?: string;
  role?: string;
  tenant_id?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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

  private async validateToken(token: string, request: any): Promise<boolean> {
    const issuerUrl = this.configService.get('OIDC_ISSUER_URL');
    if (!issuerUrl) {
      request.user = { id: 'dev-user', email: 'dev@local', role: 'admin', tenantId: 'dev-tenant' };
      return true;
    }

    try {
      const response = await fetch(`${issuerUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return false;

      const userInfo = await response.json() as OidcUserInfo;
      request.user = {
        id: userInfo.sub,
        email: userInfo.email,
        role: userInfo.role || 'viewer',
        tenantId: userInfo.tenant_id,
      };
      return true;
    } catch {
      return false;
    }
  }

  private async validateApiKey(apiKey: string, request: any): Promise<boolean> {
    request.user = { id: 'api-user', role: 'operator', tenantId: 'from-api-key' };
    return true;
  }
}
