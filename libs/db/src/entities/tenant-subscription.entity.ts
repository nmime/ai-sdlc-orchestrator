import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum SubscriptionPlan {
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

@Entity({ tableName: 'tenant_subscription' })
@Index({ properties: ['tenant'] })
export class TenantSubscription {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Enum(() => SubscriptionPlan)
  plan: SubscriptionPlan = SubscriptionPlan.STARTER;

  @Enum(() => SubscriptionStatus)
  status: SubscriptionStatus = SubscriptionStatus.ACTIVE;

  @Property({ nullable: true })
  stripeCustomerId?: string;

  @Property({ nullable: true })
  stripeSubscriptionId?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monthlyPriceUsd: number = 0;

  @Property({ nullable: true })
  currentPeriodStart?: Date;

  @Property({ nullable: true })
  currentPeriodEnd?: Date;

  @Property({ nullable: true })
  cancelledAt?: Date;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
