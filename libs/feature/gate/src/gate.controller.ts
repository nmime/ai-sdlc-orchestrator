import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GateService } from './gate.service';
import { AuthGuard, RbacGuard, Roles } from '@ai-sdlc/feature-tenant';
import type { GateAction } from '@ai-sdlc/shared-type';

@ApiTags('gates')
@Controller('gates')
@ApiBearerAuth()
export class GateController {
  constructor(private readonly gateService: GateService) {}

  @Post(':workflowId/decide')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Submit gate decision for a workflow' })
  async decide(
    @Param('workflowId') workflowId: string,
    @Body() body: { action: GateAction; reviewer: string; comment?: string },
  ) {
    const result = await this.gateService.submitDecision(workflowId, body.action, body.reviewer, body.comment);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Post(':workflowId/approve')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Approve a workflow gate' })
  async approve(
    @Param('workflowId') workflowId: string,
    @Body() body: { comment?: string },
    @Req() req: any,
  ) {
    const reviewer = req.user?.email || req.user?.id || 'unknown';
    const result = await this.gateService.submitDecision(workflowId, 'approve', reviewer, body.comment);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Post(':workflowId/request-changes')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Request changes on a workflow' })
  async requestChanges(
    @Param('workflowId') workflowId: string,
    @Body() body: { comment: string },
    @Req() req: any,
  ) {
    const reviewer = req.user?.email || req.user?.id || 'unknown';
    const result = await this.gateService.submitDecision(workflowId, 'request_changes', reviewer, body.comment);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get(':workflowId/status')
  @ApiOperation({ summary: 'Get workflow status' })
  async getStatus(@Param('workflowId') workflowId: string) {
    const result = await this.gateService.getWorkflowStatus(workflowId);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Post(':workflowId/cancel')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel a workflow' })
  async cancel(
    @Param('workflowId') workflowId: string,
    @Body() body: { reason: string },
  ) {
    const result = await this.gateService.cancelWorkflow(workflowId, body.reason);
    if (result.isErr()) throw new Error(result.error.message);
    return { cancelled: true };
  }
}
