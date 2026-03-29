import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '@app/db';
import { PaginationQueryDto } from './pagination.dto';

export class WorkflowListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WorkflowStatus })
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  repoId?: string;
}
