import { useQuery } from '@tanstack/react-query';
import { Card, Button, Chip, ProgressBar } from '@heroui/react';
import { apiFetch, getTenantId, isDemoMode } from '../lib/api';
import { CreditCard, Zap, Building2, Crown, Check, ArrowUpRight } from 'lucide-react';

interface CostData {
  totalCostUsd: number;
  limitUsd: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  workflowCount: number;
}

const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    description: 'Perfect for individual developers',
    features: ['5 workflows/month', '1 concurrent sandbox', '$50 AI budget', 'Community support'],
    current: false,
    cta: 'Current Plan',
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For growing teams and projects',
    features: ['Unlimited workflows', '5 concurrent sandboxes', '$500 AI budget', 'Priority support', 'Custom DSL templates', 'Webhook integrations'],
    current: true,
    cta: 'Current Plan',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organizations at scale',
    features: ['Unlimited everything', 'Dedicated infrastructure', 'Custom AI budget', '24/7 support', 'SSO/SAML', 'SLA guarantee', 'Audit logs'],
    current: false,
    cta: 'Contact Sales',
  },
];

export function BillingPage() {
  const tenantId = getTenantId();

  const { data: costs } = useQuery({
    queryKey: ['costs', tenantId],
    queryFn: () => apiFetch<CostData>(`/costs/tenants/${tenantId}`),
  });

  const usagePercent = costs && costs.limitUsd > 0 ? (costs.totalCostUsd / costs.limitUsd) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-sm text-default-500 mt-1">
          Manage your plan, usage, and payment methods
          {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <Card.Content className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-default-500 uppercase tracking-wider">Current Plan</p>
                <p className="text-2xl font-bold text-foreground mt-1">Pro</p>
                <p className="text-xs text-default-400 mt-0.5">$49/month</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown size={20} className="text-primary" />
              </div>
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-default-500 uppercase tracking-wider">This Month</p>
                <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">${costs?.totalCostUsd.toFixed(2) ?? '0.00'}</p>
                <p className="text-xs text-default-400 mt-0.5">of ${costs?.limitUsd.toFixed(0) ?? '500'} budget</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CreditCard size={20} className="text-success" />
              </div>
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-default-500 uppercase tracking-wider">Next Invoice</p>
                <p className="text-2xl font-bold text-foreground mt-1">Apr 1</p>
                <p className="text-xs text-default-400 mt-0.5">Auto-renewal</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Zap size={20} className="text-warning" />
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      {costs && (
        <Card>
          <Card.Header>
            <Card.Title>Usage This Period</Card.Title>
            <Card.Description>Current billing cycle: Mar 1 — Mar 31, 2026</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-default-600">Budget utilization</span>
              <span className="text-sm font-medium text-foreground tabular-nums">{usagePercent.toFixed(1)}%</span>
            </div>
            <ProgressBar value={Math.min(usagePercent, 100)} color={usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : 'success'}>
              <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
            </ProgressBar>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center p-3 rounded-xl bg-default-50">
                <p className="text-xl font-bold text-foreground tabular-nums">{costs.workflowCount}</p>
                <p className="text-xs text-default-500">Workflows</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-default-50">
                <p className="text-xl font-bold text-foreground tabular-nums">${costs.aiCostUsd.toFixed(2)}</p>
                <p className="text-xs text-default-500">AI Cost</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-default-50">
                <p className="text-xl font-bold text-foreground tabular-nums">${costs.sandboxCostUsd.toFixed(2)}</p>
                <p className="text-xs text-default-500">Sandbox Cost</p>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <Card key={plan.name} className={plan.highlighted ? 'ring-2 ring-primary' : ''}>
              <Card.Header>
                <div className="flex items-center justify-between w-full">
                  <Card.Title>{plan.name}</Card.Title>
                  {plan.current && <Chip color="accent" variant="soft" size="sm">Current</Chip>}
                </div>
                <Card.Description>{plan.description}</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div>
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-default-400">{plan.period}</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-default-600">
                      <Check size={14} className="text-success flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </Card.Content>
              <Card.Footer>
                <Button variant={plan.current ? 'secondary' : plan.highlighted ? 'primary' : 'outline'} className="w-full" isDisabled={plan.current}>
                  {plan.cta} {!plan.current && <ArrowUpRight size={14} className="ml-1" />}
                </Button>
              </Card.Footer>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            <Card.Title>Payment Method</Card.Title>
          </div>
          <Card.Description>Manage how you pay for your subscription</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex items-center justify-between p-4 rounded-xl bg-default-50 border border-divider">
            <div className="flex items-center gap-3">
              <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">VISA</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">•••• •••• •••• 4242</p>
                <p className="text-xs text-default-400">Expires 12/2028</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Update</Button>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Invoice History</Card.Title>
          <Card.Description>Download past invoices for your records</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-default-500 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-default-500 uppercase">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-default-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-default-500 uppercase">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {[{ date: 'Mar 1, 2026', amount: '$49.00', status: 'paid' }, { date: 'Feb 1, 2026', amount: '$49.00', status: 'paid' }, { date: 'Jan 1, 2026', amount: '$49.00', status: 'paid' }].map((inv, i) => (
                  <tr key={i} className="hover:bg-default-50">
                    <td className="px-4 py-2.5 text-sm text-foreground">{inv.date}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground tabular-nums">{inv.amount}</td>
                    <td className="px-4 py-2.5"><Chip color="success" variant="soft" size="sm">{inv.status}</Chip></td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm">Download</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
