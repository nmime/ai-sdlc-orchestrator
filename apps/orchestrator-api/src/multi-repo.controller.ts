import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import { TemporalClientService } from '@app/common';
import { StartMultiRepoDto } from './dto';

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
  @ApiBody({ type: StartMultiRepoDto })
  @ApiResponse({ status: 202, description: 'Multi-repo workflow started' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Cannot start workflows for another tenant' })
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
