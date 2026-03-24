import { Controller, Post, Body, Headers, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post(':platform/:tenantId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive webhook from external platform' })
  async handleWebhook(
    @Param('platform') platform: string,
    @Param('tenantId') tenantId: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ accepted: boolean; deliveryId: string }> {
    const result = await this.webhookService.processWebhook(platform, tenantId, headers, body);

    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    return result.value;
  }
}
