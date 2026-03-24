import { Module } from '@nestjs/common';
import { PromptSanitizer } from './prompt-sanitizer';

@Module({
  providers: [PromptSanitizer],
  exports: [PromptSanitizer],
})
export class SecurityModule {}
