import { WebhookDeliveryController } from '../webhook-delivery.controller';

const mockEm = {
  find: vi.fn(),
  findOneOrFail: vi.fn(),
  findAndCount: vi.fn(),
};

describe('WebhookDeliveryController (integration)', () => {
  let controller: WebhookDeliveryController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new WebhookDeliveryController(mockEm as any);
  });

  describe('GET /', () => {
    it('returns paginated deliveries', async () => {
      mockEm.findAndCount.mockResolvedValue([[{ id: 'd-1' }], 1]);
      const result = await controller.list('t-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('applies status and platform filters', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);
      await controller.list('t-1', '10', '0', 'processed', 'github');
      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { tenant: 't-1', status: 'processed', platform: 'github' },
        expect.anything(),
      );
    });
  });

  describe('GET /:id', () => {
    it('returns delivery by id', async () => {
      mockEm.findOneOrFail.mockResolvedValue({ id: 'd-1', platform: 'github' });
      const result = await controller.findById('t-1', 'd-1');
      expect(result.id).toBe('d-1');
    });

    it('throws when not found', async () => {
      mockEm.findOneOrFail.mockRejectedValue(new Error('not found'));
      await expect(controller.findById('t-1', 'missing')).rejects.toThrow();
    });
  });
});
