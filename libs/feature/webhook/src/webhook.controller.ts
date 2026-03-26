import { Controller, Post, Body, Headers, Param, HttpCode, HttpStatus, RawBodyRequest, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { ResultUtils } from '@app/common';
import type { FastifyRequest } from 'fastify';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly signatureService: WebhookSignatureService,
  ) {}

  @Post(':platform/:tenantId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive webhook from external platform' })
  async handleWebhook(
    @Param('platform') platform: string,
    @Param('tenantId') tenantId: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ accepted: boolean; deliveryId: string }> {
    const secret = await this.webhookService.getWebhookSecret(platform, tenantId);
    if (!secret) {
      throw new BadRequestException('Webhook secret not configured for this tenant/platform');
    }
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body);
    switch (platform) {
      case 'github':
        this.signatureService.verifyGitHub(rawBody, headers['x-hub-signature-256'], secret);
        break;
      case 'gitlab':
        this.signatureService.verifyGitLab(headers['x-gitlab-token'], secret);
        break;
      case 'jira':
        this.signatureService.verifyJira(rawBody, headers['x-atlassian-webhook-signature'], secret);
        break;
      case 'linear':
        this.signatureService.verifyLinear(rawBody, headers['linear-signature'], secret);
        break;
    }

    return ResultUtils.unwrapOrThrow(await this.webhookService.processWebhook(platform, tenantId, headers, body));
  }
}
