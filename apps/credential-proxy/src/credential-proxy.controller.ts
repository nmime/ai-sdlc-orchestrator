import {
  Controller, Post, Get, Param, Body, Headers, Req, Res,
  HttpCode, HttpStatus, UnauthorizedException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { CredentialProxyService } from './credential-proxy.service';
import { SessionService } from './session.service';
import { RateLimiterService } from './rate-limiter.service';
import { AuditService } from './audit.service';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Controller()
export class CredentialProxyController {
  constructor(
    private readonly credentialService: CredentialProxyService,
    private readonly sessionService: SessionService,
    private readonly rateLimiter: RateLimiterService,
    private readonly audit: AuditService,
  ) {}

  @Post('sessions')
  createSession(
    @Headers('x-internal-token') internalToken: string,
    @Body() body: { tenantId: string; workflowId: string; sessionId: string; ttlSeconds?: number; scopes?: string[] },
  ) {
    const expected = process.env['CREDENTIAL_PROXY_INTERNAL_TOKEN'];
    if (expected && internalToken !== expected) throw new UnauthorizedException('Invalid internal token');
    if (!body.tenantId || !body.sessionId) throw new BadRequestException('tenantId and sessionId required');
    return this.sessionService.create(body.tenantId, body.workflowId, body.sessionId, body.ttlSeconds, body.scopes);
  }

  @Post('sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(@Param('sessionId') sessionId: string) {
    this.sessionService.revoke(sessionId);
  }

  @Post('git-credential')
  async getGitCredential(
    @Headers('authorization') auth: string,
    @Body() body: { host: string },
  ) {
    const session = this.requireSession(auth, 'git');
    this.requireRateLimit(session.sessionId);

    const result = await this.credentialService.getGitCredential(session.tenantId, body.host);
    this.audit.log({
      timestamp: new Date().toISOString(),
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      action: 'git-credential',
      resource: body.host,
      status: 'success',
    });
    return result;
  }

  @Get('mcp-token/:serverName')
  async getMcpToken(
    @Headers('authorization') auth: string,
    @Param('serverName') serverName: string,
  ) {
    const session = this.requireSession(auth, 'mcp');
    this.requireRateLimit(session.sessionId);

    const result = await this.credentialService.getMcpToken(session.tenantId, serverName);
    this.audit.log({
      timestamp: new Date().toISOString(),
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      action: 'mcp-token',
      resource: serverName,
      status: 'success',
    });
    return result;
  }

  @Post('ai-api/:provider/*')
  async proxyAiApi(
    @Headers('authorization') auth: string,
    @Param('provider') provider: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const session = this.requireSession(auth, 'ai-api');
    this.requireRateLimit(session.sessionId);

    const url = request.url;
    const pathAfterProvider = url.replace(`/ai-api/${provider}`, '');
    const body = request.body;
    const headers = request.headers as Record<string, string>;

    try {
      const upstream = await this.credentialService.proxyAiRequest(provider, pathAfterProvider, body, headers);

      const contentType = upstream.headers.get('content-type') || 'application/json';

      if (contentType.includes('text/event-stream')) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const reader = upstream.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const chunk = await reader.read();
            done = chunk.done;
            if (chunk.value) {
              reply.raw.write(decoder.decode(chunk.value, { stream: true }));
            }
          }
        }
        reply.raw.end();
      } else {
        const responseBody = await upstream.text();
        reply.status(upstream.status).header('content-type', contentType).send(responseBody);
      }

      this.audit.log({
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        action: 'ai-api-proxy',
        resource: `${provider}${pathAfterProvider}`,
        status: 'success',
        metadata: { upstreamStatus: upstream.status },
      });
    } catch (error) {
      this.audit.log({
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        action: 'ai-api-proxy',
        resource: `${provider}${pathAfterProvider}`,
        status: 'error',
        metadata: { error: (error as Error).message },
      });
      throw error;
    }
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }

  @Get('readyz')
  readyz() {
    return { status: 'ready', activeSessions: this.sessionService.getActiveCount() };
  }

  @Get('health/business')
  healthBusiness() {
    return {
      status: 'ok',
      activeSessions: this.sessionService.getActiveCount(),
      recentAuditEntries: this.audit.getRecent(10).length,
    };
  }

  @Post('internal/sessions/:sessionId/cost')
  recordSessionCost(
    @Param('sessionId') sessionId: string,
    @Body() body: { inputTokens: number; outputTokens: number; provider: string; model: string },
  ) {
    this.audit.log({
      timestamp: new Date().toISOString(),
      sessionId,
      tenantId: 'system',
      action: 'record-cost',
      resource: body.provider,
      status: 'success',
      metadata: {
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        provider: body.provider,
        model: body.model,
      },
    });
    return {
      recorded: true,
      sessionId,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      provider: body.provider,
      model: body.model,
    };
  }

  private requireSession(auth: string, scope: string): { tenantId: string; workflowId: string; sessionId: string } {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing session token');
    const token = auth.slice(7);
    const session = this.sessionService.validate(token);
    if (!session) throw new UnauthorizedException('Invalid or expired session token');
    if (!this.sessionService.hasScope(token, scope)) {
      throw new ForbiddenException(`Session does not have '${scope}' scope`);
    }
    return session;
  }

  private requireRateLimit(sessionId: string): void {
    const result = this.rateLimiter.check(sessionId);
    if (!result.allowed) {
      throw new ForbiddenException('Rate limit exceeded');
    }
  }
}
