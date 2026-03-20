# Tech Stack

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Backend

| Layer | Technology | Rationale |
|---|---|---|
| Monorepo | **Nx 22** + **pnpm** | Incremental builds, task caching |
| Runtime | **Node.js 24 LTS** + **TypeScript 5.9 strict** | Team expertise, LTS stability |
| Framework | **NestJS 11** + **Fastify** | DDD modules, DI, raw body for webhook signatures |
| Workflow Engine | **Temporal** (self-hosted, TypeScript SDK) | Durable execution, replay, native visibility |
| App Database | **PostgreSQL 18** | Tenants, costs, DSL, workflow mirror |
| DB Connection Pool | **PgBouncer** (sidecar per pod) | Multiple API + worker pods → single PG instance. Transaction pooling mode. Prevents connection exhaustion under load |
| ORM | **MikroORM** | Unit of Work, explicit transactions, identity map. Migrations via `mikro-orm migration:up` (K8s Job, pre-deploy). Partitioned table DDL via raw SQL migrations |
| Workflow DSL | **Custom YAML DSL** (Zod + Temporal compiler) | Team-configurable, visual editor-ready |
| AI Agent | **AiAgentPort** with provider-specific adapters | Provider-agnostic abstraction. v1: `ClaudeAgentAdapter` (via `@anthropic-ai/claude-agent-sdk`). v2+: `OpenHandsAdapter`, `AiderAdapter`. Adding a provider = implement `AiAgentPort` + `PromptFormatter` ¹ |
| Platform Integration | **MCP servers** (tenant-configured) | Zero SDK deps — agent uses MCP for all platform interaction |
| Agent Sandbox | **Multi-backend via `SandboxPort`** | Two implementations selected per deployment model. See [Sandbox & Security](sandbox-and-security.md) |
| ↳ E2B backend | **[E2B](https://e2b.dev)** (`e2b` npm package) | Firecracker microVM per session. Cloud (SaaS) or BYOC (enterprise, AWS). Purpose-built for AI agents. Custom templates from Dockerfiles |
| ↳ Agent Sandbox + Kata backend | **[K8s Agent Sandbox](https://github.com/kubernetes-sigs/agent-sandbox)** + **[Kata Containers](https://katacontainers.io)** | K8s-native CRDs with Kata KVM microVM isolation. For regulated/banking/on-prem. Runs in same K8s cluster. NetworkPolicy per template |
| Credential Isolation | **Credential proxy service** (K8s Deployment) | Sandbox has zero credential access. Standalone proxy service injects VCS PAT + MCP tokens via authenticated HTTPS. Credentials on K8s cluster, separate from sandbox VM — stronger isolation than sidecar model |
| Error Handling | **neverthrow** | `Result<T, E>` / `ResultAsync<T, E>` — actively maintained (4k+ stars), native async support |
| Secrets | **K8s Secrets** | No secrets in Workflow inputs or agent context |
| Cache (optional) | **Redis 7** (Valkey compatible) | Budget reservation cache (reduces PG contention on hot path), API rate limiting, credential proxy rate limiting, session token revocation list. **Not a required dependency** — all features fall back to PostgreSQL when Redis is unavailable. Deployed as a single replica with AOF persistence or managed (ElastiCache/Memorystore) |
| Metrics | **Prometheus + OpenTelemetry** | Standard K8s observability |
| Logging | **Pino** → **Grafana Loki** | Structured JSON → centralized log aggregation. Queried via Grafana alongside metrics. Correlation IDs link logs across API, worker, and Temporal |
| Tenant Data Isolation | **PostgreSQL RLS** (Row-Level Security) | Per-tenant data isolation at database level. All queries scoped by `tenant_id` via RLS policies. Defense-in-depth alongside application-level tenant filtering |
| Object Storage | **[MinIO](https://min.io)** (S3-compatible API) | Artifact file uploads (sandbox-local images, test reports, build outputs). Runs as a K8s Deployment. Application code uses AWS S3 SDK (`@aws-sdk/client-s3`). Also used for PG WAL archiving, Loki log chunks, and ES snapshots — single storage backend for all blob data |
| Temporal Visibility | **Elasticsearch 8** (or OpenSearch) | Advanced Workflow queries in Temporal UI (by tenant, status, date range, custom search attributes). Default DB-based visibility doesn't support complex queries |
| Workflow DSL Validation | **Zod schema** (published as `@ai-sdlc/workflow-dsl-schema` npm package) | Used by CLI validator (`dsl validate`), dashboard DSL editor, and runtime DSL compiler. Single source of truth for DSL shape |
| Testing | **Jest 30** + **Testcontainers** + **@temporalio/testing** | Unit + component + Temporal workflow tests |

> ¹ v1 ships with `ClaudeAgentAdapter` using `@anthropic-ai/claude-agent-sdk` (or `@anthropic-ai/sdk` fallback). The `AiAgentPort` + `PromptFormatter` abstraction is in place from v1, so adding OpenHands or Aider requires no changes to the orchestrator core — only a new adapter implementation. See [Architecture — Agent Provider Abstraction](architecture.md).

---

## Testing Strategy

| Level | Scope | Tools | What It Covers |
|---|---|---|---|
| **Unit** | Individual services, DSL compiler, event normalizer | Jest 30, mock MikroORM repos | Business logic, DSL YAML → Temporal mapping, webhook signature verification |
| **Component** | DB interactions, Temporal Activities | Jest + Testcontainers (PostgreSQL) | MikroORM entities/repos, mirror reconciliation, cost reservation, webhook dedup |
| **Temporal Workflow** | Full workflow execution with mocked Activities | `@temporalio/testing` (TestWorkflowEnvironment) | DSL-compiled workflows: state transitions, signal handling, gate timeouts, loop limits, multi-repo coordination. Fast time-travel (no real waits) |
| **Agent Integration** | `AiAgentPort.invoke()` with mock MCP servers | Jest + mock MCP server (local HTTP) | Per-provider test suites: agent prompt construction via `PromptFormatter`, `AgentResult` parsing, tool call logging, cost limit enforcement. Each provider adapter has its own test suite with provider-specific prompt validation |
| **RLS Policy** | Cross-tenant isolation verification | Jest + Testcontainers (PostgreSQL) | Verify RLS policies block cross-tenant queries, ensure queries without tenant context are rejected, test tenant-scoped CRUD operations |
| **Sandbox** | Sandbox creation, credential isolation (both backends) | E2B sandboxes (CI default) + Agent Sandbox + Kata (staging with KVM nodes) | `SandboxPort` interface tests with both adapters. Sandbox starts from template, credentials not accessible from sandbox (served via credential proxy), session token scoping works correctly |
| **E2E** | Full flow: webhook → Temporal → sandbox → MR | Testcontainers (PG + Temporal) + mock VCS/tracker APIs | Single-repo and multi-repo flows, CI fix loops, gate approval, cost tracking. E2B backend in CI, both backends in staging |

**Key testing principles:**
- Temporal workflow tests use `TestWorkflowEnvironment` — runs in-memory, no Temporal server needed, time-skipping built in
- Agent integration tests use a mock MCP server that returns canned responses — never calls real AI provider APIs in CI
- DSL compiler tests validate every step type (`auto`, `signal_wait`, `gate`, `loop`, `terminal`) compiles to valid Temporal Workflow code
- Sandbox tests: `SandboxPort` interface is tested with mock implementations in unit tests, real E2B sandboxes in CI (no KVM requirement), and both E2B + Agent Sandbox + Kata in staging (KVM-capable nodes)
- Both `E2bSandboxAdapter` and `K8sSandboxAdapter` implement the same `SandboxPort` interface — adapter-level tests verify contract compliance

### Chaos & Load Testing

| Category | Tool | Purpose |
|----------|------|---------|
| Chaos Engineering | Litmus Chaos / Chaos Mesh | Inject failures in staging: E2B API unavailability, PostgreSQL failover, Temporal worker restart, credential proxy crash |
| Load Testing | k6 | Webhook ingestion load testing (target: 1,000 req/s sustained), concurrent workflow creation |
| Soak Testing | k6 (long-running) | 24-hour steady-state run with continuous workflow creation to detect memory leaks, connection pool exhaustion, log volume growth |

**Failure Matrix**

| Component Failure | Expected Behavior |
|-------------------|-------------------|
| E2B API unreachable | Sandbox creation retries with backoff; workflow transitions to BLOCKED after max retries |
| PostgreSQL primary failover | PgBouncer reconnects to new primary; in-flight transactions retry via Temporal Activity retry |
| Temporal worker crash | Temporal redistributes Activities to surviving workers; no data loss |
| Credential proxy all replicas down | Sandbox operations fail; workflows pause; alert fires within 30s |
| Loki ingestion down | Logs buffer in Promtail; no agent impact; alert on buffer fullness |
| Redis (budget cache) unavailable | Fallback to direct PostgreSQL query; higher latency but functional |

---

## Frontend (v1 — Temporal UI)

Temporal UI handles workflow visibility in v1. Custom dashboard is limited to:
- Configuration (webhook secrets, VCS credentials, MCP server list)
- Gate approval UI (sends `gateApproved` signals)
- Cost dashboard — multi-dimensional breakdown: by AI provider, by sandbox runtime, by tenant, by repo, by task complexity tier (from app DB aggregates)

## Frontend (v2+ — Custom Dashboard)

React 19, Vite 8, TanStack Router, TanStack Query, SSE for real-time updates, Tailwind CSS 4, Recharts.

---

## Tooling

The system tooling is split into two levels: **Developer Tooling** — for the development team of this project, and **Agent Tooling** — MCP servers that the tenant configures for the agent.

Agent Tooling is fully plug-and-play — the orchestrator neither knows nor cares about specific MCP servers. The tenant configures the list in the app DB, and the orchestrator passes it to the Agent SDK. Below is the recommended set, but the tenant can add/remove any.

### Overview Table

| Tool | Dev Tooling | Agent Tooling (recommended) | Purpose |
|---|:---:|:---:|---|
| **Atlassian / Linear MCP** | — | ✅ | Tasks: details, statuses, comments |
| **GitLab / GitHub MCP** | — | ✅ | VCS + CI: MRs, pipelines, logs |
| **Context7** | ✅ | ✅ | Up-to-date library docs instead of stale knowledge |
| **smart-tree** | ✅ | ✅ | AI-optimized repo structure (10x compression) |
| **Sequential Thinking** | ✅ | ✅ | Structured reasoning for complex tasks |
| **Repomix** | ✅ | — | Pack codebase for analysis (development) |
| **Playwright** | ✅ | — | E2E testing of dashboard (development) |
| **Memory** | ✅ | — | Persistent memory across sessions (development) |
| **Custom MCP** | — | ✅ | Tenant can add any MCP server (Notion, Slack, internal tools) |

---

### Context7 — Up-to-Date Library Docs
**`@upstash/context7-mcp`** | 44K GitHub stars | Thoughtworks Technology Radar "Trial"

Injects up-to-date, version-specific docs directly into context. Eliminates stale API hallucinations — critical for fast-moving libraries.

```json
{
  "context7": {
    "url": "https://mcp.context7.com/mcp",
    "headers": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
  }
}
```

**Dev:** before working with Temporal SDK, NestJS 11, MikroORM, Claude Agent SDK.
**Agent:** before implementing a feature that uses an unfamiliar or recently updated client library. Add `use context7` to the prompt or `use library /temporalio/sdk-typescript` for a specific one.

---

### smart-tree — AI-Optimized Repo Analysis
**`8b-is/smart-tree`** | 128 GitHub stars | Rust, 30+ MCP tools

Replaces `tree` with 10-24x output compression, AST-aware editing (90% token savings), semantic search.

```json
{
  "smart-tree": {
    "command": "/usr/local/bin/st",
    "args": ["--mcp"],
    "env": { "AI_TOOLS": "1" }
  }
}
```

Key tools: `quick_tree` (3-level overview, 10x compression), `project_overview` (full analysis), `search_in_files` (search with line numbers), `smart_edit` (AST editing).

**Dev:** monorepo navigation, understanding structure before cross-library changes.
**Agent:** client repo structure overview at the start of a task — instead of expensive `Bash: tree src/`.

---

### Sequential Thinking — Structured Reasoning
**`modelcontextprotocol/servers`** | Official, Anthropic-built

Externalizes agent reasoning into explicit steps and branches instead of an opaque "answer". Enables exploring alternative approaches and revising decisions.

```json
{
  "sequential-thinking": {
    "command": "node",
    "args": ["node_modules/@modelcontextprotocol/server-sequential-thinking/dist/index.js"]
  }
}
```

**Dev:** designing new features, planning refactoring, debugging complex interactions between Temporal Activities.
**Agent:** complex multi-step tasks — agent breaks implementation into phases, doesn't jump straight into code.

---

### Repomix — Codebase Packing (Dev only)
**`yamadashy/repomix`** | npm: `repomix` | MCP server built-in

Packs a local directory or GitHub repo into a single AI-consumable file. Tree-sitter compression yields 70% token reduction.

```json
{
  "repomix": {
    "command": "node",
    "args": ["node_modules/repomix/bin/repomix.js", "--mcp"]
  }
}
```

**Dev:** refactoring an entire feature domain, migrating between libraries, analyzing a third-party repo before integration. Not needed by the agent inside the system — it already has the cloned repo and `smart-tree`.

---

### Playwright — Browser Automation (Dev only)
**`microsoft/playwright-mcp`** | Official Microsoft MCP

Browser control via accessibility trees (not screenshots). E2E testing of the dashboard.

```json
{
  "playwright": {
    "command": "node",
    "args": ["node_modules/@playwright/mcp/cli.js"]
  }
}
```

**Dev:** validation of gate approval UI, cost dashboard, real-time updates in Phase 5+. Not needed by the agent inside the system — it works with server-side code, not a browser.

---

### Memory — Persistent Memory (Dev only)
**`modelcontextprotocol/servers`** | Official, Anthropic-built

Persistent memory across Claude Code sessions via a local knowledge graph. Stores architectural decisions, known gotchas, project conventions.

```json
{
  "memory": {
    "command": "node",
    "args": ["node_modules/@modelcontextprotocol/server-memory/dist/index.js"]
  }
}
```

**Dev:** long sessions where the agent needs to remember decisions from previous sessions. Not needed by the agent inside the system — context is rebuilt from scratch by the agent via MCP on each run.

---

### Dev Config (`~/.config/claude-code/mcp.json`)

Full config for project developers:

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    },
    "smart-tree": {
      "command": "/usr/local/bin/st",
      "args": ["--mcp"],
      "env": { "AI_TOOLS": "1" }
    },
    "repomix": {
      "command": "node",
      "args": ["node_modules/repomix/bin/repomix.js", "--mcp"]
    },
    "sequential-thinking": {
      "command": "node",
      "args": ["node_modules/@modelcontextprotocol/server-sequential-thinking/dist/index.js"]
    },
    "playwright": {
      "command": "node",
      "args": ["node_modules/@playwright/mcp/cli.js"]
    },
    "memory": {
      "command": "node",
      "args": ["node_modules/@modelcontextprotocol/server-memory/dist/index.js"]
    }
  }
}
```

### Agent Config (inside `invokeAgent` Activity)

All MCP servers are plug-and-play from the tenant config. The orchestrator passes `tenantConfig.agentMcpServers` to the Agent SDK as-is. No hardcoding — the tenant fully controls the agent's tool set.

See [Integration — Agent MCP Server Configuration](integration.md).

### `CLAUDE.md`

The repo root contains `CLAUDE.md` — coding guidelines for Claude Code when working with this codebase. It also serves as the `.ai-orchestrator.yaml` of the orchestrator itself — the first dogfooding target of the system.
