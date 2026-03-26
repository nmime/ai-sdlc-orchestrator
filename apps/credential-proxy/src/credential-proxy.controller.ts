import { Controller, Post, Get, Param, Body, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { CredentialProxyService } from './credential-proxy.service';
import { SessionService } from './session.service';

@Controller()
export class CredentialProxyController {
  constructor(
    private readonly credentialService: CredentialProxyService,
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
  ) {}

  @Post('sessions')
  async createSession(
    @Headers('x-internal-token') internalToken: string,
    @Body() body: { tenantId: string; workflowId: string; sessionId: string; ttlSeconds?: number },
  ) {
    this.requireInternalToken(internalToken);
    return this.sessionService.create(body.tenantId, body.workflowId, body.sessionId, body.ttlSeconds);
  }

  @Post('sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Headers('x-internal-token') internalToken: string,
    @Param('sessionId') sessionId: string,
  ) {
    this.requireInternalToken(internalToken);
    this.sessionService.revoke(sessionId);
  }

  @Post('git-credential')
  async getGitCredential(
    @Headers('authorization') auth: string,
    @Body() body: { host: string },
  ) {
    const session = this.validateSession(auth);
    return this.credentialService.getGitCredential(session.tenantId, body.host);
  }

  @Get('mcp-token/:serverName')
  async getMcpToken(
    @Headers('authorization') auth: string,
    @Param('serverName') serverName: string,
  ) {
    const session = this.validateSession(auth);
    return this.credentialService.getMcpToken(session.tenantId, serverName);
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('internal/sessions/:sessionId/cost')
  async recordSessionCost(
    @Headers('x-internal-token') internalToken: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { inputTokens: number; outputTokens: number; provider: string; model: string },
  ) {
    this.requireInternalToken(internalToken);
    return { recorded: true, sessionId };
  }

  private requireInternalToken(token: string): void {
    const expected = this.config.get<string>('CREDENTIAL_PROXY_INTERNAL_TOKEN');
    if (!expected || !token) {
      throw new UnauthorizedException('Invalid or missing internal token');
    }
    const bufExpected = Buffer.from(expected);
    const bufActual = Buffer.from(token);
    if (bufExpected.length !== bufActual.length || !timingSafeEqual(bufExpected, bufActual)) {
      throw new UnauthorizedException('Invalid or missing internal token');
    }
  }

  private validateSession(auth: string): { tenantId: string; workflowId: string; sessionId: string } {
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing session token');
    }
    const token = auth.slice(7);
    const session = this.sessionService.validate(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session token');
    }
    return session;
  }
}
