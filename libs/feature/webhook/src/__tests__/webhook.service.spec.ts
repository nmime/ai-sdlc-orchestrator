import { WebhookService } from '../webhook.service';

const mockEm = {
  getReference: vi.fn().mockReturnValue({ id: 'ref' }),
  persistAndFlush: vi.fn(),
  flush: vi.fn(),
  findOne: vi.fn(),
  persist: vi.fn(),
};

const mockTemporal = {
  getClient: vi.fn().mockResolvedValue({
    workflow: {
      start: vi.fn(),
      getHandle: vi.fn(),
    },
  }),
};

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockJiraHandler = { parse: vi.fn() };
const mockGitLabHandler = { parse: vi.fn(), parseCiEvent: vi.fn().mockReturnValue(null), parseReviewEvent: vi.fn().mockReturnValue(null) };
const mockGitHubHandler = { parse: vi.fn(), parseCiEvent: vi.fn().mockReturnValue(null), parseReviewEvent: vi.fn().mockReturnValue(null) };
const mockLinearHandler = { parse: vi.fn() };

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookService(
      mockEm,
      mockTemporal,
      mockLogger,
      mockJiraHandler,
      mockGitLabHandler,
      mockGitHubHandler,
      mockLinearHandler,
    );
  });

  it('rejects unknown platform', async () => {
    const result = await service.processWebhook('bitbucket', 'tenant-1', {}, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
  });

  it('returns accepted when handler returns null (ignored event)', async () => {
    const { ok } = await import('neverthrow');
    mockJiraHandler.parse.mockReturnValue(ok(null));
    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().deliveryId).toBe('ignored');
  });

  it('creates delivery and starts workflow for valid event', async () => {
    const { ok } = await import('neverthrow');
    mockGitHubHandler.parse.mockReturnValue(ok({
      source: 'github',
      eventType: 'issues',
      tenantId: 'tenant-1',
      deliveryId: 'gh-123',
      taskId: '#42',
      taskProvider: 'github',
      repoUrl: 'https://github.com/test/repo.git',
      labels: ['ai-sdlc'],
      rawPayload: {},
    }));
    mockEm.persistAndFlush.mockResolvedValue(undefined);

    const result = await service.processWebhook('github', 'tenant-1', {}, {});
    expect(result.isOk()).toBe(true);
    expect(mockEm.persistAndFlush).toHaveBeenCalled();
  });

  it('handles duplicate webhook delivery gracefully', async () => {
    const { ok } = await import('neverthrow');
    mockJiraHandler.parse.mockReturnValue(ok({
      source: 'jira',
      eventType: 'issue',
      tenantId: 'tenant-1',
      deliveryId: 'jira-dup',
      taskId: 'PROJ-1',
      taskProvider: 'jira',
      repoUrl: 'https://github.com/test/repo.git',
      rawPayload: {},
    }));
    const dupError: Error & { code?: string } = new Error("duplicate");
    dupError.code = '23505';
    mockEm.persistAndFlush.mockRejectedValue(dupError);

    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().deliveryId).toBe('duplicate');
  });

  it('routes GitLab CI signals', async () => {
    mockGitLabHandler.parseCiEvent.mockReturnValue({
      type: 'pipeline_succeeded',
      repoUrl: 'https://gitlab.com/test/repo.git',
      branchName: 'feature/x',
      details: 'Pipeline passed',
      pipelineId: '123',
    });
    mockEm.findOne.mockResolvedValue({
      temporalWorkflowId: 'wf-123',
      tenant: { id: 'tenant-1' },
    });

    const result = await service.processWebhook('gitlab', 'tenant-1', {}, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().deliveryId).toContain('ci-signal');
  });
});
