import { TemporalClientService } from '../temporal.module';

const mockClose = vi.hoisted(() => vi.fn());
const mockClient = vi.hoisted(() => ({ workflow: {} }));

vi.mock('@temporalio/client', () => ({
  Connection: {
    connect: vi.fn().mockResolvedValue({ close: mockClose }),
  },
  Client: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
}));

describe('TemporalClientService', () => {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'TEMPORAL_ADDRESS') return 'localhost:7233';
      if (key === 'TEMPORAL_NAMESPACE') return 'default';
      return undefined;
    }),
  } as any;

  it('should lazily create and cache the client', async () => {
    const service = new TemporalClientService(configService);
    const client1 = await service.getClient();
    const client2 = await service.getClient();
    expect(client1).toBe(client2);
    expect(client1).toBe(mockClient);
  });

  it('should close connection on module destroy', async () => {
    const service = new TemporalClientService(configService);
    await service.getClient();
    await service.onModuleDestroy();
    expect(mockClose).toHaveBeenCalled();
  });
});
