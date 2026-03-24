import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { TemporalClientService } from '@ai-sdlc/common';
import { WorkflowMirror, WorkflowEvent, WorkflowArtifact, AgentSession } from '@ai-sdlc/db';

@ApiTags('workflows')
@Controller('workflows')
@ApiBearerAuth()
export class WorkflowsController {
  constructor(
    private readonly em: EntityManager,
    private readonly temporalClientService: TemporalClientService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List workflow mirrors' })
  async list(
    @Query('tenantId') tenantId?: string,
    @Query('state') state?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const where: Record<string, unknown> = {};
    if (tenantId) where['tenant'] = tenantId;
    if (state) where['state'] = state;

    const [items, total] = await this.em.findAndCount(WorkflowMirror, where, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
    });

    return { items, total, limit, offset };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow mirror by ID' })
  async findById(@Param('id') id: string) {
    return this.em.findOneOrFail(WorkflowMirror, { id }, {
      populate: ['tenant'],
    });
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Get workflow events' })
  async getEvents(@Param('id') id: string) {
    return this.em.find(WorkflowEvent, { workflow: id }, {
      orderBy: { createdAt: 'ASC' },
    });
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Get agent sessions for a workflow' })
  async getSessions(@Param('id') id: string) {
    return this.em.find(AgentSession, { workflow: id }, {
      orderBy: { startedAt: 'ASC' },
    });
  }

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'Get workflow artifacts' })
  async getArtifacts(@Param('id') id: string) {
    return this.em.find(WorkflowArtifact, { workflow: id });
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a blocked workflow from a specific step' })
  async retry(
    @Param('id') id: string,
    @Body() body: { fromStep?: string },
  ) {
    const workflow = await this.em.findOneOrFail(WorkflowMirror, { id });
    if (!workflow.state.startsWith('blocked')) {
      throw new Error('Workflow is not in a blocked state');
    }

    const client = await this.temporalClientService.getClient();
    const handle = client.workflow.getHandle(workflow.temporalWorkflowId);
    await handle.signal('workflowUnblock', { reason: `Retry from step: ${body.fromStep ?? 'current'}` });

    workflow.state = 'implementing' as any;
    if (body.fromStep) workflow.currentStepId = body.fromStep;
    await this.em.flush();

    return { workflowId: id, retryFromStep: body.fromStep, status: 'retry_queued' };
  }
}
