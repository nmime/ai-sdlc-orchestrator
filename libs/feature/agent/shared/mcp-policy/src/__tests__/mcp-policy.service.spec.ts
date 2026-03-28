import { McpPolicyService } from '../mcp-policy.service';
import { McpServerPolicy } from '@app/db';

const mockEm = {
  find: vi.fn(),
};

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('McpPolicyService', () => {
  let service: McpPolicyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new McpPolicyService(mockEm, mockLogger);
  });

  it('returns all enabled servers for OPEN policy', async () => {
    mockEm.find.mockResolvedValue([
      { name: 'server-a', transport: 'stdio', url: undefined, command: '/bin/a', args: null },
      { name: 'server-b', transport: 'sse', url: 'http://b.local', command: undefined, args: ['--port', '3000'] },
    ]);

    const result = await service.filterServers('tenant-1', McpServerPolicy.OPEN);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('server-a');
    expect(result[1].url).toBe('http://b.local');
  });

  it('filters to verified servers for CURATED policy', async () => {
    mockEm.find
      .mockResolvedValueOnce([
        { name: 'verified-server', transport: 'stdio', command: '/bin/v', args: null },
        { name: 'unverified-server', transport: 'sse', url: 'http://u.local', args: null },
      ])
      .mockResolvedValueOnce([
        { name: 'verified-server', isVerified: true },
      ]);

    const result = await service.filterServers('tenant-1', McpServerPolicy.CURATED);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('verified-server');
  });

  it('logs warning for filtered-out servers', async () => {
    mockEm.find
      .mockResolvedValueOnce([
        { name: 'unverified', transport: 'stdio', command: '/bin/u', args: null },
      ])
      .mockResolvedValueOnce([]);

    await service.filterServers('tenant-1', McpServerPolicy.CURATED);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('filtered out'));
  });

  it('returns empty array when no servers enabled', async () => {
    mockEm.find.mockResolvedValue([]);
    const result = await service.filterServers('tenant-1', McpServerPolicy.OPEN);
    expect(result).toEqual([]);
  });

  it('maps server fields correctly', async () => {
    mockEm.find.mockResolvedValue([
      { name: 'test', transport: 'streamable_http', url: 'http://test.com', command: undefined, args: ['--flag'] },
    ]);
    const result = await service.filterServers('tenant-1', McpServerPolicy.OPEN);
    expect(result[0]).toEqual({
      name: 'test',
      transport: 'streamable_http',
      url: 'http://test.com',
      command: undefined,
      args: ['--flag'],
    });
  });
});
