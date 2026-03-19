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
| ORM | **MikroORM** | Unit of Work, explicit transactions, identity map |
| Workflow DSL | **Custom YAML DSL** (Zod + Temporal compiler) | Team-configurable, visual editor-ready |
| AI Agent SDK | **@anthropic-ai/claude-agent-sdk** | Full agent loop, MCP-native. The only external SDK |
| Platform Integration | **MCP servers** (tenant-configured) | Zero SDK deps — agent uses MCP for all platform interaction |
| Agent Sandbox | **[Kata Containers](https://katacontainers.io/)** | K8s-native microVM runtime. Hardware-level KVM isolation per pod. CNCF project, Apache-2.0. Standard K8s primitives (NetworkPolicy, Secrets, resource limits). No separate infrastructure — runs as a RuntimeClass in the cluster |
| Credential Isolation | **Credential proxy sidecar** (in Kata pod) | Agent container has zero credential access. Proxy sidecar injects VCS PAT + MCP tokens transparently. K8s provides container-level isolation natively. Pattern recommended by Anthropic's secure deployment guide |
| Error Handling | **ts-results** | `Result<T, E>` / `AsyncResult<T, E>` |
| Secrets | **K8s Secrets** | No secrets in Workflow inputs or agent context |
| Metrics | **Prometheus + OpenTelemetry** | Standard K8s observability |
| Logging | **Pino** → **Grafana Loki** | Structured JSON → centralized log aggregation. Queried via Grafana alongside metrics. Correlation IDs link logs across API, worker, and Temporal |
| Temporal Visibility | **Elasticsearch 8** (or OpenSearch) | Advanced Workflow queries in Temporal UI (by tenant, status, date range, custom search attributes). Default DB-based visibility doesn't support complex queries |
| Testing | **Jest 30** + **Testcontainers** + **@temporalio/testing** | Unit + component + Temporal workflow tests |

---

## Testing Strategy

| Level | Scope | Tools | What It Covers |
|---|---|---|---|
| **Unit** | Individual services, DSL compiler, event normalizer | Jest 30, mock MikroORM repos | Business logic, DSL YAML → Temporal mapping, webhook signature verification |
| **Component** | DB interactions, Temporal Activities | Jest + Testcontainers (PostgreSQL) | MikroORM entities/repos, mirror reconciliation, cost reservation, webhook dedup |
| **Temporal Workflow** | Full workflow execution with mocked Activities | `@temporalio/testing` (TestWorkflowEnvironment) | DSL-compiled workflows: state transitions, signal handling, gate timeouts, loop limits, multi-repo coordination. Fast time-travel (no real waits) |
| **Agent Integration** | `AiAgentPort.invoke()` with mock MCP servers | Jest + mock MCP server (local HTTP) | Agent prompt construction, `AgentResult` parsing, tool call logging, cost limit enforcement |
| **Sandbox** | Kata pod creation, credential isolation, network restrictions | Kata on dev K8s cluster | Pod starts from image, credentials not accessible from agent container, egress blocked for unauthorized destinations |
| **E2E** | Full flow: webhook → Temporal → Kata pod → MR | Testcontainers (PG + Temporal) + mock VCS/tracker APIs | Single-repo and multi-repo flows, CI fix loops, gate approval, cost tracking |

**Key testing principles:**
- Temporal workflow tests use `TestWorkflowEnvironment` — runs in-memory, no Temporal server needed, time-skipping built in
- Agent integration tests use a mock MCP server that returns canned responses — never calls real Claude API in CI
- DSL compiler tests validate every step type (`auto`, `signal_wait`, `gate`, `loop`, `terminal`) compiles to valid Temporal Workflow code
- Sandbox tests run against a dev K8s cluster with Kata Containers installed — validates real KVM isolation, credential proxy sidecar, and network restrictions

---

## Frontend (v1 — Temporal UI)

Temporal UI handles workflow visibility in v1. Custom dashboard is limited to:
- Configuration (webhook secrets, VCS credentials, MCP server list)
- Gate approval UI (sends `gateApproved` signals)
- Cost dashboard (from app DB aggregates)

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
