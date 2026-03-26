import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
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
    { bufferLogs: true },
  );

  const logger = await app.resolve(PinoLoggerService);
  app.useLogger(logger);

  app.enableShutdownHooks();

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

  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI SDLC Orchestrator API')
    .setDescription('Orchestrator API for automated SDLC workflows')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (process.env['NODE_ENV'] !== 'production') {
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
