<div align="center">

# Opwerf

**Task ticket → Merge request. Fully autonomous.**

A multi-tenant platform that orchestrates AI coding agents to turn task tickets into reviewed merge requests — with cost tracking, sandbox isolation, and human-in-the-loop gates.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Temporal](https://img.shields.io/badge/Temporal-1.25-000?logo=temporal&logoColor=white)](https://temporal.io/)
[![Tests](https://img.shields.io/badge/tests-603_passing-2ea44f)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Overview](#overview) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Workflow DSL](#workflow-dsl) · [API](#api-endpoints) · [Extending](#adding-a-new-agent-provider) · [Docs](docs/)

</div>

---

## Overview

Label a ticket → webhook fires → AI agent spins up in an isolated sandbox → agent codes, tests, creates MR → CI runs → agent fixes failures → human reviews → done.

The orchestrator handles everything an agent can't: webhook ingestion, durable workflow execution, credential injection, cost enforcement, and gate management. The agent handles everything else via [MCP servers](https://modelcontextprotocol.io/) — zero platform SDKs in the core.

### Key Capabilities

| | |
|---|---|
| **Provider-agnostic** | Swap AI providers via config. No hardcoded providers in core. |
| **Sandbox isolation** | Agents run in Firecracker microVMs with zero credentials. |
| **Cost tracking** | Per-task budgets, real-time enforcement, tenant-level caps. |
| **Self-healing CI** | CI failures auto-feed back to agent for fix loops. |
| **Human gates** | Configurable approval checkpoints before merge. |
| **Multi-tenant** | Full tenant isolation, per-repo config, RBAC. |
| **DSL-driven** | Define workflows in typed YAML — compiled to Temporal. |
| **MCP-native** | Platform integrations (Jira, GitLab, GitHub, Linear) via MCP. |
| **Dark mode** | System-aware theme toggle with semantic color tokens. |
| **Monaco editor** | Built-in DSL editor with YAML syntax highlighting. |

---

## Quick Start

### Prerequisites

- Node.js ≥ 24, pnpm ≥ 10
- Docker & Docker Compose

### Development

```bash
# Clone & install
git clone https://github.com/opwerf/opwerf.git
cd opwerf
pnpm install

# Copy env and configure
cp .env.example .env

# Start infrastructure (Postgres, Temporal, Redis, MinIO, Elasticsearch)
docker compose -f docker-compose.dev.yml up -d

# Run database migrations
pnpm migration:up

# Start services
pnpm dev:api          # API on :3000
pnpm dev:worker       # Temporal worker
```

### Docker (production-like)

```bash
docker compose up -d   # All services including API, worker, dashboard
```

### Verify

```bash
curl http://localhost:3000/api/v1/health/live
# {"status":"ok","info":{"database":{"status":"up"}},"error":{},"details":{"database":{"status":"up"}}}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        INGRESS LAYER                             │
│   Jira · GitLab · GitHub · Linear · Dashboard · Polling          │
│   (thin webhook handlers — verify signature, extract, signal)    │
└──────────────────┬───────────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────────┐
│                       CORE ENGINE                                │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ DSL Compiler│ │   Temporal   │ │    Cost    │ │   Gate    │  │
│  │ YAML→WF    │ │  Workflows   │ │  Tracker   │ │ Controller│  │
│  └─────────────┘ └──────┬───────┘ └────────────┘ └───────────┘  │
│                         │                                        │
│               ┌─────────▼─────────┐                              │
│               │ AgentProviderRegistry                            │
│               │  ┌──────────────┐ │                              │
│               │  │  AiAgentPort │ │  invoke() / cancel()         │
│               │  └──────────────┘ │                              │
│               └─────────┬─────────┘                              │
└─────────────────────────┼────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                     AGENT RUNTIME                                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Firecracker microVM (sandbox)                │   │
│  │  ┌───────────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │ AI Agent  │  │  MCP Servers │  │ Credential Proxy  │  │   │
│  │  │ (any      │──│  (platform   │  │ (zero-cred        │  │   │
│  │  │ provider) │  │  integrations│  │  isolation)        │  │   │
│  │  └───────────┘  └──────────────┘  └───────────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### How It Works

```
1. Label ticket        2. Webhook fires        3. Agent in sandbox       4. CI + Review
┌─────────────┐        ┌──────────────┐        ┌──────────────────┐      ┌──────────────┐
│  Jira/Linear │───────▶│  Orchestrator │───────▶│  AI agent codes  │─────▶│  CI runs     │
│  + ai-task   │        │  starts WF    │        │  via MCP servers │      │  Agent fixes │
└─────────────┘        └──────────────┘        └──────────────────┘      │  Human gates │
                                                                         └──────────────┘
```

### Services

| Service | Port | Description |
|---|---|---|
| **orchestrator-api** | 3000 | NestJS + Fastify HTTP API |
| **orchestrator-worker** | — | Temporal worker (workflows + activities) |
| **credential-proxy** | 4000 | Credential isolation for sandboxes |
| **dashboard** | 80 | React + HeroUI frontend |
| **postgres** | 5432 | Application database |
| **pgbouncer** | 6432 | Connection pooling |
| **temporal** | 7233 | Workflow engine |
| **redis** | 6379 | Cache + rate limiting |
| **minio** | 9000 | Artifact storage (S3-compatible) |
| **elasticsearch** | 9200 | Temporal visibility |

---

## Dashboard

The dashboard (`apps/dashboard/`) provides a full-featured management UI built with React 19, HeroUI v3, and TanStack Router.

**Key features:**
- **Dark mode** — system-aware toggle (light/dark/system) with semantic color tokens
- **Monaco editor** — built-in YAML editor for DSL workflows with syntax highlighting
- **Sessions page** — paginated, searchable, and sortable agent session table
- **Cost tracking** — real-time cost visualization with per-tenant and per-workflow breakdowns
- **Auth hardening** — no dev fallback tokens; requires real authentication
- **Responsive** — collapsible sidebar, mobile-friendly layout

---

## Tech Stack

<table>
<tr><td><b>Runtime</b></td><td>Node.js 24 · TypeScript 5.9 (strict) · pnpm 10</td></tr>
<tr><td><b>Monorepo</b></td><td>Nx 22 — 5 apps, 15 libraries, incremental builds</td></tr>
<tr><td><b>Backend</b></td><td>NestJS 11 + Fastify · Temporal (self-hosted) · MikroORM</td></tr>
<tr><td><b>Frontend</b></td><td>React 19 · HeroUI v3 · TanStack Router + Query · Tailwind CSS 4 · Recharts · Monaco Editor</td></tr>
<tr><td><b>Database</b></td><td>PostgreSQL 17 + PgBouncer · Redis 7 · Elasticsearch 8</td></tr>
<tr><td><b>Sandbox</b></td><td>E2B (Firecracker) / K8s Agent Sandbox + Kata Containers</td></tr>
<tr><td><b>AI Agent</b></td><td>Provider-agnostic (<code>AiAgentPort</code>) — config-driven adapter loading</td></tr>
<tr><td><b>Storage</b></td><td>MinIO (S3-compatible) for artifacts</td></tr>
<tr><td><b>Errors</b></td><td><code>neverthrow</code> Result&lt;T, E&gt; — no thrown exceptions in business logic</td></tr>
<tr><td><b>Observability</b></td><td>Pino → Loki · Prometheus + OpenTelemetry · Grafana</td></tr>
<tr><td><b>Deploy</b></td><td>Helm / ArgoCD (K8s) · Docker Compose (dev/single-node)</td></tr>
</table>

---

## Project Structure

```
opwerf/
├── apps/
│   ├── orchestrator-api/          NestJS HTTP API
│   ├── orchestrator-worker/       Temporal worker (dynamic adapter loading)
│   ├── credential-proxy/          Provider-agnostic credential proxy
│   ├── dashboard/                 React + HeroUI frontend
│   └── cli/                       CLI tool
│
├── libs/
│   ├── common/                    Config, logger, auth, database, Result utils
│   ├── db/                        MikroORM entities (17 tables) + migrations
│   ├── shared-type/               Shared TypeScript types
│   ├── workflow-dsl/              YAML DSL → Temporal compiler (Zod schema)
│   └── feature/
│       ├── workflow/              Temporal workflows + activities
│       ├── webhook/               Platform webhook handlers
│       ├── gate/                  Human approval gates
│       ├── tenant/                Multi-tenant management + RBAC
│       └── agent/
│           ├── registry/          AiAgentPort + SandboxPort + AgentProviderRegistry
│           ├── claude-code/       Claude adapter (implements AiAgentPort)
│           ├── sandbox/           E2B adapter (implements SandboxPort)
│           ├── credential-proxy/  Credential proxy client
│           └── shared/
│               ├── prompt/        PromptFormatter (strategy pattern)
│               ├── mcp-policy/    MCP policy enforcement
│               └── security/      Prompt sanitization
│
├── docker/                        Dockerfiles (api, worker, agent, dashboard)
├── docs/                          Architecture specs, runbook, OpenAPI
└── docker-compose.yml             Full stack (10 services)
```

---

## Workflow DSL

Define agent workflows in typed YAML. The DSL compiler validates with Zod and compiles to Temporal workflows.

**Step types:** `auto` · `signal_wait` · `gate` · `loop` · `terminal` · `recovery` · `parallel` · `conditional`

```yaml
name: standard-implementation
version: 1
defaults:
  agentProvider: auto           # resolved at runtime from config
  sandboxProvider: e2b
  maxRetries: 3
  maxCostPerTaskUsd: 50

steps:
  - id: implement
    type: auto
    action: invoke_agent
    mode: implement
    timeout_minutes: 60
    on_success: ci_watch
    on_failure: blocked

  - id: ci_watch
    type: signal_wait
    signal: pipelineSucceeded | pipelineFailed
    timeout_minutes: 120
    on_success: review_gate
    on_failure: ci_fix_loop

  - id: ci_fix_loop
    type: loop
    action: invoke_agent
    mode: ci_fix
    loop_strategy:
      max_iterations: 5
      no_progress_limit: 2
    on_success: ci_watch
    on_exhausted: blocked

  - id: review_gate
    type: gate
    signal: gateApproved | changesRequested
    on_approved: done
    on_changes_requested: review_fix_loop

  - id: done
    type: terminal
    action: close_workflow

  - id: blocked
    type: recovery
    action: cleanup_and_escalate
```

---

## API Endpoints

Base: `/api/v1`

<details>
<summary><b>Health</b></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness (DB + Temporal) |
| `GET` | `/health/business` | Deep business health |
</details>

<details>
<summary><b>Tenants & Configuration</b></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/tenants` | List / create tenants |
| `GET/PATCH/DELETE` | `/tenants/:id` | Tenant CRUD |
| `POST` | `/tenants/:id/dsl/validate` | Validate workflow DSL YAML |
| `GET/POST` | `/tenants/:id/repos` | Repo configuration |
| `PATCH/DELETE` | `/tenants/:id/repos/:repoId` | Repo config CRUD |
</details>

<details>
<summary><b>Workflows</b></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/workflows` | List workflow mirrors |
| `GET` | `/workflows/:id` | Workflow details |
| `GET` | `/workflows/:id/events` | Workflow events |
| `GET` | `/workflows/:id/sessions` | Agent sessions |
| `GET` | `/workflows/:id/artifacts` | Workflow artifacts |
| `POST` | `/workflows/:id/retry` | Retry blocked workflow |
</details>

<details>
<summary><b>Gates, Costs, Webhooks</b></summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/gates/:workflowId/decide` | Submit gate decision |
| `GET` | `/costs/summary/:tenantId` | Cost summary |
| `GET` | `/costs/alerts/:tenantId` | Cost alerts |
| `POST` | `/webhooks/:platform/:tenantId` | Webhook ingestion |
</details>

Full OpenAPI spec: [`docs/openapi.yaml`](docs/openapi.yaml)

---

## Provider-Agnostic Design

The core codebase has **zero hardcoded provider references**. All AI agent and sandbox providers are loaded dynamically.

### How It Works

1. **`AiAgentPort`** — interface: `name`, `invoke()`, `cancel()`
2. **`AgentProviderRegistry`** — cascaded resolution: repo config → tenant default → system default (`auto`)
3. **Dynamic loading** — worker checks env vars and loads matching adapters:
   - `ANTHROPIC_API_KEY` set → loads `ClaudeAgentAdapter`
   - Future: `OPENAI_API_KEY` → OpenAI adapter, etc.
4. **`auto` mode** — registry picks the first registered adapter

### Adding a New Agent Provider

```typescript
// 1. Implement the port
@Injectable()
export class MyAdapter implements AiAgentPort {
  readonly name = 'my_provider';
  async invoke(input: AgentInvokeInput) { /* ... */ }
  async cancel(sessionId: string) { /* ... */ }
}

// 2. Register in worker (apps/orchestrator-worker/src/main.ts)
if (configService.get('MY_PROVIDER_API_KEY', { infer: true })) {
  const { MyAdapter } = await import('@app/feature-agent-my-provider');
  adapters.push(new MyAdapter(configService, pinoLogger));
}

// 3. Optional: custom prompt formatting
promptFormatter.registerStrategy({
  name: 'my_provider',
  format: (data) => '...',
});
```

```bash
# 4. Configure credential proxy (optional)
AI_PROVIDER_CONFIGS='{ "my_provider": { "baseUrl": "https://api.example.com", "authType": "bearer" } }'
MY_PROVIDER_API_KEY=sk-xxx
```

---

## CI/CD

- **GitHub Actions** with Nx-optimized pipelines
- **Nx cache** via `actions/cache@v4` for faster builds
- **Affected commands** — only lint/typecheck/test/build changed projects
- **Docker build matrix** — parallel builds for all 5 services (api, worker, agent, dashboard, credential-proxy)
- **Release pipeline** — semantic versioning with Helm chart packaging

---


## Testing

```bash
pnpm test                                    # 603 tests across 55 files
pnpm typecheck                               # 18/18 projects
npx vitest run --config vitest.config.ts     # Direct vitest
```

| Category | Coverage |
|---|---|
| Unit tests | DSL compiler, webhook handlers, controllers, services, entities |
| Integration | Credential proxy, tenant CRUD, agent registry, prompt formatter |
| E2E | Live API — health, tenants, DSL validation |
| Security | Prompt sanitization, quality gates, input validation |

---

## Configuration

<details>
<summary><b>All environment variables</b></summary>

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_HOST` | `localhost` | | PostgreSQL host |
| `DATABASE_PORT` | `6432` | | PostgreSQL/PgBouncer port |
| `DATABASE_NAME` | `orchestrator` | | Database name |
| `DATABASE_USER` | `orchestrator` | | Database user |
| `DATABASE_PASSWORD` | — | ✅ | Database password |
| `TEMPORAL_ADDRESS` | `localhost:7233` | | Temporal server |
| `TEMPORAL_NAMESPACE` | `default` | | Temporal namespace |
| `REDIS_URL` | `redis://localhost:6379` | | Redis URL |
| `MINIO_ENDPOINT` | `localhost` | | MinIO host |
| `MINIO_PORT` | `9000` | | MinIO port |
| `MINIO_ACCESS_KEY` | — | ✅ | MinIO access key |
| `MINIO_SECRET_KEY` | — | ✅ | MinIO secret key |
| `ENCRYPTION_KEY` | — | ✅ | Data encryption key |
| `ENCRYPTION_SALT` | — | ✅ | Encryption salt (16+ chars) |
| `CREDENTIAL_PROXY_INTERNAL_TOKEN` | — | ✅ | Internal auth token |
| `DEFAULT_AGENT_PROVIDER` | `auto` | | Agent provider (`auto` or specific) |
| `DEFAULT_AGENT_MODEL` | — | | Model name (provider-specific) |
| `ANTHROPIC_API_KEY` | — | | Enables Claude adapter |
| `OPENAI_API_KEY` | — | | OpenAI key (future adapters) |
| `AI_PROVIDER_CONFIGS` | — | | JSON provider config map |
| `E2B_API_KEY` | — | | E2B sandbox key |
| `API_PORT` | `3000` | | API listen port |
| `CORS_ORIGINS` | `http://localhost:5173` | | Allowed CORS origins |
| `BUDGET_RESERVATION_USD` | `50` | | Default per-task budget |
| `AGENT_MAX_TURNS` | `25` | | Max agent turns per task |
| `AGENT_MAX_DURATION_MS` | `3600000` | | Max agent duration |
| `SANITIZER_MODE` | `block` | | Prompt sanitizer (`block`/`warn`/`off`) |

</details>

Copy `.env.example` and customize:

```bash
cp .env.example .env
```

Full schema: [`libs/common/src/config/app-config.module.ts`](libs/common/src/config/app-config.module.ts)

---

## Deployment

### Kubernetes (production)

```bash
helm install opwerf oci://ghcr.io/opwerf/opwerf \
  --set database.password=$DB_PASSWORD \
  --set credentials.encryptionKey=$ENC_KEY
```

See [`docs/runbook.md`](docs/runbook.md) for full K8s deployment guide (Hetzner, Kubespray, ArgoCD, monitoring).

### Docker Compose (single node)

```bash
cp .env.example .env
# Edit .env with real credentials
docker compose up -d
```

---

## Documentation

| Document | Description |
|---|---|
| [Overview](docs/overview.md) | Executive summary, what it does / doesn't do |
| [Architecture](docs/specs/architecture.md) | System diagram, three-layer model, monorepo layout |
| [Workflow Engine](docs/specs/workflow-engine.md) | DSL, state machine, event system |
| [Data Model](docs/specs/data-model.md) | ER diagram, all 17 entities |
| [Sandbox & Security](docs/specs/sandbox-and-security.md) | Firecracker, credential proxy, isolation |
| [Integration](docs/specs/integration.md) | MCP servers, agent-first model |
| [Tech Stack](docs/specs/tech-stack.md) | Technology choices, testing strategy |
| [Deployment](docs/specs/deployment.md) | Topology, monitoring, DR |
| [Runbook](docs/runbook.md) | Operations guide, troubleshooting |
| [OpenAPI](docs/openapi.yaml) | Full API specification |
| [Changelog](docs/CHANGELOG-provider-agnostic.md) | Provider-agnostic refactor details |

---

## License

MIT — see [LICENSE](LICENSE) for details.
