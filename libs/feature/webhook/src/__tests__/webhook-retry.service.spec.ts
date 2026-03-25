import { WebhookRetryService } from '../webhook-retry.service';
import { DeliveryStatus } from '@app/db';

const mockFork = {
  find: vi.fn(),
  flush: vi.fn(),
};

const mockEm = {
  fork: vi.fn().mockReturnValue(mockFork),
};

const mockTemporal = {
  getClient: vi.fn().mockResolvedValue({
    workflow: { start: vi.fn() },
  }),
};

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('WebhookRetryService', () => {
  let service: WebhookRetryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookRetryService(mockEm, mockLogger, mockTemporal);
  });

  it('retries failed deliveries', async () => {
    mockFork.find.mockResolvedValue([
      { id: 'del-1', tenant: { id: 'tenant-1' }, deliveryId: 'dh-1', platform: 'github', status: DeliveryStatus.FAILED },
    ]);

    await service.retryFailed();
    expect(mockTemporal.getClient).toHaveBeenCalled();
    expect(mockFork.flush).toHaveBeenCalled();
  });

  it('handles empty failed list', async () => {
    mockFork.find.mockResolvedValue([]);
    await service.retryFailed();
    expect(mockFork.flush).toHaveBeenCalled();
  });

  it('handles retry errors gracefully', async () => {
    mockFork.find.mockResolvedValue([
      { id: 'del-1', tenant: { id: 'tenant-1' }, deliveryId: 'dh-1', platform: 'github', status: DeliveryStatus.FAILED },
    ]);
    mockTemporal.getClient.mockRejectedValue(new Error('Temporal down'));

    await service.retryFailed();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('sets up interval on module init', () => {
    const spy = vi.spyOn(global, 'setInterval');
    service.onModuleInit();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    service.onModuleDestroy();
    spy.mockRestore();
  });
});
