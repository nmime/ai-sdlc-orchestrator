import { Link } from '@tanstack/react-router';
import { isAuthenticated } from '../lib/auth';
import {
  GitBranch, Shield, Zap, BarChart3, Code2, Layers,
  ArrowRight, Workflow, Terminal, Globe, Lock, Cpu,
  CheckCircle2, ChevronRight, Star, Users, Clock,
  Sparkles, ExternalLink, Check, X
} from 'lucide-react';
import { GitHubIcon } from '../components/GitHubIcon';
import { useState, useEffect } from 'react';

const FEATURES = [
  { icon: Workflow, title: 'Durable Workflows', desc: 'Temporal-powered workflows that survive crashes. Automatic retries, timeouts, and state management built in.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'Row-level tenant isolation, encrypted credential proxy, RBAC, and zero-trust sandboxing with Firecracker microVMs.' },
  { icon: Code2, title: 'AI Agent Sandbox', desc: 'Agents code in isolated E2B microVMs with full MCP tool access. No credentials leak — ever.' },
  { icon: BarChart3, title: 'Cost Intelligence', desc: 'Per-tenant budgets with real-time tracking, automatic alerts at configurable thresholds, and detailed breakdowns.' },
  { icon: Zap, title: 'Provider Agnostic', desc: 'Anthropic, OpenAI, or your own models. Swap providers via config — zero code changes required.' },
  { icon: GitBranch, title: 'Self-Healing CI', desc: 'CI failures automatically feed back to the agent for fix loops. Human gates before merge. Full audit trail.' },
  { icon: Globe, title: 'Multi-Platform', desc: 'Native integrations with GitHub, GitLab, Jira, and Linear via MCP servers. Works with your existing toolchain.' },
  { icon: Lock, title: 'Credential Proxy', desc: 'Encrypted credential injection without exposing secrets to agents. Audit every access, revoke instantly.' },
  { icon: Users, title: 'Multi-Tenant', desc: 'Full tenant isolation with per-org config, separate budgets, API keys, and webhook endpoints.' },
];

const STEPS = [
  { num: '01', title: 'Label a Ticket', desc: 'Tag any task with opwerf in Jira, GitHub Issues, GitLab, or Linear', icon: Terminal, color: 'from-blue-500 to-indigo-500' },
  { num: '02', title: 'Orchestrate', desc: 'Webhook fires → Temporal workflow starts → budget reserved → sandbox provisioned', icon: Workflow, color: 'from-indigo-500 to-purple-500' },
  { num: '03', title: 'Agent Codes', desc: 'AI agent writes code, runs tests, and iterates in an isolated sandbox via MCP', icon: Cpu, color: 'from-purple-500 to-pink-500' },
  { num: '04', title: 'Review & Merge', desc: 'CI runs, failures auto-fix, human gate approval, pull request created', icon: CheckCircle2, color: 'from-pink-500 to-rose-500' },
];

const PRICING = [
  {
    name: 'Open Source',
    price: 'Free',
    period: 'forever',
    desc: 'Self-hosted, full feature set',
    features: ['Unlimited tenants', 'All integrations', 'Temporal workflows', 'E2B sandboxing', 'Community support', 'MIT License'],
    excluded: ['Managed hosting', 'SLA guarantees', 'Priority support'],
    cta: 'Deploy Now',
    ctaLink: 'https://github.com/opwerf/opwerf',
    highlight: false,
  },
  {
    name: 'Cloud',
    price: '$49',
    period: '/seat/month',
    desc: 'Managed, zero maintenance',
    features: ['Everything in Open Source', 'Managed infrastructure', '99.9% uptime SLA', 'Auto-scaling', 'Priority support', 'SOC 2 compliance'],
    excluded: [],
    cta: 'Start Free Trial',
    ctaLink: '/login',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'Dedicated, air-gapped, compliant',
    features: ['Everything in Cloud', 'Dedicated infrastructure', 'Custom SLAs', 'Air-gapped deployment', 'SSO/SAML', 'Dedicated support engineer'],
    excluded: [],
    cta: 'Contact Sales',
    ctaLink: 'mailto:sales@opwerf.dev',
    highlight: false,
  },
];

const STATS = [
  { value: '10x', label: 'Faster ticket resolution' },
  { value: '90%', label: 'Less manual coding' },
  { value: '0', label: 'Credential leaks' },
  { value: '<5min', label: 'Deploy time' },
];

const LOGOS = ['NestJS', 'Temporal', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'React', 'TypeScript'];

function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  return <span className="tabular-nums">{target}{suffix}</span>;
}

