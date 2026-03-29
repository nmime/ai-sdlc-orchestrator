import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import type { TemporalClientService } from '@app/common';
import { IsString, IsArray, ValidateNested, IsOptional, IsIn, ArrayMaxSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class RepoInput {
  @IsString()
  @MaxLength(255)
  repoId!: string;

  @IsString()
  @MaxLength(2048)
  repoUrl!: string;

  @IsString()
  @MaxLength(255)
  taskId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  labels?: string[];
}

class StartMultiRepoDto {
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @IsString()
  @MaxLength(255)
  parentTaskId!: string;

  @IsString()
  @MaxLength(255)
  taskProvider!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepoInput)
  @ArrayMaxSize(50)
  repos!: RepoInput[];

  @IsOptional()
  @IsIn(['wait_all', 'fail_fast'])
  failureStrategy?: 'wait_all' | 'fail_fast';
}

@ApiTags('multi-repo')
@Controller('multi-repo')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class MultiRepoController {
  constructor(private readonly temporalClient: TemporalClientService) {}

  @Post()
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a multi-repo workflow' })
  async startMultiRepo(@TenantId() authTenantId: string, @Body() body: StartMultiRepoDto): Promise<{ workflowId: string }> {
    if (body.tenantId !== authTenantId) throw new ForbiddenException('Cannot start workflows for another tenant');
    const client = await this.temporalClient.getClient();
    const workflowId = `multi-repo-${body.parentTaskId}`;

    await client.workflow.start('multiRepoWorkflow', {
      taskQueue: 'orchestrator-queue',
      workflowId,
      args: [{
        tenantId: body.tenantId,
        parentTaskId: body.parentTaskId,
        taskProvider: body.taskProvider,
        repos: body.repos,
        failureStrategy: body.failureStrategy || 'wait_all',
        webhookDeliveryId: `manual-${Date.now()}`,
      }],
    });

    return { workflowId };
  }
}
