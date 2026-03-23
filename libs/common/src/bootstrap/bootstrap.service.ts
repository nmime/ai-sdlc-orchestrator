import { Injectable } from '@nestjs/common';
import { PinoLoggerService } from '../logger/logger.module';

@Injectable()
export class BootstrapService {
  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext('Bootstrap');
  }

  logStartup(appName: string, port?: number): void {
    this.logger.log(`${appName} started${port ? ` on port ${port}` : ''}`);
  }
}
