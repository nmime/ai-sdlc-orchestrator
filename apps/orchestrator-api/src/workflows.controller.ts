import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import { WorkflowMirror, WorkflowEvent, AgentSession, WorkflowArtifact } from '@app/db';
import { type WorkflowListQueryDto, PaginatedResponseDto } from '@app/common';

@ApiTags('workflows')
@Controller('workflows')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class WorkflowsController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List workflows with pagination and filters' })
  async list(
    @TenantId() tenantId: string,
    @Query() query: WorkflowListQueryDto,
  ): Promise<PaginatedResponseDto<WorkflowMirror>> {
    const where: Record<string, unknown> = { tenant: tenantId };
    if (query.status) where['state'] = query.status;
    if (query.repoId) where['repoId'] = query.repoId;

    const [workflows, total] = await this.em.findAndCount(WorkflowMirror, where, {
      orderBy: { createdAt: 'DESC' },
      limit: query.limit,
      offset: query.offset,
    });

    return PaginatedResponseDto.of(workflows, total, query.limit, query.offset);
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow detail' })
  async detail(@TenantId() tenantId: string, @Param('id') id: string): Promise<{ workflow: WorkflowMirror; events: WorkflowEvent[]; sessions: AgentSession[]; artifacts: WorkflowArtifact[] }> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    const events: WorkflowEvent[] = await this.em.find(WorkflowEvent, { workflow: mirror.id }, { orderBy: { createdAt: 'ASC' } });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id }, { orderBy: { startedAt: 'ASC' } });
    const artifacts: WorkflowArtifact[] = await this.em.find(WorkflowArtifact, { workflow: mirror.id });

    return { workflow: mirror, events, sessions, artifacts };
  }

  @Get(':id/events')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow events timeline' })
  async events(@TenantId() tenantId: string, @Param('id') id: string): Promise<WorkflowEvent[]> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    return this.em.find(WorkflowEvent, { workflow: mirror.id }, { orderBy: { createdAt: 'ASC' }, limit: 500 });
  }

  @Get(':id/sessions')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get agent sessions for workflow' })
  async sessions(@TenantId() tenantId: string, @Param('id') id: string): Promise<Record<string, unknown>[]> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id }, {
      orderBy: { startedAt: 'ASC' },
      limit: 200,
      populate: ['toolCalls'] as never,
    });

    return sessions.map(session => ({
      ...session,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toolCalls: (session as any).toolCalls?.getItems?.() ?? [],
    }));
  }

  @Get(':id/artifacts')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow artifacts' })
  async artifacts(@TenantId() tenantId: string, @Param('id') id: string): Promise<WorkflowArtifact[]> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    return this.em.find(WorkflowArtifact, { workflow: mirror.id });
  }

  @Get(':id/cost')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow cost breakdown' })
  async cost(@TenantId() tenantId: string, @Param('id') id: string): Promise<Record<string, unknown>> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
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
