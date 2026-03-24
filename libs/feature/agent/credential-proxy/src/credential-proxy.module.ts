import { Module } from '@nestjs/common';
import { CredentialProxyClient } from './credential-proxy.client';

@Module({
  providers: [CredentialProxyClient],
  exports: [CredentialProxyClient],
})
export class CredentialProxyModule {}
