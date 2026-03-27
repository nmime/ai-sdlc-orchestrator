import { WebhookService } from '../webhook.service';

const mockJiraHandler = {
  parse: vi.fn().mockReturnValue({ isErr: () => false, value: {
    eventType: 'issue_updated',
    deliveryId: 'del-1',
    taskId: 'TASK-1',
    taskProvider: 'jira',
    repoUrl: 'https://github.com/org/repo',
    labels: ['ai-sdlc'],
  }}),
};

const mockGitLabHandler = { parse: vi.fn() };
const mockGitHubHandler = { parse: vi.fn() };
const mockLinearHandler = { parse: vi.fn() };

const mockTenant = { id: 'tenant-1', slug: 'acme' };

function buildService(overrides: Record<string, any> = {}) {
  const delivery = { id: 'wdel-1', status: 'received', workflowId: undefined, errorMessage: undefined };
  const em = {
    findOne: vi.fn().mockResolvedValue(mockTenant),
    getReference: vi.fn().mockReturnValue(mockTenant),
    persistAndFlush: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn(),
    persist: vi.fn(),
    ...overrides,
  } as any;

  const workflowClient = {
    start: vi.fn().mockResolvedValue({ workflowId: 'wf-1' }),
  };
  const temporalClient = {
    getClient: vi.fn().mockResolvedValue({ workflow: workflowClient }),
  } as any;

  const logger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

  const service = new WebhookService(
    em,
    temporalClient,
    logger,
    mockJiraHandler as any,
    mockGitLabHandler as any,
    mockGitHubHandler as any,
    mockLinearHandler as any,
  );

  return { service, em, temporalClient, workflowClient, logger };
}

describe('WebhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return VALIDATION_ERROR for unknown platform', async () => {
    const { service } = buildService();
    const result = await service.processWebhook('bitbucket', 'tenant-1', {}, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
  });

  it('should return VALIDATION_ERROR for unknown tenant', async () => {
    const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
    const result = await service.processWebhook('jira', 'unknown-tenant', {}, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
  });

  it('should return accepted:true with deliveryId=ignored when handler returns null', async () => {
    mockJiraHandler.parse.mockReturnValueOnce({ isErr: () => false, value: null });
    const { service } = buildService();
    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().deliveryId).toBe('ignored');
  });

  it('should process valid jira webhook and start workflow', async () => {
    const { service, workflowClient, em } = buildService();
    const result = await service.processWebhook('jira', 'tenant-1', {}, { issue: {} });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().accepted).toBe(true);
    expect(workflowClient.start).toHaveBeenCalledWith(
      'orchestrateTaskWorkflow',
      expect.objectContaining({
        taskQueue: 'orchestrator-queue',
        args: [expect.objectContaining({ tenantId: 'tenant-1', taskId: 'TASK-1' })],
      }),
    );
  });

  it('should handle duplicate delivery (23505 error)', async () => {
    const { service } = buildService({
      persistAndFlush: vi.fn().mockRejectedValue({ code: '23505' }),
    });
    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().deliveryId).toBe('duplicate');
  });

  it('should return INTERNAL_ERROR on persist failure (non-duplicate)', async () => {
    const { service } = buildService({
      persistAndFlush: vi.fn().mockRejectedValue({ code: '50000' }),
    });
    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('INTERNAL_ERROR');
  });

  it('should return TEMPORAL_ERROR when workflow start fails', async () => {
    const { service, workflowClient } = buildService();
    workflowClient.start.mockRejectedValueOnce(new Error('Temporal unreachable'));
    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('TEMPORAL_ERROR');
  });

  it('should propagate handler parse errors', async () => {
    mockJiraHandler.parse.mockReturnValueOnce({
      isErr: () => true,
      error: { code: 'VALIDATION_ERROR', message: 'bad payload' },
    });
    const { service } = buildService();
    const result = await service.processWebhook('jira', 'tenant-1', {}, {});
    expect(result.isErr()).toBe(true);
  });
});
