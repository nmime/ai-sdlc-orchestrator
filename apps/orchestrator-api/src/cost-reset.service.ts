import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { PinoLoggerService } from '@app/common';
import { Tenant } from '@app/db';

@Injectable()
export class CostResetService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('CostResetService');
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyCosts(): Promise<void> {
    const fork = this.em.fork();
    const count = await fork.nativeUpdate(
      Tenant,
      {},
      {
        monthlyCostActualUsd: 0,
        monthlyCostReservedUsd: 0,
        monthlyAiCostActualUsd: 0,
        monthlySandboxCostActualUsd: 0,
      },
    );
    this.logger.log(`Reset monthly costs for ${count} tenants`);
  }
}
