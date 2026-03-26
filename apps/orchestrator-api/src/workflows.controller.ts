import { Controller, Get, Query, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { WorkflowMirror, WorkflowEvent, AgentSession, AgentToolCall, WorkflowArtifact } from '@app/db';
import type { FastifyRequest } from 'fastify';

@ApiTags('workflows')
@Controller('workflows')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class WorkflowsController {
  constructor(private readonly em: EntityManager) {}

  private getTenantId(req: FastifyRequest): string {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    return tenantId;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List workflows with pagination and filters' })
  async list(
    @Req() req: FastifyRequest,
    @Query('status') status?: string,
    @Query('repoId') repoId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: WorkflowMirror[]; total: number; limit: number; offset: number }> {
    const tenantId = this.getTenantId(req);
    const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);
    const parsedOffset = Math.max(parseInt(offset || '0', 10), 0);
    const where: Record<string, unknown> = { tenant: tenantId };
    if (status) where['state'] = status;
    if (repoId) where['repoId'] = repoId;

    const [workflows, total] = await this.em.findAndCount(WorkflowMirror, where, {
      orderBy: { createdAt: 'DESC' },
      limit: parsedLimit,
      offset: parsedOffset,
    });

    return { data: workflows, total, limit: parsedLimit, offset: parsedOffset };
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow detail' })
  async detail(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ workflow: WorkflowMirror; events: WorkflowEvent[]; sessions: AgentSession[]; artifacts: WorkflowArtifact[] }> {
    const tenantId = this.getTenantId(req);
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    const events: WorkflowEvent[] = await this.em.find(WorkflowEvent, { workflow: mirror.id }, { orderBy: { createdAt: 'ASC' } });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id }, { orderBy: { startedAt: 'ASC' } });
    const artifacts: WorkflowArtifact[] = await this.em.find(WorkflowArtifact, { workflow: mirror.id });

    return { workflow: mirror, events, sessions, artifacts };
  }

  @Get(':id/events')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow events timeline' })
  async events(@Req() req: FastifyRequest, @Param('id') id: string): Promise<WorkflowEvent[]> {
    const tenantId = this.getTenantId(req);
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    return this.em.find(WorkflowEvent, { workflow: mirror.id }, { orderBy: { createdAt: 'ASC' } });
  }

  @Get(':id/sessions')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get agent sessions for workflow' })
  async sessions(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>[]> {
    const tenantId = this.getTenantId(req);
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
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
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow artifacts' })
  async artifacts(@Req() req: FastifyRequest, @Param('id') id: string): Promise<WorkflowArtifact[]> {
    const tenantId = this.getTenantId(req);
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: id, tenant: tenantId });
    return this.em.find(WorkflowArtifact, { workflow: mirror.id });
  }

  @Get(':id/cost')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow cost breakdown' })
  async cost(@Req() req: FastifyRequest, @Param('id') id: string): Promise<Record<string, unknown>> {
    const tenantId = this.getTenantId(req);
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
