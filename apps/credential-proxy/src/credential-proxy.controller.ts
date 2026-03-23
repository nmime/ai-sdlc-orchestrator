import { Controller, Post, Get, Param, Body, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { CredentialProxyService } from './credential-proxy.service';
import { SessionService } from './session.service';

@Controller()
export class CredentialProxyController {
  constructor(
    private readonly credentialService: CredentialProxyService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('sessions')
  async createSession(@Body() body: { tenantId: string; workflowId: string; sessionId: string; ttlSeconds?: number }) {
    return this.sessionService.create(body.tenantId, body.workflowId, body.sessionId, body.ttlSeconds);
  }

  @Post('sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@Param('sessionId') sessionId: string) {
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
    @Param('sessionId') sessionId: string,
    @Body() body: { inputTokens: number; outputTokens: number; provider: string; model: string },
  ) {
    return { recorded: true, sessionId };
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
