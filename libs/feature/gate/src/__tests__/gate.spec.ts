import { GateService } from '../gate.service';

const mockSignal = vi.fn();
const mockDescribe = vi.fn();
const mockCancel = vi.fn();
const mockGetHandle = vi.fn().mockReturnValue({
  signal: mockSignal,
  describe: mockDescribe,
  cancel: mockCancel,
});

const mockTemporalClient = {
  getClient: vi.fn().mockResolvedValue({
    workflow: { getHandle: mockGetHandle },
  }),
};

const mockLogger = {
  setContext: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
};

describe('GateService', () => {
  let service: GateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GateService(mockTemporalClient as any, mockLogger as any);
  });

  it('should submit an approve decision', async () => {
    mockSignal.mockResolvedValue(undefined);

    const result = await service.submitDecision('wf-123', 'approve', 'reviewer@test.com', 'Looks good');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.action).toBe('approve');
      expect(result.value.reviewer).toBe('reviewer@test.com');
      expect(result.value.comment).toBe('Looks good');
    }
    expect(mockSignal).toHaveBeenCalledWith('gateDecision', expect.objectContaining({ action: 'approve' }));
  });

  it('should submit a reject decision', async () => {
    mockSignal.mockResolvedValue(undefined);

    const result = await service.submitDecision('wf-456', 'reject', 'admin@test.com', 'Needs fixes');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.action).toBe('reject');
    }
  });

  it('should handle Temporal error on decision', async () => {
    mockSignal.mockRejectedValue(new Error('Workflow not found'));

    const result = await service.submitDecision('wf-bad', 'approve', 'reviewer@test.com');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('TEMPORAL_ERROR');
      expect(result.error.message).toContain('Workflow not found');
    }
  });

  it('should get workflow status', async () => {
    mockDescribe.mockResolvedValue({ status: { name: 'RUNNING' }, runId: 'run-123' });

    const result = await service.getWorkflowStatus('wf-123');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe('RUNNING');
      expect(result.value.runId).toBe('run-123');
    }
  });

  it('should cancel a workflow', async () => {
    mockCancel.mockResolvedValue(undefined);

    const result = await service.cancelWorkflow('wf-123', 'Manual cancellation');

    expect(result.isOk()).toBe(true);
    expect(mockCancel).toHaveBeenCalled();
  });

  it('should handle cancel error', async () => {
    mockCancel.mockRejectedValue(new Error('Already completed'));

    const result = await service.cancelWorkflow('wf-done', 'Too late');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('TEMPORAL_ERROR');
    }
  });
});
