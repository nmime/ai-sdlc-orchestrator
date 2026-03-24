import { Module } from '@nestjs/common';
import { CredentialProxyController } from './credential-proxy.controller';
import { CredentialProxyService } from './credential-proxy.service';
import { SessionService } from './session.service';
import { RateLimiterService } from './rate-limiter.service';
import { AuditService } from './audit.service';

@Module({
  controllers: [CredentialProxyController],
  providers: [CredentialProxyService, SessionService, RateLimiterService, AuditService],
})
export class CredentialProxyModule {}
