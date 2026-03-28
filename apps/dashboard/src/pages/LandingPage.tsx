import { Link } from '@tanstack/react-router';
import { isAuthenticated } from '../lib/auth';
import {
  GitBranch, Shield, Zap, BarChart3, Code2, Layers,
  ArrowRight, Workflow, Terminal, Globe, Lock, Cpu,
  CheckCircle2
} from 'lucide-react';
import { GitHubIcon } from '../components/GitHubIcon';

const FEATURES = [
  { icon: Workflow, title: 'Automated Workflows', desc: 'Label a ticket with ai-sdlc and watch it become a reviewed merge request — fully automated.' },
  { icon: Shield, title: 'Multi-tenant Security', desc: 'Row-level security, encrypted credentials, RBAC with role-based access control per tenant.' },
  { icon: Code2, title: 'AI Agent Sandbox', desc: 'AI agents code in isolated E2B Firecracker microVMs. Zero credentials leak. Full tool-use via MCP.' },
  { icon: BarChart3, title: 'Cost Control', desc: 'Per-tenant budgets with optimistic concurrency, real-time cost tracking, automatic alerts.' },
  { icon: Zap, title: 'Provider Agnostic', desc: 'Works with any AI provider — Anthropic, OpenAI, or your own. Swap models without code changes.' },
  { icon: GitBranch, title: 'CI/CD Integration', desc: 'Automatic CI failure detection and self-healing loop. Gate approvals before merge. Full audit trail.' },
];

const STEPS = [
  { num: '01', title: 'Label', desc: 'Tag a task ticket with ai-sdlc in Jira, GitHub, GitLab, or Linear', icon: Terminal },
  { num: '02', title: 'Orchestrate', desc: 'Webhook fires, Temporal workflow starts, budget is reserved', icon: Workflow },
  { num: '03', title: 'Code', desc: 'AI agent codes in a sandboxed environment using MCP tools', icon: Cpu },
  { num: '04', title: 'Review', desc: 'CI runs, failures auto-fix, human gate approval, MR created', icon: CheckCircle2 },
];

const TECH_STACK = [
  'NestJS', 'Temporal', 'PostgreSQL', 'Redis',
  'MikroORM', 'React', 'Docker', 'Kubernetes',
];

export function LandingPage() {
  const authed = isAuthenticated();

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-divider bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white">
              <Layers size={18} />
            </div>
            <span className="font-bold text-foreground text-lg">AI SDLC</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-default-600">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#tech" className="hover:text-foreground transition-colors">Tech Stack</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="https://github.com/nmime/ai-sdlc-orchestrator" target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-default-100 transition-colors text-default-500">
              <GitHubIcon size={20} />
            </a>
            {authed ? (
              <Link to="/app" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                Get Started <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-slide-up">
            <Zap size={14} /> Open Source &middot; MIT Licensed &middot; Self-Hosted
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-foreground leading-[1.1] tracking-tight animate-slide-up">
            From ticket to<br />
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">merge request</span>,<br />
            automatically.
          </h1>
          <p className="mt-8 text-xl text-default-500 max-w-2xl mx-auto leading-relaxed animate-slide-up">
            AI agents that code, test, and create pull requests from your task tickets.
            Multi-tenant, cost-controlled, and fully auditable.
          </p>
          <div className="mt-12 flex items-center justify-center gap-4 animate-slide-up">
            <Link to={authed ? '/app' : '/login'} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
              {authed ? 'Go to Dashboard' : 'Start Free'} <ArrowRight size={18} />
            </Link>
            <a href="https://github.com/nmime/ai-sdlc-orchestrator" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-divider text-foreground font-semibold text-lg hover:bg-default-100 transition-all hover:-translate-y-0.5">
              <GitHubIcon size={18} /> View Source
            </a>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            {[
              { value: '100%', label: 'Open Source' },
              { value: '<5min', label: 'Deploy Time' },
              { value: '0', label: 'Credential Leaks' },
              { value: '∞', label: 'Tenants' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-default-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6 bg-default-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground">How it works</h2>
            <p className="mt-4 text-lg text-default-500">Four simple steps from task to merge request</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="relative p-8 rounded-2xl bg-background border border-divider hover:border-primary/30 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <step.icon size={24} className="text-primary" />
                </div>
                <span className="text-5xl font-bold text-primary/10 absolute top-4 right-4">{step.num}</span>
                <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm text-default-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground">Built for production SaaS</h2>
            <p className="mt-4 text-lg text-default-500">Everything you need to run AI-powered development at scale</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-divider hover:border-primary/30 hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon size={24} className="text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-default-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-default-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-foreground">Zero trust sandboxing</h2>
              <p className="mt-4 text-lg text-default-500 leading-relaxed">
                AI agents code inside isolated Firecracker microVMs powered by E2B. Credentials never enter the sandbox — they're proxied through an encrypted credential proxy.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: Lock, text: 'Credential proxy ensures zero secret leaks' },
                  { icon: Globe, text: 'MCP server policy controls tool access' },
                  { icon: Shield, text: 'Row-level security isolates tenant data' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon size={16} className="text-primary" />
                    </div>
                    <p className="text-default-600">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#0d1117] rounded-2xl p-6 font-mono text-sm text-[#c9d1d9] overflow-hidden border border-[#30363d]">
              <div className="flex gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <pre className="text-xs leading-relaxed"><code>{`name: implement-feature
version: "1.0"

steps:
  - id: implement
    agent: claude-code
    prompt: |
      Implement the feature described
      in the task ticket.
    maxTokens: 8000
    sandbox:
      template: node-20
      timeout: 300s

  - id: review
    agent: claude-code  
    prompt: "Review the implementation"
    dependsOn: [implement]

  - id: gate
    type: approval
    approvers: [team-lead]
    dependsOn: [review]`}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section id="tech" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-foreground mb-4">Modern tech stack</h2>
          <p className="text-lg text-default-500 mb-12">Built with battle-tested technologies</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {TECH_STACK.map((tech) => (
              <span key={tech} className="px-5 py-2.5 rounded-xl border border-divider text-sm font-medium text-default-600 hover:border-primary/30 hover:text-primary transition-colors">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gradient-to-br from-primary to-purple-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white">Ready to automate your SDLC?</h2>
          <p className="mt-4 text-white/70 text-lg">Deploy on your infrastructure in minutes. Open source, MIT licensed.</p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to={authed ? '/app' : '/login'} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-primary font-semibold text-lg hover:bg-white/90 transition-all hover:-translate-y-0.5 shadow-lg">
              {authed ? 'Dashboard' : 'Get Started'} <ArrowRight size={18} />
            </Link>
            <a href="https://github.com/nmime/ai-sdlc-orchestrator" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white font-semibold text-lg hover:bg-white/10 transition-all hover:-translate-y-0.5">
              <GitHubIcon size={18} /> GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-divider py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-default-400">
            <Layers size={16} /> AI SDLC Orchestrator &middot; Built by <a href="https://github.com/nmime" target="_blank" rel="noreferrer" className="text-primary hover:underline">NMI</a>
          </div>
          <div className="flex items-center gap-8 text-sm text-default-400">
            <a href="https://github.com/nmime/ai-sdlc-orchestrator" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://github.com/nmime/ai-sdlc-orchestrator/blob/main/LICENSE" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">MIT License</a>
            <a href="https://github.com/nmime/ai-sdlc-orchestrator/blob/main/README.md" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
