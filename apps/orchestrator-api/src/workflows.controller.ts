import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror, WorkflowEvent, AgentSession, AgentToolCall, WorkflowArtifact } from '@ai-sdlc/db';

@ApiTags('workflows')
@Controller('api/v1/workflows')
@ApiBearerAuth()
export class WorkflowsController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  @ApiOperation({ summary: 'List workflows with pagination and filters' })
  async list(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('repoId') repoId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: WorkflowMirror[]; total: number; limit: number; offset: number }> {
    const where: Record<string, unknown> = {};
    if (tenantId) where['tenant'] = tenantId;
    if (status) where['state'] = status;
    if (repoId) where['repoId'] = repoId;

    const [workflows, total] = await this.em.findAndCount(WorkflowMirror, where, {
      orderBy: { createdAt: 'DESC' },
      limit: parseInt(limit || '50', 10),
      offset: parseInt(offset || '0', 10),
    });

    return { data: workflows, total, limit: parseInt(limit || '50', 10), offset: parseInt(offset || '0', 10) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow detail' })
  async detail(@Param('id') id: string): Promise<{ workflow: WorkflowMirror; events: WorkflowEvent[]; sessions: AgentSession[]; artifacts: WorkflowArtifact[] }> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id });
    const events: WorkflowEvent[] = await this.em.find(WorkflowEvent, { workflow: mirror.id }, { orderBy: { createdAt: 'ASC' } });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id }, { orderBy: { startedAt: 'ASC' } });
    const artifacts: WorkflowArtifact[] = await this.em.find(WorkflowArtifact, { workflow: mirror.id });

    return { workflow: mirror, events, sessions, artifacts };
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Get workflow events timeline' })
  async events(@Param('id') id: string): Promise<WorkflowEvent[]> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id });
    return this.em.find(WorkflowEvent, { workflow: mirror.id }, { orderBy: { createdAt: 'ASC' } });
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Get agent sessions for workflow' })
  async sessions(@Param('id') id: string): Promise<Record<string, unknown>[]> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id }, {
      orderBy: { startedAt: 'ASC' },
    });

    const result: Record<string, unknown>[] = [];
    for (const session of sessions) {
      const toolCalls: AgentToolCall[] = await this.em.find(AgentToolCall, { session: session.id }, { orderBy: { sequenceNumber: 'ASC' } });
      result.push({ ...session, toolCalls });
    }
    return result;
  }

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'Get workflow artifacts' })
  async artifacts(@Param('id') id: string): Promise<WorkflowArtifact[]> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id });
    return this.em.find(WorkflowArtifact, { workflow: mirror.id });
  }

  @Get(':id/cost')
  @ApiOperation({ summary: 'Get workflow cost breakdown' })
  async cost(@Param('id') id: string): Promise<Record<string, unknown>> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id });

    return {
      totalCostUsd: Number(mirror.costUsdTotal),
      aiCostUsd: Number(mirror.aiCostUsd),
      sandboxCostUsd: Number(mirror.sandboxCostUsd),
      bySession: sessions.map(s => ({
        id: s.id,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        aiCostUsd: Number(s.aiCostUsd),
        sandboxCostUsd: Number(s.sandboxCostUsd),
      })),
    };
  }
}
