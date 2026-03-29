import { Injectable } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Result } from 'neverthrow';
import { ResultUtils, type PinoLoggerService } from '@app/common';
import type { AppError } from '@app/common';
import { TenantSubscription, SubscriptionPlan, SubscriptionStatus, Tenant } from '@app/db';

export interface PlanDetails {
  plan: SubscriptionPlan;
  name: string;
  priceUsd: number;
  features: string[];
  limits: { workflows: number; sandboxes: number; budgetUsd: number };
}

const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
  [SubscriptionPlan.STARTER]: {
    plan: SubscriptionPlan.STARTER,
    name: 'Starter',
    priceUsd: 0,
    features: ['5 workflows/month', '1 concurrent sandbox', '$50 AI budget', 'Community support'],
    limits: { workflows: 5, sandboxes: 1, budgetUsd: 50 },
  },
  [SubscriptionPlan.PRO]: {
    plan: SubscriptionPlan.PRO,
    name: 'Pro',
    priceUsd: 49,
    features: ['Unlimited workflows', '5 concurrent sandboxes', '$500 AI budget', 'Priority support', 'Custom DSL templates', 'Webhook integrations'],
    limits: { workflows: -1, sandboxes: 5, budgetUsd: 500 },
  },
  [SubscriptionPlan.ENTERPRISE]: {
    plan: SubscriptionPlan.ENTERPRISE,
    name: 'Enterprise',
    priceUsd: -1,
    features: ['Unlimited everything', 'Dedicated infrastructure', 'Custom AI budget', '24/7 support', 'SSO/SAML', 'SLA guarantee', 'Audit logs'],
    limits: { workflows: -1, sandboxes: -1, budgetUsd: -1 },
  },
};

@Injectable()
export class BillingService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('BillingService');
  }

  getPlans(): PlanDetails[] {
    return Object.values(PLAN_DETAILS);
  }

  async getSubscription(tenantId: string): Promise<Result<TenantSubscription, AppError>> {
    let sub = await this.em.findOne(TenantSubscription, { tenant: tenantId });
    if (!sub) {
      sub = new TenantSubscription();
      sub.tenant = this.em.getReference(Tenant, tenantId);
      sub.plan = SubscriptionPlan.STARTER;
      sub.status = SubscriptionStatus.ACTIVE;
      sub.monthlyPriceUsd = 0;
      sub.currentPeriodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      sub.currentPeriodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      await this.em.persistAndFlush(sub);
    }
    return ResultUtils.ok(sub);
  }

  async changePlan(tenantId: string, plan: SubscriptionPlan): Promise<Result<TenantSubscription, AppError>> {
    const subResult = await this.getSubscription(tenantId);
    if (subResult.isErr()) return subResult;

    const sub = subResult.value;
    const planDetails = PLAN_DETAILS[plan];
    if (!planDetails) return ResultUtils.err('VALIDATION_ERROR', `Unknown plan: ${plan}`);

    sub.plan = plan;
    sub.monthlyPriceUsd = planDetails.priceUsd;
    await this.em.flush();

    this.logger.log(`Tenant ${tenantId} changed plan to ${plan}`);
    return ResultUtils.ok(sub);
  }
}
