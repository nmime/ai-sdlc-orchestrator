import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { PinoLoggerService } from '@ai-sdlc/common';

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

  const config = app.get(ConfigService);

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS')?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI SDLC Orchestrator API')
      .setDescription('Orchestrator API for automated SDLC workflows')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('API_PORT') || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`orchestrator-api started on port ${port}`);
}

bootstrap();
