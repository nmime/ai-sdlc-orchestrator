import { WebhookController } from '../webhook.controller';
import { ok, err } from 'neverthrow';

const mockWebhookService = {
  processWebhook: vi.fn(),
  getWebhookSecret: vi.fn().mockResolvedValue('test-secret'),
};

const mockSignatureService = {
  verifyGitHub: vi.fn(),
  verifyGitLab: vi.fn(),
  verifyJira: vi.fn(),
  verifyLinear: vi.fn(),
};

const mockReq = { rawBody: '' };

describe('WebhookController (integration)', () => {
  let controller: WebhookController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new WebhookController(mockWebhookService, mockSignatureService);
  });

  it('returns accepted response on valid webhook', async () => {
    mockWebhookService.processWebhook.mockResolvedValue(
      ok({ accepted: true, deliveryId: 'del-1' }),
    );
    const result = await controller.handleWebhook(
      'github', 't-1',
      { 'x-github-event': 'issues' },
      { action: 'labeled', issue: { number: 1 } },
      mockReq as any,
    );
    expect(result).toEqual({ accepted: true, deliveryId: 'del-1' });
  });

  it('throws on service error', async () => {
    mockWebhookService.processWebhook.mockResolvedValue(
      err({ code: 'WEBHOOK_ERROR', message: 'unsupported platform' }),
    );
    await expect(controller.handleWebhook('unknown', 't-1', {}, {}, mockReq as any)).rejects.toThrow('unsupported platform');
  });

  it('passes all platforms through', async () => {
    for (const platform of ['github', 'gitlab', 'jira', 'linear']) {
      mockWebhookService.processWebhook.mockResolvedValue(ok({ accepted: true, deliveryId: `del-${platform}` }));
      const result = await controller.handleWebhook(platform, 't-1', {}, {}, mockReq as any);
      expect(result.accepted).toBe(true);
    }
    expect(mockWebhookService.processWebhook).toHaveBeenCalledTimes(4);
  });

  it('forwards full headers object', async () => {
    mockWebhookService.processWebhook.mockResolvedValue(ok({ accepted: true, deliveryId: 'del-1' }));
    const headers = { 'x-hub-signature-256': 'sha256=abc', 'content-type': 'application/json' };
    await controller.handleWebhook('github', 't-1', headers, {}, mockReq as any);
    expect(mockWebhookService.processWebhook).toHaveBeenCalledWith('github', 't-1', headers, {});
  });
});
