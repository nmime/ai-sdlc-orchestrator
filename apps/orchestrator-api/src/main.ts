import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { PinoLoggerService, AllExceptionsFilter, initTelemetry } from '@ai-sdlc/common';
import { httpRequestCounter, httpRequestDuration } from './metrics.controller';

const otelSdk = initTelemetry('orchestrator-api');

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

  fastify.addHook('onRequest', async (request) => {
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    request.headers['x-request-id'] = requestId;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    reply.header('x-request-id', request.headers['x-request-id']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url || request.url;
    httpRequestCounter.inc({ method: request.method, route, status_code: String(reply.statusCode) });
    httpRequestDuration.observe(
      { method: request.method, route, status_code: String(reply.statusCode) },
      reply.elapsedTime / 1000,
    );
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  });
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter(config));

  const origins = config.get<string>('CORS_ORIGINS')?.split(',') || ['http://localhost:5173'];
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    maxAge: 86400,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI SDLC Orchestrator API')
    .setDescription('Orchestrator API for automated SDLC workflows')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('API_PORT') || 3000;
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');

  logger.log(`orchestrator-api started on port ${port}`);
}

bootstrap();
