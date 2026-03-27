import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/app-config.module';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        driver: PostgreSqlDriver,
        host: config.get('DATABASE_HOST'),
        port: config.get('DATABASE_PORT'),
        dbName: config.get('DATABASE_NAME'),
        user: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        entities: ['./dist/libs/db/src/entities'],
        entitiesTs: ['./libs/db/src/entities'],
        migrations: {
          path: './dist/libs/db/src/migrations',
          pathTs: './libs/db/src/migrations',
        },
        pool: {
          min: 2,
          max: 20,
          idleTimeoutMillis: 30_000,
        },
        debug: config.get('NODE_ENV') === 'development',
        allowGlobalContext: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
