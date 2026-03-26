import { Controller, Post, Get, Body, Param, UseGuards, Req, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror } from '@ai-sdlc/db';
import { GateService } from './gate.service';
import { AuthGuard, RbacGuard, Roles } from '@ai-sdlc/feature-tenant';
import type { GateAction } from '@ai-sdlc/shared-type';

@ApiTags('gates')
@Controller('gates')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class GateController {
  constructor(
    private readonly gateService: GateService,
    private readonly em: EntityManager,
  ) {}

  private async assertWorkflowAccess(workflowId: string, tenantId: string): Promise<void> {
    const wf = await this.em.findOne(WorkflowMirror, { temporalWorkflowId: workflowId });
    if (!wf) throw new NotFoundException('Workflow not found');
    if ((wf.tenant as any)?.id !== tenantId && (wf.tenant as any) !== tenantId) {
      throw new ForbiddenException('Access denied to this workflow');
    }
  }

  @Post(':workflowId/decide')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Submit gate decision for a workflow' })
  async decide(
    @Req() req: any,
    @Param('workflowId') workflowId: string,
    @Body() body: { action: GateAction; reviewer: string; comment?: string },
  ) {
    await this.assertWorkflowAccess(workflowId, req.user.tenantId);
    const result = await this.gateService.submitDecision(
      workflowId,
      body.action,
      body.reviewer,
      body.comment,
    );
    if (result.isErr()) throw new InternalServerErrorException('Failed to submit decision');
    return result.value;
  }

  @Get(':workflowId/status')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow status' })
  async getStatus(@Req() req: any, @Param('workflowId') workflowId: string) {
    await this.assertWorkflowAccess(workflowId, req.user.tenantId);
    const result = await this.gateService.getWorkflowStatus(workflowId);
    if (result.isErr()) throw new NotFoundException('Workflow not found');
    return result.value;
  }

  @Post(':workflowId/cancel')
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel a workflow' })
  async cancel(
    @Req() req: any,
    @Param('workflowId') workflowId: string,
    @Body() body: { reason: string },
  ) {
    await this.assertWorkflowAccess(workflowId, req.user.tenantId);
    const result = await this.gateService.cancelWorkflow(workflowId, body.reason);
    if (result.isErr()) throw new InternalServerErrorException('Failed to cancel workflow');
    return { cancelled: true };
  }
}
