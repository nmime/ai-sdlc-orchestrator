import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification.service';

function createMockLogger() {
  return { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    service = new NotificationService(logger);
  });

  describe('sendAlert', () => {
    it('sends webhook alert to external URL', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }));
      await service.sendAlert(
        { alertType: 'threshold', thresholdPct: 80, actualUsd: 400, limitUsd: 500 } as any,
        [{ type: 'webhook', url: 'https://hooks.slack.com/xxx' }],
      );
      expect(fetchSpy).toHaveBeenCalledWith('https://hooks.slack.com/xxx', expect.objectContaining({ method: 'POST' }));
      vi.restoreAllMocks();
    });

    it('blocks internal URLs', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      await service.sendAlert(
        { alertType: 'threshold', thresholdPct: 80, actualUsd: 400, limitUsd: 500 } as any,
        [{ type: 'webhook', url: 'http://localhost:3000/hook' }],
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked internal URL'));
      vi.restoreAllMocks();
    });

    it('handles fetch errors gracefully', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));
      await service.sendAlert(
        { alertType: 'threshold', thresholdPct: 80, actualUsd: 400, limitUsd: 500 } as any,
        [{ type: 'webhook', url: 'https://external.com/hook' }],
      );
      expect(logger.error).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('skips email channels (not implemented)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      await service.sendAlert(
        { alertType: 'threshold', thresholdPct: 80, actualUsd: 400, limitUsd: 500 } as any,
        [{ type: 'email', address: 'test@test.com' }],
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  describe('sendWorkflowNotification', () => {
    it('sends workflow notification to external webhook', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('ok'));
      await service.sendWorkflowNotification(
        'completed', 'wf-1',
        [{ type: 'webhook', url: 'https://hook.com/wf' }],
        { branch: 'main' },
      );
      expect(fetchSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('blocks internal URLs in workflow notifications', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      await service.sendWorkflowNotification(
        'completed', 'wf-1',
        [{ type: 'webhook', url: 'http://10.0.0.1/hook' }],
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
