import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/postgresql';
import { PinoLoggerService } from '@app/common';
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
    const tenants = await fork.find(Tenant, {});
    let count = 0;

    for (const tenant of tenants) {
      tenant.monthlyCostActualUsd = 0;
      tenant.monthlyCostReservedUsd = 0;
      tenant.monthlyAiCostActualUsd = 0;
      tenant.monthlySandboxCostActualUsd = 0;
      count++;
    }

    await fork.flush();
    this.logger.log(`Reset monthly costs for ${count} tenants`);
  }
}
