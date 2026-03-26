import { CredentialProxyController } from '../credential-proxy.controller';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';

const mockCredService = {
  getGitCredential: vi.fn().mockResolvedValue({ username: 'x-access-token', password: 'ghp_test' }),
  getMcpToken: vi.fn().mockResolvedValue({ token: 'mcp-tok' }),
  proxyAiRequest: vi.fn(),
};

const mockSessionService = {
  create: vi.fn().mockReturnValue({ token: 'tok-1', expiresAt: new Date() }),
  validate: vi.fn(),
  hasScope: vi.fn(),
  revoke: vi.fn(),
  getActiveCount: vi.fn().mockReturnValue(5),
};

const mockRateLimiter = {
  check: vi.fn().mockReturnValue({ allowed: true, remaining: 99 }),
};

const mockAudit = {
  log: vi.fn(),
  getRecent: vi.fn().mockReturnValue([]),
};

describe('CredentialProxyController (integration)', () => {
  let controller: CredentialProxyController;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimiter.check.mockReturnValue({ allowed: true, remaining: 99 });
    controller = new CredentialProxyController(
      mockCredService,
      mockSessionService,
      mockRateLimiter,
      mockAudit,
    );
  });

  describe('POST /sessions', () => {
    it('creates session', () => {
      const result = controller.createSession(undefined, { tenantId: 't-1', workflowId: 'wf-1', sessionId: 's-1' });
      expect(result.token).toBe('tok-1');
    });

    it('throws BadRequest when missing tenantId', () => {
      expect(() => controller.createSession(undefined, { tenantId: '', workflowId: 'wf-1', sessionId: 's-1' }))
        .toThrow(BadRequestException);
    });
  });

  describe('POST /sessions/:id/revoke', () => {
    it('revokes session', () => {
      controller.revokeSession(undefined, 's-1');
      expect(mockSessionService.revoke).toHaveBeenCalledWith('s-1');
    });
  });

  describe('POST /git-credential', () => {
    it('returns credential with valid session', async () => {
      mockSessionService.validate.mockReturnValue({ tenantId: 't-1', workflowId: 'wf-1', sessionId: 's-1' });
      mockSessionService.hasScope.mockReturnValue(true);
      const result = await controller.getGitCredential('Bearer tok-1', { host: 'github.com' });
      expect(result).toEqual({ username: 'x-access-token', password: 'ghp_test' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'git-credential' }));
    });

    it('throws Unauthorized without token', async () => {
      await expect(controller.getGitCredential('', { host: 'github.com' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized with invalid token', async () => {
      mockSessionService.validate.mockReturnValue(null);
      await expect(controller.getGitCredential('Bearer bad-tok', { host: 'github.com' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws Forbidden when scope missing', async () => {
      mockSessionService.validate.mockReturnValue({ tenantId: 't-1', workflowId: 'wf-1', sessionId: 's-1' });
      mockSessionService.hasScope.mockReturnValue(false);
      await expect(controller.getGitCredential('Bearer tok-1', { host: 'github.com' })).rejects.toThrow(ForbiddenException);
    });

    it('throws Forbidden when rate limited', async () => {
      mockSessionService.validate.mockReturnValue({ tenantId: 't-1', workflowId: 'wf-1', sessionId: 's-1' });
      mockSessionService.hasScope.mockReturnValue(true);
      mockRateLimiter.check.mockReturnValue({ allowed: false, remaining: 0 });
      await expect(controller.getGitCredential('Bearer tok-1', { host: 'github.com' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /mcp-token/:serverName', () => {
    it('returns token with valid session', async () => {
      mockSessionService.validate.mockReturnValue({ tenantId: 't-1', workflowId: 'wf-1', sessionId: 's-1' });
      mockSessionService.hasScope.mockReturnValue(true);
      const result = await controller.getMcpToken('Bearer tok-1', 'my-mcp');
      expect(result).toEqual({ token: 'mcp-tok' });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp-token' }));
    });
  });

  describe('Health endpoints', () => {
    it('GET /health returns ok', () => {
      const result = controller.health();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('GET /healthz returns ok', () => {
      expect(controller.healthz()).toEqual({ status: 'ok' });
    });

    it('GET /readyz returns active sessions', () => {
      const result = controller.readyz();
      expect(result.status).toBe('ready');
      expect(result.activeSessions).toBe(5);
    });

    it('GET /health/business returns composite', () => {
      const result = controller.healthBusiness();
      expect(result.status).toBe('ok');
      expect(result.activeSessions).toBe(5);
    });
  });

  describe('POST /internal/sessions/:id/cost', () => {
    it('records cost', () => {
      const result = controller.recordSessionCost(undefined, 's-1', {
        inputTokens: 1000, outputTokens: 500, provider: 'anthropic', model: 'claude-sonnet-4-20250514',
      });
      expect(result).toMatchObject({ recorded: true, sessionId: 's-1' });
    });
  });
});
