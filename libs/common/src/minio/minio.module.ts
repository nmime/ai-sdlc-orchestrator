import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import type { AppConfig } from '../config/app-config.module';

export const MINIO_CLIENT = Symbol('MINIO_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const accessKey = config.get('MINIO_ACCESS_KEY', { infer: true });
        const secretKey = config.get('MINIO_SECRET_KEY', { infer: true });
        if (!accessKey) throw new Error('MINIO_ACCESS_KEY not configured');
        if (!secretKey) throw new Error('MINIO_SECRET_KEY not configured');
        return new Minio.Client({
          endPoint: config.get('MINIO_ENDPOINT', { infer: true }) || 'localhost',
          port: parseInt(config.get('MINIO_PORT', { infer: true }) || '9000', 10),
          useSSL: config.get('MINIO_USE_SSL', { infer: true }) === 'true',
          accessKey,
          secretKey,
        });
      },
    },
  ],
  exports: [MINIO_CLIENT],
})
export class MinioModule {}
