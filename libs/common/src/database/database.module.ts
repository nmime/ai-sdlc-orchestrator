import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/app-config.module';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        type: 'postgresql',
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
        debug: config.get('NODE_ENV') === 'development',
        allowGlobalContext: true,
      }),
    }),
  ],
  exports: [MikroOrmModule],
})
export class DatabaseModule {}
