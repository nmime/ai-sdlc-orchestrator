import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { CredentialProxyModule } from './credential-proxy.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    CredentialProxyModule,
    new FastifyAdapter({ logger: false }),
  );

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  app.enableCors({ origin: false });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const config = app.get(ConfigService);
  const port = parseInt(config.get<string>('CREDENTIAL_PROXY_PORT') || '4000', 10);
  const bindAddress = config.get<string>('CREDENTIAL_PROXY_BIND') || '127.0.0.1';
  await app.listen(port, bindAddress);
  console.log(`Credential proxy listening on ${bindAddress}:${port}`);
}

bootstrap();
