import { Controller, Post, Get, Body, Param, UseGuards, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GateService } from './gate.service';
import { AuthGuard } from '@ai-sdlc/feature-tenant';
import { RbacGuard } from '@ai-sdlc/feature-tenant';
import { Roles } from '@ai-sdlc/feature-tenant';
import type { GateAction } from '@ai-sdlc/shared-type';

@ApiTags('gates')
@Controller('gates')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class GateController {
  constructor(private readonly gateService: GateService) {}

  @Post(':workflowId/decide')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Submit gate decision for a workflow' })
  async decide(
    @Param('workflowId') workflowId: string,
    @Body() body: { action: GateAction; reviewer: string; comment?: string },
  ) {
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
  async getStatus(@Param('workflowId') workflowId: string) {
    const result = await this.gateService.getWorkflowStatus(workflowId);
    if (result.isErr()) throw new NotFoundException('Workflow not found');
    return result.value;
  }

  @Post(':workflowId/cancel')
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel a workflow' })
  async cancel(
    @Param('workflowId') workflowId: string,
    @Body() body: { reason: string },
  ) {
    const result = await this.gateService.cancelWorkflow(workflowId, body.reason);
    if (result.isErr()) throw new InternalServerErrorException('Failed to cancel workflow');
    return { cancelled: true };
  }
}
