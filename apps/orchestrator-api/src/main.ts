import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { PinoLoggerService, AppErrorExceptionFilter, BootstrapService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: 1_048_576,
    }),
    { bufferLogs: true, rawBody: true },
  );

  const logger = await app.resolve(PinoLoggerService);
  app.useLogger(logger);

  app.enableShutdownHooks();

  const shutdownTimeout = parseInt(process.env['SHUTDOWN_TIMEOUT_MS'] || '10000', 10);
  process.on('SIGTERM', () => {
    setTimeout(() => process.exit(1), shutdownTimeout);
  });

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(helmet, {
    contentSecurityPolicy: process.env['NODE_ENV'] !== 'test',
  });
  await fastify.register(rateLimit, {
    max: parseInt(process.env['RATE_LIMIT_MAX'] || '100', 10),
    timeWindow: process.env['RATE_LIMIT_WINDOW'] || '1 minute',
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AppErrorExceptionFilter());

  const corsOrigins = process.env['CORS_ORIGINS']?.split(',').filter(Boolean);
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0
      ? corsOrigins.includes('*') ? true : corsOrigins
      : process.env['NODE_ENV'] === 'production' ? false : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Tenant-Id'],
    maxAge: 86400,
  });

  if (process.env['ENABLE_SWAGGER'] === 'true' || (process.env['ENABLE_SWAGGER'] !== 'false' && process.env['NODE_ENV'] !== 'production')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Opwerf API')
      .setDescription('Opwerf API for automated SDLC workflows')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(process.env['API_PORT'] || '3000', 10);
  await app.listen(port, '0.0.0.0');

  const bootstrapService = await app.resolve(BootstrapService);
  bootstrapService.logStartup('orchestrator-api', port);
}

bootstrap().catch((err) => {
  console.error('Failed to start orchestrator-api:', err);
  process.exit(1);
});
