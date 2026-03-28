import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConfigService } from '@nestjs/config';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@app/common';
import type { AppError, AppConfig } from '@app/common';
import { SystemSettings } from '@app/db';

@Injectable()
export class SystemSettingsService {
  private cache = new Map<string, string>();

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('SystemSettingsService');
  }

  async get(key: string): Promise<string | undefined> {
    if (this.cache.has(key)) return this.cache.get(key);

    const setting = await this.em.findOne(SystemSettings, { key });
    if (setting) {
      this.cache.set(key, setting.value);
      return setting.value;
    }

    return undefined;
  }

  async getOrEnv(key: string, envKey?: string): Promise<string | undefined> {
    const dbValue = await this.get(key);
    if (dbValue !== undefined) return dbValue;
    return this.configService.get(envKey || key as any, { infer: true }) as string | undefined;
  }

  async getNumber(key: string, envKey?: string): Promise<number | undefined> {
    const val = await this.getOrEnv(key, envKey);
    if (val === undefined || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }

  async set(key: string, value: string, description?: string): Promise<Result<SystemSettings, AppError>> {
    let setting = await this.em.findOne(SystemSettings, { key });
    if (setting) {
      setting.value = value;
      if (description !== undefined) setting.description = description;
    } else {
      setting = new SystemSettings();
      setting.key = key;
      setting.value = value;
      setting.description = description;
      this.em.persist(setting);
    }

    await this.em.flush();
    this.cache.set(key, value);
    this.logger.log(`System setting updated: ${key}`);
    return ResultUtils.ok(setting);
  }

  async delete(key: string): Promise<Result<void, AppError>> {
    const setting = await this.em.findOne(SystemSettings, { key });
    if (!setting) return ResultUtils.err('NOT_FOUND', `Setting '${key}' not found`);
    await this.em.removeAndFlush(setting);
    this.cache.delete(key);
    return ResultUtils.ok(undefined);
  }

  async list(): Promise<Result<SystemSettings[], AppError>> {
    const settings = await this.em.find(SystemSettings, {}, { orderBy: { key: 'ASC' } });
    return ResultUtils.ok(settings);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
