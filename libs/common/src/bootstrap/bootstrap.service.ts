import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { PinoLoggerService } from '../logger/logger.module';
import { seedDatabase } from '@app/db';

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly logger: PinoLoggerService,
    private readonly em: EntityManager,
  ) {
    this.logger.setContext('Bootstrap');
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await seedDatabase(this.em);
      this.logger.log('Database seeded successfully');
    } catch (error) {
      this.logger.warn(`Seed skipped: ${(error as Error).message}`);
    }
  }

  logStartup(appName: string, port?: number): void {
    this.logger.log(`${appName} started${port ? ` on port ${port}` : ''}`);
  }
}
