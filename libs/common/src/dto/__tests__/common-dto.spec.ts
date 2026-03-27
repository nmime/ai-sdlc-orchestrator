import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  GateDecideDto,
  GateCancelDto,
  WorkflowRetryDto,
  CreateSessionDto,
  ResolveHostDto,
  RecordCostDto,
} from '../common.dto';

async function validateDto<T extends object>(cls: new () => T, plain: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  return errors.map((e) => Object.values(e.constraints || {}).join(', '));
}

describe('GateDecideDto', () => {
  it('should validate valid dto', async () => {
    const errors = await validateDto(GateDecideDto, { action: 'approve', reviewer: 'alice' });
    expect(errors).toHaveLength(0);
  });

  it('should reject missing action', async () => {
    const errors = await validateDto(GateDecideDto, { reviewer: 'alice' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject missing reviewer', async () => {
    const errors = await validateDto(GateDecideDto, { action: 'approve' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept optional comment', async () => {
    const errors = await validateDto(GateDecideDto, { action: 'approve', reviewer: 'alice', comment: 'looks good' });
    expect(errors).toHaveLength(0);
  });

  it('should reject comment exceeding 2000 chars', async () => {
    const errors = await validateDto(GateDecideDto, { action: 'a', reviewer: 'a', comment: 'x'.repeat(2001) });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GateCancelDto', () => {
  it('should validate valid dto', async () => {
    const errors = await validateDto(GateCancelDto, { reason: 'no longer needed' });
    expect(errors).toHaveLength(0);
  });

  it('should reject missing reason', async () => {
    const errors = await validateDto(GateCancelDto, {});
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('WorkflowRetryDto', () => {
  it('should accept empty dto (all optional)', async () => {
    const errors = await validateDto(WorkflowRetryDto, {});
    expect(errors).toHaveLength(0);
  });

  it('should accept fromStep', async () => {
    const errors = await validateDto(WorkflowRetryDto, { fromStep: 'step-1' });
    expect(errors).toHaveLength(0);
  });
});

describe('CreateSessionDto', () => {
  it('should validate valid dto', async () => {
    const errors = await validateDto(CreateSessionDto, {
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      sessionId: 'sess-1',
    });
    expect(errors).toHaveLength(0);
  });

  it('should accept ttlSeconds', async () => {
    const errors = await validateDto(CreateSessionDto, {
      tenantId: 't',
      workflowId: 'w',
      sessionId: 's',
      ttlSeconds: 3600,
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject ttlSeconds > 86400', async () => {
    const errors = await validateDto(CreateSessionDto, {
      tenantId: 't',
      workflowId: 'w',
      sessionId: 's',
      ttlSeconds: 100000,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject missing fields', async () => {
    const errors = await validateDto(CreateSessionDto, {});
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ResolveHostDto', () => {
  it('should validate valid hostname', async () => {
    const errors = await validateDto(ResolveHostDto, { host: 'github.com' });
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid hostname', async () => {
    const errors = await validateDto(ResolveHostDto, { host: '-invalid' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('RecordCostDto', () => {
  it('should validate valid dto', async () => {
    const errors = await validateDto(RecordCostDto, {
      inputTokens: 1000,
      outputTokens: 500,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject negative tokens', async () => {
    const errors = await validateDto(RecordCostDto, {
      inputTokens: -1,
      outputTokens: 0,
      provider: 'x',
      model: 'y',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
