import { Controller, Sse, Query, MessageEvent, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowEvent } from '@app/db';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { Observable, interval, exhaustMap, map, from, EMPTY } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';

@ApiTags('sse')
@Controller('sse')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class SseController {
  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Sse('events')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Server-Sent Events for workflow updates' })
  events(@Query('tenantId') tenantId: string): Observable<MessageEvent> {
    if (!tenantId) {
      return EMPTY;
    }

    let lastEventId: string | undefined;
    const pollInterval = parseInt(this.configService.get('SSE_POLL_INTERVAL_MS', { infer: true }) || '5000', 10);

    return interval(pollInterval).pipe(
      exhaustMap(() => {
        const fork = this.em.fork();
        const where: Record<string, unknown> = { 'workflow.tenant': tenantId };
        if (lastEventId) where['id'] = { $gt: lastEventId };

        return from(fork.find(WorkflowEvent, where, {
          orderBy: { createdAt: 'ASC' },
          limit: 50,
        }));
      }),
      exhaustMap(events => {
        if (events.length > 0) {
          lastEventId = events[events.length - 1]!.id;
        }
        return from(events);
      }),
      map(event => ({
        data: JSON.stringify({
          id: event.id,
          eventType: event.eventType,
          fromState: event.fromState,
          toState: event.toState,
          payload: event.payload,
          createdAt: event.createdAt,
        }),
        type: event.eventType,
        id: event.id,
      })),
    );
  }
}
