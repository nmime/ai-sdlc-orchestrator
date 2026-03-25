import { createMockEm, createMockLogger } from '../../../../common/src/__tests__/test-utils';
import { TenantMcpServerService } from '../tenant-mcp-server.service';
import { TenantVcsCredentialService } from '../tenant-vcs-credential.service';
import { TenantRepoConfigService } from '../tenant-repo-config.service';
import { TenantWebhookConfigService } from '../tenant-webhook-config.service';

describe('TenantMcpServerService', () => {
  let service: TenantMcpServerService;
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    mockEm = createMockEm();
    service = new TenantMcpServerService(mockEm as any, createMockLogger() as any);
  });

  it('creates MCP server', async () => {
    mockEm.findOne.mockResolvedValue(null);
    const result = await service.create('t-1', { name: 'test-mcp', transport: 'stdio' as any });
    expect(result.isOk()).toBe(true);
    expect(mockEm.persistAndFlush).toHaveBeenCalled();
  });

  it('rejects duplicate name', async () => {
    mockEm.findOne.mockResolvedValue({ name: 'test-mcp' });
    const result = await service.create('t-1', { name: 'test-mcp', transport: 'stdio' as any });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('CONFLICT');
  });

  it('lists servers for tenant', async () => {
    mockEm.find.mockResolvedValue([{ id: '1', name: 'srv' }]);
    const result = await service.list('t-1');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toHaveLength(1);
  });

  it('finds by id', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1', name: 'srv' });
    const result = await service.findById('t-1', '1');
    expect(result.isOk()).toBe(true);
  });

  it('returns NOT_FOUND for missing', async () => {
    mockEm.findOne.mockResolvedValue(null);
    const result = await service.findById('t-1', 'missing');
    expect(result.isErr()).toBe(true);
  });

  it('updates server', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1', name: 'old', transport: 'stdio' });
    const result = await service.update('t-1', '1', { name: 'new-name' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.name).toBe('new-name');
  });

  it('deletes server', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1' });
    const result = await service.delete('t-1', '1');
    expect(result.isOk()).toBe(true);
    expect(mockEm.removeAndFlush).toHaveBeenCalled();
  });
});

describe('TenantVcsCredentialService', () => {
  let service: TenantVcsCredentialService;
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    mockEm = createMockEm();
    service = new TenantVcsCredentialService(mockEm as any, createMockLogger() as any);
  });

  it('creates credential', async () => {
    const result = await service.create('t-1', { provider: 'github' as any, host: 'github.com', secretRef: 'ref-1' });
    expect(result.isOk()).toBe(true);
    expect(mockEm.persistAndFlush).toHaveBeenCalled();
  });

  it('lists credentials', async () => {
    mockEm.find.mockResolvedValue([{ id: '1' }]);
    const result = await service.list('t-1');
    expect(result.isOk()).toBe(true);
  });

  it('returns NOT_FOUND', async () => {
    mockEm.findOne.mockResolvedValue(null);
    const result = await service.findById('t-1', 'missing');
    expect(result.isErr()).toBe(true);
  });

  it('updates credential', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1', host: 'old.com', secretRef: 'old-ref' });
    const result = await service.update('t-1', '1', { host: 'new.com' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.host).toBe('new.com');
  });

  it('deletes credential', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1' });
    const result = await service.delete('t-1', '1');
    expect(result.isOk()).toBe(true);
  });
});

describe('TenantRepoConfigService', () => {
  let service: TenantRepoConfigService;
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    mockEm = createMockEm();
    service = new TenantRepoConfigService(mockEm as any, createMockLogger() as any);
  });

  it('creates repo config', async () => {
    mockEm.findOne.mockResolvedValue(null);
    const result = await service.create('t-1', { repoId: 'org/repo', repoUrl: 'https://github.com/org/repo' });
    expect(result.isOk()).toBe(true);
  });

  it('rejects duplicate repoId', async () => {
    mockEm.findOne.mockResolvedValue({ repoId: 'org/repo' });
    const result = await service.create('t-1', { repoId: 'org/repo', repoUrl: 'url' });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('CONFLICT');
  });

  it('finds by repoId', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1', repoId: 'org/repo' });
    const result = await service.findByRepoId('t-1', 'org/repo');
    expect(result.isOk()).toBe(true);
  });

  it('updates config with applyDto', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1', repoId: 'org/repo', maxDiffLines: 100 });
    const result = await service.update('t-1', '1', { maxDiffLines: 500 });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.maxDiffLines).toBe(500);
  });

  it('deletes config', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1' });
    const result = await service.delete('t-1', '1');
    expect(result.isOk()).toBe(true);
  });
});

describe('TenantWebhookConfigService', () => {
  let service: TenantWebhookConfigService;
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    mockEm = createMockEm();
    service = new TenantWebhookConfigService(mockEm as any, createMockLogger() as any);
  });

  it('creates webhook config', async () => {
    const result = await service.create('t-1', { platform: 'github' as any });
    expect(result.isOk()).toBe(true);
    expect(mockEm.persistAndFlush).toHaveBeenCalled();
  });

  it('lists configs', async () => {
    mockEm.find.mockResolvedValue([{ id: '1' }]);
    const result = await service.list('t-1');
    expect(result.isOk()).toBe(true);
  });

  it('returns NOT_FOUND', async () => {
    mockEm.findOne.mockResolvedValue(null);
    const result = await service.findById('t-1', 'missing');
    expect(result.isErr()).toBe(true);
  });

  it('updates config', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1', webhookUrl: 'old', status: 'active' });
    const result = await service.update('t-1', '1', { webhookUrl: 'new-url' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.webhookUrl).toBe('new-url');
  });

  it('deletes config', async () => {
    mockEm.findOne.mockResolvedValue({ id: '1' });
    const result = await service.delete('t-1', '1');
    expect(result.isOk()).toBe(true);
  });
});
