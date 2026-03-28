import { Controller, Post, Get, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GateService } from './gate.service';
import { ResultUtils } from '@app/common';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { GateDecisionDto, GateCommentDto, GateRequireCommentDto, CancelWorkflowDto } from '@app/feature-tenant';
import type { GateAction } from '@app/shared-type';
import type { FastifyRequest } from 'fastify';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror } from '@app/db';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

@ApiTags('gates')
@Controller('gates')
@ApiBearerAuth()
export class GateController {
  constructor(
    private readonly gateService: GateService,
    private readonly em: EntityManager,
  ) {}

  private async verifyWorkflowTenant(workflowId: string, req: AuthenticatedRequest): Promise<void> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: workflowId, tenant: tenantId });
  }

  @Post(':workflowId/decide')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Submit gate decision for a workflow' })
  async decide(
    @Param('workflowId') workflowId: string,
    @Body() body: GateDecisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyWorkflowTenant(workflowId, req);
    return ResultUtils.unwrapOrThrow(await this.gateService.submitDecision(workflowId, body.action as GateAction, body.reviewer, body.comment));
  }

  @Post(':workflowId/approve')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Approve a workflow gate' })
  async approve(
    @Param('workflowId') workflowId: string,
    @Body() body: GateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyWorkflowTenant(workflowId, req);
    const reviewer = req.user.email || req.user.id;
    return ResultUtils.unwrapOrThrow(await this.gateService.submitDecision(workflowId, 'approve', reviewer, body.comment));
  }

  @Post(':workflowId/request-changes')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Request changes on a workflow' })
  async requestChanges(
    @Param('workflowId') workflowId: string,
    @Body() body: GateRequireCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyWorkflowTenant(workflowId, req);
    const reviewer = req.user.email || req.user.id;
    return ResultUtils.unwrapOrThrow(await this.gateService.submitDecision(workflowId, 'request_changes', reviewer, body.comment));
  }

  @Get(':workflowId/status')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow status' })
  async getStatus(@Param('workflowId') workflowId: string, @Req() req: AuthenticatedRequest) {
    await this.verifyWorkflowTenant(workflowId, req);
    return ResultUtils.unwrapOrThrow(await this.gateService.getWorkflowStatus(workflowId));
  }

  @Post(':workflowId/cancel')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel a workflow' })
  async cancel(
    @Param('workflowId') workflowId: string,
    @Body() body: CancelWorkflowDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyWorkflowTenant(workflowId, req);
    ResultUtils.unwrapOrThrow(await this.gateService.cancelWorkflow(workflowId, body.reason));
    return { cancelled: true };
  }
}
