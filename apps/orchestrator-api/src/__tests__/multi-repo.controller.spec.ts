import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiRepoController } from '../multi-repo.controller';

function createMockTemporalClient() {
  return {
    getClient: vi.fn().mockResolvedValue({
      workflow: {
        start: vi.fn().mockResolvedValue({ workflowId: 'wf-1', firstExecutionRunId: 'run-1' }),
      },
    }),
  } as any;
}

describe('MultiRepoController', () => {
  let controller: MultiRepoController;
  let mockTemporal: ReturnType<typeof createMockTemporalClient>;
  const mockReq = { user: { tenantId: 't-1', id: 'u-1', role: 'admin' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTemporal = createMockTemporalClient();
    controller = new MultiRepoController(mockTemporal);
  });

  it('starts multi-repo workflow', async () => {
    const result = await controller.startMultiRepo(mockReq, {
      tenantId: 't-1', parentTaskId: 'task-1', taskProvider: 'github',
      repos: [{ repoId: 'r1', repoUrl: 'https://github.com/test/repo', taskId: 'issue-1' }],
    });
    expect(result.workflowId).toBe('multi-repo-task-1');
  });

  it('throws if tenant mismatch', async () => {
    await expect(
      controller.startMultiRepo(mockReq, {
        tenantId: 'other', parentTaskId: 'task-1', taskProvider: 'github', repos: [],
      }),
    ).rejects.toThrow('Cannot start workflows for another tenant');
  });

  it('throws if no tenant context', async () => {
    await expect(
      controller.startMultiRepo({ user: {} } as any, {
        tenantId: 't-1', parentTaskId: 'task-1', taskProvider: 'github', repos: [],
      }),
    ).rejects.toThrow('Tenant context required');
  });
});
