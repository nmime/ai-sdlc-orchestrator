import { Controller, Get, Param, Post, Body, Query, UseGuards, BadRequestException, Req, ParseIntPipe, DefaultValuePipe, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { TemporalClientService, WorkflowRetryDto } from '@ai-sdlc/common';
import type { AuthenticatedRequest } from '@ai-sdlc/common';
import { WorkflowMirror, WorkflowEvent, WorkflowArtifact, AgentSession, WorkflowStatus } from '@ai-sdlc/db';
import { AuthGuard, RbacGuard, Roles } from '@ai-sdlc/feature-tenant';

@ApiTags('workflows')
@Controller('workflows')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class WorkflowsController {
  constructor(
    private readonly em: EntityManager,
    private readonly temporalClientService: TemporalClientService,
  ) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List workflow mirrors' })
  @ApiResponse({ status: 200, description: 'Paginated list of workflows' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'state', required: false, enum: WorkflowStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('state') state?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const where: Record<string, unknown> = { tenant: req.user.tenantId };
    if (state) {
      if (!Object.values(WorkflowStatus).includes(state as WorkflowStatus)) {
        throw new BadRequestException(`Invalid state. Must be one of: ${Object.values(WorkflowStatus).join(', ')}`);
      }
      where['state'] = state;
    }
    const safeLimit = Math.min(limit ?? 50, 100);

    const [items, total] = await this.em.findAndCount(WorkflowMirror, where, {
      limit: safeLimit,
      offset: offset ?? 0,
      orderBy: { createdAt: 'DESC' },
    });

    return { items, total, limit: safeLimit, offset };
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow mirror by ID' })
  @ApiResponse({ status: 200, description: 'Workflow mirror details' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async findById(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.em.findOneOrFail(WorkflowMirror, { id, tenant: req.user.tenantId }, {
      populate: ['tenant'],
    });
  }

  @Get(':id/events')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow events' })
  @ApiResponse({ status: 200, description: 'List of workflow events' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getEvents(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const workflow = await this.em.findOneOrFail(WorkflowMirror, { id, tenant: req.user.tenantId });
    return this.em.find(WorkflowEvent, { workflow: workflow.id }, {
      orderBy: { createdAt: 'ASC' },
    });
  }

  @Get(':id/sessions')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get agent sessions for a workflow' })
  @ApiResponse({ status: 200, description: 'List of agent sessions' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getSessions(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const workflow = await this.em.findOneOrFail(WorkflowMirror, { id, tenant: req.user.tenantId });
    return this.em.find(AgentSession, { workflow: workflow.id }, {
      orderBy: { startedAt: 'ASC' },
    });
  }

  @Get(':id/artifacts')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow artifacts' })
  @ApiResponse({ status: 200, description: 'List of workflow artifacts' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getArtifacts(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const workflow = await this.em.findOneOrFail(WorkflowMirror, { id, tenant: req.user.tenantId });
    return this.em.find(WorkflowArtifact, { workflow: workflow.id, tenant: req.user.tenantId });
  }

  @Post(':id/retry')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Retry a blocked workflow from a specific step' })
  @ApiResponse({ status: 200, description: 'Retry queued' })
  @ApiResponse({ status: 400, description: 'Workflow not in blocked state' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async retry(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WorkflowRetryDto,
  ) {
    const workflow = await this.em.findOneOrFail(WorkflowMirror, { id, tenant: req.user.tenantId });
    if (!workflow.state.startsWith('blocked')) {
      throw new BadRequestException('Workflow is not in a blocked state');
    }

    const client = await this.temporalClientService.getClient();
    const handle = client.workflow.getHandle(workflow.temporalWorkflowId);
    await handle.signal('workflowUnblock', { reason: `Retry from step: ${body.fromStep ?? 'current'}` });

    workflow.state = WorkflowStatus.IMPLEMENTING;
    if (body.fromStep) workflow.currentStepId = body.fromStep;
    await this.em.flush();

    return { workflowId: id, retryFromStep: body.fromStep, status: 'retry_queued' };
  }
}
