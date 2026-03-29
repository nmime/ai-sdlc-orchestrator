import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryStatus, WebhookPlatform } from '@app/db';
import { PaginationQueryDto } from './pagination.dto';

export class WebhookDeliveryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DeliveryStatus })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiPropertyOptional({ enum: WebhookPlatform })
  @IsOptional()
  @IsEnum(WebhookPlatform)
  platform?: WebhookPlatform;
}
