import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { TemporalClientService } from '@app/common';
import { IsString, IsArray, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class RepoInput {
  @IsString()
  repoId!: string;

  @IsString()
  repoUrl!: string;

  @IsString()
  taskId!: string;

  @IsOptional()
  @IsArray()
  labels?: string[];
}

class StartMultiRepoDto {
  @IsString()
  tenantId!: string;

  @IsString()
  parentTaskId!: string;

  @IsString()
  taskProvider!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepoInput)
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
  async startMultiRepo(@Body() body: StartMultiRepoDto): Promise<{ workflowId: string }> {
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
