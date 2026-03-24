import { Module } from '@nestjs/common';
import { E2bSandboxAdapter } from './e2b-sandbox.adapter';

@Module({
  providers: [E2bSandboxAdapter],
  exports: [E2bSandboxAdapter],
})
export class E2bSandboxModule {}
