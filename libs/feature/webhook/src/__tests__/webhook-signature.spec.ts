import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { WebhookSignatureService } from '../webhook-signature.service';

describe('WebhookSignatureService', () => {
  const service = new WebhookSignatureService();
  const secret = 'test-webhook-secret';
  const payload = '{"action":"push"}';

  describe('verifyGitHub', () => {
    it('accepts valid GitHub signature', () => {
      const sig = `sha256=${  createHmac('sha256', secret).update(payload).digest('hex')}`;
      expect(() => service.verifyGitHub(payload, sig, secret)).not.toThrow();
    });

    it('throws on missing signature header', () => {
      expect(() => service.verifyGitHub(payload, undefined, secret)).toThrow('Missing x-hub-signature-256');
    });

    it('throws on invalid signature', () => {
      expect(() => service.verifyGitHub(payload, 'sha256=invalid', secret)).toThrow('Invalid webhook signature');
    });

    it('throws on wrong payload', () => {
      const sig = `sha256=${  createHmac('sha256', secret).update('other').digest('hex')}`;
      expect(() => service.verifyGitHub(payload, sig, secret)).toThrow('Invalid webhook signature');
    });
  });

  describe('verifyGitLab', () => {
    it('accepts valid GitLab token', () => {
      expect(() => service.verifyGitLab(secret, secret)).not.toThrow();
    });

    it('throws on missing token header', () => {
      expect(() => service.verifyGitLab(undefined, secret)).toThrow('Missing X-Gitlab-Token');
    });

    it('throws on wrong token', () => {
      expect(() => service.verifyGitLab('wrong', secret)).toThrow('Invalid webhook token');
    });
  });

  describe('verifyJira', () => {
    it('accepts valid Jira signature', () => {
      const sig = createHmac('sha256', secret).update(payload).digest('hex');
      expect(() => service.verifyJira(payload, sig, secret)).not.toThrow();
    });

    it('throws on missing signature', () => {
      expect(() => service.verifyJira(payload, undefined, secret)).toThrow('Missing x-atlassian-webhook-signature');
    });

    it('throws on invalid signature', () => {
      expect(() => service.verifyJira(payload, 'bad', secret)).toThrow('Invalid Jira webhook signature');
    });
  });

  describe('verifyLinear', () => {
    it('accepts valid Linear signature', () => {
      const sig = createHmac('sha256', secret).update(payload).digest('hex');
      expect(() => service.verifyLinear(payload, sig, secret)).not.toThrow();
    });

    it('throws on missing signature', () => {
      expect(() => service.verifyLinear(payload, undefined, secret)).toThrow('Missing Linear-Signature');
    });

    it('throws on invalid signature', () => {
      expect(() => service.verifyLinear(payload, 'bad', secret)).toThrow('Invalid Linear webhook signature');
    });
  });
});
