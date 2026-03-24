import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PinoLoggerService } from '@ai-sdlc/common';
import { CostAlert, AlertType, Tenant, WorkflowMirror, WorkflowStatus, AgentSession } from '@ai-sdlc/db';

@Injectable()
export class AlertService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('AlertService');
  }

  async checkStuckWorkflows(tenantId: string, staleMinutes = 120): Promise<CostAlert[]> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    const stuck = await this.em.find(WorkflowMirror, {
      tenant: tenantId,
      state: { $in: [WorkflowStatus.IMPLEMENTING, WorkflowStatus.CI_WATCH, WorkflowStatus.CI_FIXING, WorkflowStatus.IN_REVIEW] },
      updatedAt: { $lt: cutoff },
    });

    const alerts: CostAlert[] = [];
    for (const wf of stuck) {
      const existing = await this.em.findOne(CostAlert, {
        tenant: tenantId,
        alertType: AlertType.SYSTEM,
      });
      if (!existing) {
        const alert = new CostAlert();
        alert.tenant = this.em.getReference(Tenant, tenantId) as any;
        alert.alertType = AlertType.SYSTEM;
        alert.thresholdPct = 0;
        alert.actualUsd = Number(wf.costUsdTotal);
        alert.limitUsd = 0;
        this.em.persist(alert);
        alerts.push(alert);
      }
    }
    if (alerts.length) await this.em.flush();
    return alerts;
  }

  async checkQualityDegradation(tenantId: string): Promise<{ avgScore: number; recentScore: number; degraded: boolean }> {
    const allSessions = await this.em.find(AgentSession, {
      workflow: { tenant: tenantId },
      qualityScore: { $ne: null },
    }, { orderBy: { startedAt: 'DESC' }, limit: 100 });

    if (allSessions.length < 10) return { avgScore: 0, recentScore: 0, degraded: false };

    const allScores = allSessions.map(s => Number(s.qualityScore));
    const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const recentScores = allScores.slice(0, 10);
    const recentScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

    return { avgScore, recentScore, degraded: recentScore < avgScore * 0.7 };
  }

  async getProviderComparison(tenantId: string): Promise<Array<{ provider: string; avgQuality: number; avgCost: number; successRate: number; count: number }>> {
    const sessions = await this.em.find(AgentSession, {
      workflow: { tenant: tenantId },
    });

    const byProvider = new Map<string, { scores: number[]; costs: number[]; successes: number; total: number }>();
    for (const s of sessions) {
      const data = byProvider.get(s.provider) || { scores: [], costs: [], successes: 0, total: 0 };
      if (s.qualityScore != null) data.scores.push(Number(s.qualityScore));
      data.costs.push(Number(s.totalCostUsd));
      if (s.status === 'completed') data.successes++;
      data.total++;
      byProvider.set(s.provider, data);
    }

    return Array.from(byProvider.entries()).map(([provider, data]) => ({
      provider,
      avgQuality: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
      avgCost: data.costs.length ? data.costs.reduce((a, b) => a + b, 0) / data.costs.length : 0,
      successRate: data.total ? data.successes / data.total : 0,
      count: data.total,
    }));
  }
}