export function LandingPage() {
  const authed = isAuthenticated();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-full bg-background">
      <header className={`border-b sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'border-divider bg-background/90 backdrop-blur-xl shadow-sm' : 'border-transparent bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg shadow-primary/20">
              <Layers size={18} />
            </div>
            <span className="font-bold text-foreground text-lg">Opwerf</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-default-600">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">Docs <ExternalLink size={12} /></a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-default-100 transition-colors text-default-500">
              <GitHubIcon size={20} />
            </a>
            {authed ? (
              <Link to="/app" className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-default-600 hover:text-foreground hover:bg-default-100 transition-colors">
                  Sign in
                </Link>
                <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                  Get Started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-primary/8 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-40 -right-40 w-[400px] h-[400px] bg-purple-500/5 blur-3xl rounded-full" />
        <div className="absolute top-60 -left-40 w-[400px] h-[400px] bg-blue-500/5 blur-3xl rounded-full" />

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-slide-up">
            <Sparkles size={14} />
            Open Source · MIT Licensed · Self-Hosted or Cloud
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-foreground leading-[1.05] tracking-tight animate-slide-up">
            From ticket to<br />
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">merge request</span>,<br />
            fully autonomous.
          </h1>

          <p className="mt-8 text-lg sm:text-xl text-default-500 max-w-2xl mx-auto leading-relaxed animate-slide-up">
            AI agents that code, test, and create pull requests from your task tickets.
            Multi-tenant, cost-controlled, sandbox-isolated, and fully auditable.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link to={authed ? '/app' : '/login'} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold text-lg hover:opacity-90 transition-all shadow-xl shadow-primary/25 hover:-translate-y-0.5">
              {authed ? 'Go to Dashboard' : 'Start Free'} <ArrowRight size={18} />
            </Link>
            <a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-divider text-foreground font-semibold text-lg hover:bg-default-100 transition-all hover:-translate-y-0.5">
              <GitHubIcon size={18} /> View Source
            </a>
          </div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-default-600 bg-clip-text text-transparent">
                  <AnimatedCounter target={s.value} />
                </p>
                <p className="text-sm text-default-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 border-y border-divider bg-default-50/50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs text-default-400 uppercase tracking-widest mb-6">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {LOGOS.map((name) => (
              <span key={name} className="text-sm font-medium text-default-400 hover:text-default-600 transition-colors">{name}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Four steps to autonomous dev</h2>
            <p className="mt-4 text-lg text-default-500 max-w-xl mx-auto">From ticket label to reviewed pull request in minutes, not days.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative group">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-6 z-10">
                    <ChevronRight size={20} className="text-default-300 -translate-x-3" />
                  </div>
                )}
                <div className="p-8 rounded-2xl bg-background border border-divider hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 h-full">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                    <step.icon size={24} className="text-white" />
                  </div>
                  <span className="text-6xl font-bold text-default-100 absolute top-4 right-6">{step.num}</span>
                  <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm text-default-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-28 px-6 bg-default-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Built for production SaaS</h2>
            <p className="mt-4 text-lg text-default-500 max-w-xl mx-auto">Everything you need to run AI-powered development at scale</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-background border border-divider hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-4 group-hover:from-primary/20 group-hover:to-purple-500/20 transition-colors">
                  <f.icon size={24} className="text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-default-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Security</p>
              <h2 className="text-4xl font-bold text-foreground">Zero trust sandboxing</h2>
              <p className="mt-4 text-lg text-default-500 leading-relaxed">
                AI agents code inside isolated Firecracker microVMs powered by E2B. Credentials never enter the sandbox — they're proxied through an encrypted credential proxy with full audit logging.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: Lock, text: 'Credential proxy ensures zero secret leaks' },
                  { icon: Globe, text: 'MCP server policy controls tool access' },
                  { icon: Shield, text: 'Row-level security isolates tenant data' },
                  { icon: Clock, text: 'Automatic sandbox timeout and cleanup' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon size={16} className="text-primary" />
                    </div>
                    <span className="text-default-600">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-background border border-divider rounded-2xl p-6 shadow-2xl shadow-primary/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-danger" />
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="ml-2 text-xs text-default-400 font-mono">sandbox-session.log</span>
                </div>
                <pre className="text-xs font-mono text-default-600 leading-relaxed overflow-hidden">
{`[orchestrator] Webhook received: github/issues.labeled
[orchestrator] Tenant: acme-corp (budget: $240/$500)
[orchestrator] Starting workflow: fix-auth-middleware
[temporal]     Workflow wf-8a3c started
[sandbox]      Provisioning E2B microVM...
[sandbox]      MCP tools: [github, filesystem, terminal]
[credential]   Proxying VCS token (audit: log-9f2b)
[agent]        Claude analyzing issue #142...
[agent]        Creating branch: opwerf/fix-auth-142
[agent]        Modified 3 files, added 2 tests
[agent]        Running test suite... ✓ 47 passed
[sandbox]      Terminated (duration: 184s, cost: $0.42)
[gate]         Awaiting human approval...
[gate]         Approved by @sarah (comment: "LGTM")
[workflow]     PR #143 created → CI running...
[workflow]     ✓ CI passed — ready to merge`}</pre>
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-28 px-6 bg-default-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-default-500">Start free with self-hosted, or let us manage everything</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((plan) => (
              <div key={plan.name} className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.highlight
                  ? 'border-primary bg-background shadow-2xl shadow-primary/10 scale-[1.02]'
                  : 'border-divider bg-background hover:border-primary/30 hover:shadow-lg'
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-default-400 text-sm">{plan.period}</span>}
                </div>
                <p className="mt-2 text-sm text-default-500">{plan.desc}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-default-600">
                      <Check size={16} className="text-success flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                  {plan.excluded.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-default-400">
                      <X size={16} className="flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.ctaLink.startsWith('/') ? (
                  <Link to={plan.ctaLink} className={`mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-primary to-purple-600 text-white hover:opacity-90 shadow-lg shadow-primary/25'
                      : 'border border-divider text-foreground hover:bg-default-100'
                  }`}>
                    {plan.cta} <ArrowRight size={14} />
                  </Link>
                ) : (
                  <a href={plan.ctaLink} target={plan.ctaLink.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-primary to-purple-600 text-white hover:opacity-90 shadow-lg shadow-primary/25'
                      : 'border border-divider text-foreground hover:bg-default-100'
                  }`}>
                    {plan.cta} <ArrowRight size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white mb-8 shadow-xl shadow-primary/20">
            <Sparkles size={28} />
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Ready to automate your SDLC?</h2>
          <p className="mt-6 text-lg text-default-500 max-w-xl mx-auto">
            Deploy in under 5 minutes. No credit card required for open source.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={authed ? '/app' : '/login'} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold text-lg hover:opacity-90 transition-all shadow-xl shadow-primary/25 hover:-translate-y-0.5">
              {authed ? 'Open Dashboard' : 'Start Building'} <ArrowRight size={18} />
            </Link>
            <a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-divider text-foreground font-semibold text-lg hover:bg-default-100 transition-all hover:-translate-y-0.5">
              <Star size={18} /> Star on GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-divider py-12 px-6 bg-default-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <span className="font-bold text-foreground">Opwerf</span>
              </div>
              <p className="text-sm text-default-400 leading-relaxed">Autonomous software development lifecycle orchestration platform.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-default-500 hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-default-500 hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="text-sm text-default-500 hover:text-foreground transition-colors">How it works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Resources</h4>
              <ul className="space-y-2">
                <li><a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="text-sm text-default-500 hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="text-sm text-default-500 hover:text-foreground transition-colors">GitHub</a></li>
                <li><a href="https://github.com/opwerf/opwerf/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer" className="text-sm text-default-500 hover:text-foreground transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-default-500 hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-default-500 hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="https://github.com/opwerf/opwerf/blob/main/LICENSE" target="_blank" rel="noreferrer" className="text-sm text-default-500 hover:text-foreground transition-colors">MIT License</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-default-400">© {new Date().getFullYear()} Opwerf. Open source under MIT license.</p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/opwerf/opwerf" target="_blank" rel="noreferrer" className="text-default-400 hover:text-foreground transition-colors">
                <GitHubIcon size={18} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
