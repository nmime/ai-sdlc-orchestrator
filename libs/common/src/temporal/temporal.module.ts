import { Module, Global, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import type { AppConfig } from '../config/app-config.module';

@Injectable()
export class TemporalClientService implements OnModuleDestroy {
  private client: Client | null = null;
  private connection: Connection | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async getClient(): Promise<Client> {
    if (this.client) return this.client;

    this.connection = await Connection.connect({
      address: this.configService.get('TEMPORAL_ADDRESS'),
    });

    this.client = new Client({
      connection: this.connection,
      namespace: this.configService.get('TEMPORAL_NAMESPACE'),
    });

    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    this.connection?.close();
  }
}

@Global()
@Module({
  providers: [TemporalClientService],
  exports: [TemporalClientService],
})
export class TemporalModule {}
