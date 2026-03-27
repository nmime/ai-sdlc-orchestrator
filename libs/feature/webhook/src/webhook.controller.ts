import { Controller, Post, Body, Headers, Param, HttpCode, HttpStatus, InternalServerErrorException, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { ContentTypeGuard } from '@ai-sdlc/common';
import { WebhookService } from './webhook.service';

export class WebhookParamsDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,30}$/, { message: 'Invalid platform identifier' })
  platform!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/, { message: 'Invalid tenantId' })
  @MaxLength(64)
  tenantId!: string;
}

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(ContentTypeGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post(':platform/:tenantId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive webhook from external platform' })
  @ApiResponse({ status: 202, description: 'Webhook accepted' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload or signature' })
  async handleWebhook(
    @Param('platform') platform: string,
    @Param('tenantId') tenantId: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ accepted: boolean; deliveryId: string }> {
    if (!/^[a-z][a-z0-9_-]{0,30}$/.test(platform)) {
      throw new BadRequestException('Invalid platform identifier');
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) {
      throw new BadRequestException('Invalid tenantId');
    }

    const result = await this.webhookService.processWebhook(platform, tenantId, headers, body);

    if (result.isErr()) {
      if (result.error.code === 'VALIDATION_ERROR') throw new BadRequestException(result.error.message);
      throw new InternalServerErrorException('Failed to process webhook');
    }

    return result.value;
  }
}
