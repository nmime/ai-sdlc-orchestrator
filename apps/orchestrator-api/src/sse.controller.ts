import { Controller, Sse, Query, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowEvent } from '@ai-sdlc/db';
import { Observable, interval, switchMap, map, from } from 'rxjs';

@ApiTags('sse')
@Controller('sse')
export class SseController {
  constructor(private readonly em: EntityManager) {}

  @Sse('events')
  @ApiOperation({ summary: 'Server-Sent Events for workflow updates' })
  events(@Query('tenantId') tenantId?: string): Observable<MessageEvent> {
    let lastEventId: string | undefined;

    return interval(5000).pipe(
      switchMap(() => {
        const fork = this.em.fork();
        const where: Record<string, unknown> = {};
        if (tenantId) where['workflow.tenant'] = tenantId;
        if (lastEventId) where['id'] = { $gt: lastEventId };

        return from(fork.find(WorkflowEvent, where, {
          orderBy: { createdAt: 'ASC' },
          limit: 50,
        }));
      }),
      switchMap(events => {
        if (events.length > 0) {
          lastEventId = events[events.length - 1].id;
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
