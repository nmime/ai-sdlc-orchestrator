import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { CredentialProxyModule } from './credential-proxy.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    CredentialProxyModule,
    new FastifyAdapter({ logger: false }),
  );

  const port = parseInt(process.env['CREDENTIAL_PROXY_PORT'] || '4000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Credential proxy listening on :${port}`);
}

bootstrap();
