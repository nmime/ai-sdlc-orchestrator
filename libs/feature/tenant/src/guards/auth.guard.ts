import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import type { AppConfig } from '@app/common';
import { ApiKeyService } from '../api-key.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

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
      const nodeEnv = this.configService.get('NODE_ENV');
      if (nodeEnv !== 'development' && nodeEnv !== 'test') {
        throw new UnauthorizedException('OIDC not configured');
      }
      const allowBypass = this.configService.get('ALLOW_DEV_AUTH_BYPASS', { infer: true });
      if (allowBypass !== 'true') {
        throw new UnauthorizedException('OIDC not configured (set ALLOW_DEV_AUTH_BYPASS=true to enable dev bypass)');
      }
      Logger.warn('Auth bypass active — accepting any Bearer token as dev-user', 'AuthGuard');
      request.user = { id: 'dev-user', email: 'dev@local', role: 'admin', tenantId: '00000000-0000-0000-0000-000000000001' };
      return true;
    }

    try {
      if (!this.jwks) {
        this.jwks = jose.createRemoteJWKSet(new URL(`${issuerUrl}/.well-known/jwks.json`));
      }

      const audience = this.configService.get('OIDC_CLIENT_ID');
      const { payload } = await jose.jwtVerify(token, this.jwks, {
        issuer: issuerUrl,
        ...(audience ? { audience } : {}),
      });

      request.user = {
        id: payload.sub ?? '',
        email: (payload['email'] as string) ?? '',
        role: (payload['role'] as string) || (payload['roles'] as string) || 'viewer',
        tenantId: (payload['tenant_id'] as string) || (payload['tenantId'] as string),
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        throw new UnauthorizedException('Invalid token signature');
      }
      if (error instanceof jose.errors.JWTExpired) {
        throw new UnauthorizedException('Token expired');
      }
      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        throw new UnauthorizedException('Token validation failed');
      }
      throw new UnauthorizedException('Token validation failed');
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
