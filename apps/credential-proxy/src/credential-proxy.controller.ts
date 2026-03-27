import { Controller, Post, Get, Param, Body, Headers, HttpCode, HttpStatus, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { CredentialProxyService } from './credential-proxy.service';
import { SessionService } from './session.service';
import { CreateSessionDto, ResolveHostDto, RecordCostDto } from '@ai-sdlc/common';

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
    @Body() body: CreateSessionDto,
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
    this.validateSessionIdFormat(sessionId);
    await this.sessionService.revoke(sessionId);
  }

  @Post('git-credential')
  async getGitCredential(
    @Headers('authorization') auth: string,
    @Body() body: ResolveHostDto,
  ) {
    const session = await this.validateSession(auth);
    return this.credentialService.getGitCredential(session.tenantId, body.host);
  }

  @Get('mcp-token/:serverName')
  async getMcpToken(
    @Headers('authorization') auth: string,
    @Param('serverName') serverName: string,
  ) {
    const session = await this.validateSession(auth);
    if (!/^[a-zA-Z0-9_-]+$/.test(serverName)) {
      throw new UnauthorizedException('Invalid server name');
    }
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
    @Body() body: RecordCostDto,
  ) {
    this.requireInternalToken(internalToken);
    this.validateSessionIdFormat(sessionId);
    return { recorded: true, sessionId };
  }

  private validateSessionIdFormat(sessionId: string): void {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) {
      throw new BadRequestException('Invalid sessionId format');
    }
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

  private async validateSession(auth: string): Promise<{ tenantId: string; workflowId: string; sessionId: string }> {
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing session token');
    }
    const token = auth.slice(7);
    const session = await this.sessionService.validate(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session token');
    }
    return session;
  }
}
