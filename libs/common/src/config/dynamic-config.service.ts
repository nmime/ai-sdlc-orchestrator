import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConfigService } from '@nestjs/config';
import { SystemSettings, Tenant } from '@app/db';
import type { AppConfig } from './app-config.module';

@Injectable()
export class DynamicConfigService {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly ttlMs = 30_000;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async getString(key: string, envFallback?: string): Promise<string | undefined> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const setting = await this.em.findOne(SystemSettings, { key });
    if (setting) {
      this.cache.set(key, { value: setting.value, expiresAt: Date.now() + this.ttlMs });
      return setting.value;
    }

    const env = envFallback
      ? (this.configService.get(envFallback as any, { infer: true }) as string | undefined)
      : undefined;
    return env;
  }

  async getNumber(key: string, envFallback?: string): Promise<number | undefined> {
    const val = await this.getString(key, envFallback);
    if (val === undefined || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }

  async getBoolean(key: string, envFallback?: string): Promise<boolean | undefined> {
    const val = await this.getString(key, envFallback);
    if (val === undefined) return undefined;
    return val === 'true' || val === '1';
  }

  async getForTenant<K extends keyof Tenant>(tenantId: string, field: K): Promise<Tenant[K] | undefined> {
    const tenant = await this.em.findOne(Tenant, { id: tenantId }, { fields: [field] as any });
    return tenant?.[field];
  }

  async getAgentConfig(tenantId: string): Promise<{
    maxTurns: number;
    maxDurationMs: number;
    provider?: string;
    model?: string;
  }> {
    const tenant = await this.em.findOne(Tenant, { id: tenantId });

    const maxTurns = tenant?.agentMaxTurns
      ?? (Number(await this.getString('AGENT_MAX_TURNS')) || 25);
    const maxDurationMs = tenant?.agentMaxDurationMs
      ?? (Number(await this.getString('AGENT_MAX_DURATION_MS')) || 3_600_000);

    return {
      maxTurns,
      maxDurationMs,
      provider: tenant?.defaultAgentProvider ?? await this.getString('DEFAULT_AGENT_PROVIDER'),
      model: tenant?.defaultAgentModel,
    };
  }

  async getSandboxConfig(tenantId: string): Promise<{
    timeoutMs: number;
    hourlyRateUsd: number;
  }> {
    const tenant = await this.em.findOne(Tenant, { id: tenantId });

    const timeoutMs = tenant?.sandboxTimeoutMs
      ?? (Number(await this.getString('SANDBOX_TIMEOUT_MS')) || 600_000);
    const hourlyRateUsd = tenant?.sandboxHourlyRateUsd !== undefined
      ? Number(tenant.sandboxHourlyRateUsd)
      : Number(await this.getString('SANDBOX_COST_PER_HOUR_USD')) || 0.05;

    return { timeoutMs, hourlyRateUsd };
  }

  async getCostConfig(tenantId: string): Promise<{
    inputCostPer1m: number;
    outputCostPer1m: number;
    budgetReservationUsd: number;
    sanitizerMode: string;
  }> {
    const tenant = await this.em.findOne(Tenant, { id: tenantId });

    const inputCostPer1m = tenant?.aiInputCostPer1m !== undefined
      ? Number(tenant.aiInputCostPer1m)
      : Number(await this.getString('AI_INPUT_COST_PER_1M')) || 3.0;
    const outputCostPer1m = tenant?.aiOutputCostPer1m !== undefined
      ? Number(tenant.aiOutputCostPer1m)
      : Number(await this.getString('AI_OUTPUT_COST_PER_1M')) || 15.0;
    const budgetReservationUsd = tenant?.budgetReservationUsd !== undefined
      ? Number(tenant.budgetReservationUsd)
      : Number(await this.getString('BUDGET_RESERVATION_USD')) || 50;
    const sanitizerMode = tenant?.sanitizerMode
      ?? await this.getString('SANITIZER_MODE') ?? 'block';

    return { inputCostPer1m, outputCostPer1m, budgetReservationUsd, sanitizerMode };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
