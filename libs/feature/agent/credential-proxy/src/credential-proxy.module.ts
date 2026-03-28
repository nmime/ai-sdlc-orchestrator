import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CredentialProxyClient } from './credential-proxy.client';

@Module({
  imports: [ConfigModule],
  providers: [CredentialProxyClient],
  exports: [CredentialProxyClient],
})
export class CredentialProxyModule {}
