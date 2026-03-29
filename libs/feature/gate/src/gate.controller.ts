import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { GateService } from './gate.service';
import { ResultUtils } from '@app/common';
import { AuthGuard, RbacGuard, Roles, TenantId, CurrentUser, type AuthenticatedUser } from '@app/feature-tenant';
import type { GateDecisionDto, GateCommentDto, GateRequireCommentDto, CancelWorkflowDto } from '@app/feature-tenant';
import type { GateAction } from '@app/shared-type';
import type { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror } from '@app/db';

@ApiTags('gates')
@Controller('gates')
@ApiBearerAuth()
export class GateController {
  constructor(
    private readonly gateService: GateService,
    private readonly em: EntityManager,
  ) {}

  private async verifyWorkflowTenant(workflowId: string, tenantId: string): Promise<void> {
    await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: workflowId, tenant: tenantId });
  }

  @Post(':workflowId/decide')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Submit gate decision for a workflow' })
  async decide(
    @Param('workflowId') workflowId: string,
    @Body() body: GateDecisionDto,
    @TenantId() tenantId: string,
  ) {
    await this.verifyWorkflowTenant(workflowId, tenantId);
    return ResultUtils.unwrapOrThrow(await this.gateService.submitDecision(workflowId, body.action as GateAction, body.reviewer, body.comment));
  }

  @Post(':workflowId/approve')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Approve a workflow gate' })
  async approve(
    @Param('workflowId') workflowId: string,
    @Body() body: GateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
    @TenantId() tenantId: string,
  ) {
    await this.verifyWorkflowTenant(workflowId, tenantId);
    const reviewer = user.email || user.id;
    return ResultUtils.unwrapOrThrow(await this.gateService.submitDecision(workflowId, 'approve', reviewer, body.comment));
  }

  @Post(':workflowId/request-changes')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Request changes on a workflow' })
  async requestChanges(
    @Param('workflowId') workflowId: string,
    @Body() body: GateRequireCommentDto,
    @CurrentUser() user: AuthenticatedUser,
    @TenantId() tenantId: string,
  ) {
    await this.verifyWorkflowTenant(workflowId, tenantId);
    const reviewer = user.email || user.id;
    return ResultUtils.unwrapOrThrow(await this.gateService.submitDecision(workflowId, 'request_changes', reviewer, body.comment));
  }

  @Get(':workflowId/status')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get workflow status' })
  async getStatus(@Param('workflowId') workflowId: string, @TenantId() tenantId: string) {
    await this.verifyWorkflowTenant(workflowId, tenantId);
    return ResultUtils.unwrapOrThrow(await this.gateService.getWorkflowStatus(workflowId));
  }

  @Post(':workflowId/cancel')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel a workflow' })
  async cancel(
    @Param('workflowId') workflowId: string,
    @Body() body: CancelWorkflowDto,
    @TenantId() tenantId: string,
  ) {
    await this.verifyWorkflowTenant(workflowId, tenantId);
    ResultUtils.unwrapOrThrow(await this.gateService.cancelWorkflow(workflowId, body.reason));
    return { cancelled: true };
  }
}
