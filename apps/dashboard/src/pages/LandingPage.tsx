import { Link } from '@tanstack/react-router';
import { isAuthenticated } from '../lib/auth';
import {
  GitBranch, Shield, Zap, BarChart3, Code2, Layers,
  ArrowRight, Workflow
} from 'lucide-react';

const FEATURES = [
  { icon: Workflow, title: 'Automated Workflows', desc: 'Label a ticket with ai-sdlc and watch it become a reviewed merge request — fully automated.' },
  { icon: Shield, title: 'Multi-tenant Security', desc: 'Row-level security, encrypted credentials, RBAC with role-based access control per tenant.' },
  { icon: Code2, title: 'AI Agent Sandbox', desc: 'AI agents code in isolated E2B Firecracker microVMs. Zero credentials leak. Full tool-use.' },
  { icon: BarChart3, title: 'Cost Control', desc: 'Per-tenant budgets, real-time cost tracking, automatic alerts when thresholds are reached.' },
  { icon: Zap, title: 'Provider Agnostic', desc: 'Works with any AI provider — Anthropic, OpenAI, or your own. Swap models without code changes.' },
  { icon: GitBranch, title: 'CI/CD Integration', desc: 'Automatic CI failure detection and self-healing. Gate approvals before merge. Full audit trail.' },
];

const STEPS = [
  { num: '01', title: 'Label', desc: 'Tag a task ticket with ai-sdlc in Jira, GitHub, GitLab, or Linear' },
  { num: '02', title: 'Orchestrate', desc: 'Webhook fires, Temporal workflow starts, budget is reserved' },
  { num: '03', title: 'Code', desc: 'AI agent codes in a sandboxed environment using MCP tools' },
  { num: '04', title: 'Review', desc: 'CI runs, failures auto-fix, human gate approval, merge request created' },
];

export function LandingPage() {
  const authed = isAuthenticated();

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-divider bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white">
              <Layers size={18} />
            </div>
            <span className="font-bold text-foreground">AI SDLC Orchestrator</span>
          </div>
          <div className="flex items-center gap-4">
            {authed ? (
              <Link to="/app" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-default-600 hover:text-foreground transition-colors">Sign in</Link>
                <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                  Get Started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Zap size={12} /> Open Source AI SDLC Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight">
            From ticket to<br />
            <span className="text-primary">merge request</span>,<br />
            automatically.
          </h1>
          <p className="mt-6 text-lg text-default-500 max-w-2xl mx-auto leading-relaxed">
            AI agents that code, test, and create pull requests from your task tickets.
            Multi-tenant, cost-controlled, and fully auditable.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to={authed ? '/app' : '/login'} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25">
              {authed ? 'Go to Dashboard' : 'Start Free'} <ArrowRight size={16} />
            </Link>
            <a href="https://github.com/nmime/ai-sdlc-orchestrator" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-default-100 text-foreground font-medium hover:bg-default-200 transition-colors">
              <GitBranch size={16} /> GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-default-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">How it works</h2>
            <p className="mt-3 text-default-500">Four simple steps from task to merge request</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((step) => (
              <div key={step.num} className="relative p-6 rounded-xl bg-background border border-divider">
                <span className="text-4xl font-bold text-primary/20">{step.num}</span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-default-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">Built for production SaaS</h2>
            <p className="mt-3 text-default-500">Everything you need to run AI-powered development at scale</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-divider hover:border-primary/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-default-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-primary">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Ready to automate your SDLC?</h2>
          <p className="mt-4 text-white/70">Deploy on your infrastructure in minutes. Open source, MIT licensed.</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to={authed ? '/app' : '/login'} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary font-medium hover:bg-white/90 transition-colors">
              {authed ? 'Dashboard' : 'Get Started'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-divider py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-default-400">
            <Layers size={16} /> AI SDLC Orchestrator
          </div>
          <div className="flex items-center gap-6 text-sm text-default-400">
            <a href="https://github.com/nmime/ai-sdlc-orchestrator" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://github.com/nmime/ai-sdlc-orchestrator/blob/main/LICENSE" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">MIT License</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
