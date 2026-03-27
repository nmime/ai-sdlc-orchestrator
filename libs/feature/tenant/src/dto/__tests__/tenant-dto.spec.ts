import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTenantDto, UpdateTenantDto } from '../tenant.dto';

async function validateDto<T extends object>(cls: new () => T, plain: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  return errors.map((e) => Object.values(e.constraints || {}).join(', '));
}

describe('CreateTenantDto', () => {
  it('should validate valid dto', async () => {
    const errors = await validateDto(CreateTenantDto, { slug: 'acme', name: 'Acme Corp' });
    expect(errors).toHaveLength(0);
  });

  it('should reject missing slug', async () => {
    const errors = await validateDto(CreateTenantDto, { name: 'Acme Corp' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject missing name', async () => {
    const errors = await validateDto(CreateTenantDto, { slug: 'acme' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject slug exceeding 63 chars', async () => {
    const errors = await validateDto(CreateTenantDto, { slug: 'a'.repeat(64), name: 'N' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept optional fields', async () => {
    const errors = await validateDto(CreateTenantDto, {
      slug: 'acme',
      name: 'Acme',
      monthlyCostLimitUsd: 500,
      defaultAgentProvider: 'claude',
      meta: { key: 'val' },
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject negative monthlyCostLimitUsd', async () => {
    const errors = await validateDto(CreateTenantDto, { slug: 'a', name: 'A', monthlyCostLimitUsd: -1 });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateTenantDto', () => {
  it('should accept empty dto (all optional)', async () => {
    const errors = await validateDto(UpdateTenantDto, {});
    expect(errors).toHaveLength(0);
  });

  it('should accept valid fields', async () => {
    const errors = await validateDto(UpdateTenantDto, {
      name: 'New Name',
      monthlyCostLimitUsd: 1000,
      maxConcurrentWorkflows: 5,
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject maxConcurrentWorkflows > 100', async () => {
    const errors = await validateDto(UpdateTenantDto, { maxConcurrentWorkflows: 101 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject negative monthlyCostLimitUsd', async () => {
    const errors = await validateDto(UpdateTenantDto, { monthlyCostLimitUsd: -5 });
    expect(errors.length).toBeGreaterThan(0);
  });
});
