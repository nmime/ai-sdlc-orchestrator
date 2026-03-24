import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GateService } from './gate.service';
import type { GateAction } from '@ai-sdlc/shared-type';

@ApiTags('gates')
@Controller('gates')
@ApiBearerAuth()
export class GateController {
  constructor(private readonly gateService: GateService) {}

  @Post(':workflowId/decide')
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
