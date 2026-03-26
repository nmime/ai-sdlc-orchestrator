import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { CredentialProxyModule } from './credential-proxy.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    CredentialProxyModule,
    new FastifyAdapter({ logger: false, bodyLimit: 65_536 }),
  );

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(helmet);
  await fastify.register(rateLimit, {
    max: parseInt(process.env['CREDENTIAL_PROXY_RATE_LIMIT'] || '200', 10),
    timeWindow: '1 minute',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  app.enableCors({
    origin: false,
  });

  app.enableShutdownHooks();

  const port = parseInt(process.env['CREDENTIAL_PROXY_PORT'] || '4000', 10);
  await app.listen(port, '0.0.0.0');
  new Logger('CredentialProxy').log(`Listening on :${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start credential-proxy:', err);
  process.exit(1);
});
