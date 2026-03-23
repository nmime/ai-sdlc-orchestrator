import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror, WorkflowEvent, WorkflowArtifact } from '@ai-sdlc/db';

@ApiTags('workflows')
@Controller('workflows')
@ApiBearerAuth()
export class WorkflowsController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  @ApiOperation({ summary: 'List workflow mirrors' })
  async list(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const where: Record<string, unknown> = {};
    if (tenantId) where['tenant'] = tenantId;
    if (status) where['status'] = status;

    const [items, total] = await this.em.findAndCount(WorkflowMirror, where, {
      limit,
      offset,
      orderBy: { startedAt: 'DESC' },
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

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'Get workflow artifacts' })
  async getArtifacts(@Param('id') id: string) {
    return this.em.find(WorkflowArtifact, { workflow: id });
  }
}
