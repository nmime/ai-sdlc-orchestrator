# System Architecture

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Architecture Overview

The architecture has three conceptual tiers — **Ingress** (thin webhook handlers), **Core Engine** (Temporal Workflows + DSL), and **Agent Runtime** (sandboxes running claude-agent-sdk + MCP servers) — decomposed into five operational layers (see Architecture Layers table below). The orchestrator runs in K8s; agent sandboxes run in one of two backends selected per deployment model: **E2B** (Cloud or BYOC) for SaaS deployments, or **K8s Agent Sandbox + Kata Containers** for regulated/banking/on-prem deployments. All sandbox interaction goes through a `SandboxPort` abstraction — the orchestrator core is backend-agnostic.

Webhooks arrive at the Ingress layer. Each platform has a thin handler (~50-100 lines) that verifies the signature, extracts event type + entity ID, and signals the corresponding Temporal Workflow. The **Core Engine** is expressed entirely as Temporal Workflows (orchestration logic) and Activities (side effects). The only significant Activity is `invokeAgent` — it creates a sandbox (Firecracker/KVM microVM) via `SandboxPort`, clones the repo inside it, and starts an agent session. The **agent does everything else**: fetches task details, gathers context, creates branches, implements code, creates MRs, pushes — all via platform MCP servers. Temporal handles all durability, retries, timeouts, and execution history.

### Architecture Diagram

```mermaid
graph TB
    subgraph Ingress["INGRESS — Thin Webhook Handlers"]
        JH[Jira Handler<br><i>verify + extract</i>]
        GLH[GitLab Handler<br><i>verify + extract</i>]
        GHH[GitHub Handler<br><i>verify + extract</i>]
        LH[Linear Handler<br><i>verify + extract</i>]
        API[Dashboard REST API]
        POLL[Polling Schedule]
    end

    subgraph Core["CORE ENGINE"]
        EN[Event Normalizer]
        DSL[DSL Compiler<br>YAML → Temporal Workflow]
        TW[Temporal Workflows<br>Orchestration logic]
        TA[Temporal Activities<br>invokeAgent · cost · mirror · cleanup]
        CT[Cost Tracker]
        GC[Gate Controller<br>Temporal Signals]
    end

    subgraph AgentRuntime["AGENT RUNTIME (via SandboxPort)"]
        SP[SandboxPort<br>E2bSandboxAdapter | K8sSandboxAdapter]
        AS[Agent Session<br>Provider: Claude · OpenHands · Aider]
        MCP[Tenant MCP Servers<br>Platform + Productivity]
    end

    subgraph External["EXTERNAL PLATFORMS (agent accesses via MCP)"]
        JiraAPI[Jira / Linear API]
        GLAPI[GitLab / GitHub API]
    end

    subgraph TemporalCluster["TEMPORAL CLUSTER (self-hosted)"]
        TS[Temporal Server]
        TUI[Temporal UI]
        TDB[(Temporal DB)]
    end

    subgraph AppDB["APPLICATION DB"]
        PG[(PostgreSQL + RLS<br>Tenants · Costs · Configs · DSL)]
    end

    JH --> EN
    GLH --> EN
    GHH --> EN
    LH --> EN
    POLL --> EN
    API --> Core

    EN --> TW
    DSL --> TW
    TW --> TA
    TA --> SP
    SP --> AS

    AS --> MCP
    MCP -->|MCP| JiraAPI
    MCP -->|MCP| GLAPI

    CT --> PG
    GC --> TW
    TW --> TS
    TS --> TDB
    TS --> TUI
    Core --> PG
```

### Supported Platforms

Adding a new platform = adding a thin webhook handler (~50-100 lines) + configuring the platform's MCP server in tenant config. No SDK integration needed.

| Layer | v1 | v2+ |
|---|---|---|
| Task Trackers | Jira Cloud + DC, Linear | YouTrack, ClickUp, GitHub Issues |
| VCS | GitLab CE/EE, GitHub | Bitbucket |
| CI Providers | GitLab CI, GitHub Actions | Jenkins, CircleCI |
| AI Agents | Claude via `ClaudeAgentAdapter` (`AiAgentPort` abstraction ready from v1) | OpenHands, Aider |
| Workflow Visibility | Temporal UI (self-hosted) | Custom SaaS dashboard |

---

## Architecture Layers

| Layer | Responsibility |
|---|---|
| **Webhook Handler** | Verify signature, extract event type + entity ID, normalize to `OrchestratorEvent`. ~50 lines per platform |
| **Temporal Workflow** | Orchestration only — calls activities, handles signals, gates, timers. No I/O, no business logic |
| **Temporal Activity** | Side-effect unit. `invokeAgent` (the main one), `updateMirror`, `trackCost`, `cleanupBranch`. Idempotent |
| **AiAgentPort** | Provider-agnostic abstraction — `AgentProviderRegistry` resolves the correct adapter at runtime based on repo config → tenant config → system default. Two methods: `invoke()` and `cancel()` |
| **SandboxPort** | Sandbox abstraction — two implementations: `E2bSandboxAdapter` (E2B Cloud/BYOC) and `K8sSandboxAdapter` (Agent Sandbox + Kata). Backend selected per deployment model |
| **Agent Sandbox** | Dedicated microVM per session (Firecracker via E2B, or Kata Containers via K8s Agent Sandbox) + credential proxy service. Agent does all platform interaction via tenant's MCP servers. Creates branches, MRs, fetches context, transitions statuses |
| **Webhook Resilience** | Durable ingestion (write-first), polling fallback via Temporal Schedule, periodic reconciliation job |

---

## Agent Provider Abstraction

The orchestrator supports multiple AI agent providers through a registry pattern:

**`AgentProviderRegistry`** — resolves the correct `AiAgentPort` implementation at runtime. Resolution chain:
1. `TENANT_REPO_CONFIG.agent_provider` (per-repo override)
2. `TENANT.default_agent_provider` (tenant default)
3. System default (`'claude'`)

**Provider adapters** — each provider implements `AiAgentPort` + `PromptFormatter`:

| Provider | Adapter | Status | Notes |
|---|---|---|---|
| Claude | `ClaudeAgentAdapter` | v1 | Uses `@anthropic-ai/claude-agent-sdk` |
| OpenHands | `OpenHandsAdapter` | v2+ | Open-source agent framework |
| Aider | `AiderAdapter` | v2+ | Git-focused coding assistant |

Adding a new provider requires:
1. Implement `AiAgentPort` — sandbox setup, agent invocation, result collection
2. Implement `PromptFormatter` — transform canonical `AgentPromptData` to provider-specific format
3. Register in `AgentProviderRegistry`
4. Create/extend E2B template with provider runtime (see [Sandbox & Security](sandbox-and-security.md))

All providers share the same sandbox infrastructure (E2B), credential proxy, MCP servers, and quality verification pipeline. The abstraction boundary is at prompt formatting and agent invocation only.

---

## Project Structure & Monorepo

```
ai-sdlc-orchestrator/
├── apps/
│   ├── orchestrator-api/              # HTTP API (NestJS + Fastify)
│   │                                  # Webhook ingestion, REST API, Temporal client
│   ├── orchestrator-worker/           # Temporal Worker (Workflows + Activities)
│   └── dashboard/                     # SaaS frontend (React + Vite) — v2+
│
├── libs/
│   ├── feature/
│   │   ├── workflow/
│   │   │   ├── main/src/module/
│   │   │   │   ├── temporal/
│   │   │   │   │   ├── workflow/      # Temporal Workflow definitions
│   │   │   │   │   └── activity/      # invokeAgent, costTracking, updateMirror
│   │   │   │   ├── cost-tracking/
│   │   │   │   └── multi-repo/        # Parent–child Workflow coordination
│   │   │   └── shared/src/
│   │   │
│   │   ├── agent/
│   │   │   ├── registry/              # AgentProviderRegistry
│   │   │   ├── claude-code/           # ClaudeAgentAdapter (v1)
│   │   │   ├── openhands/             # OpenHandsAdapter (v2+)
│   │   │   ├── aider/                 # AiderAdapter (v2+)
│   │   │   ├── shared/
│   │   │   │   └── prompt/            # PromptFormatter, AgentPromptData
│   │   │   ├── sandbox/               # E2B sandbox management
│   │   │   ├── credential-proxy/      # Credential proxy client
│   │   │   └── types/                 # Shared agent types
│   │   │
│   │   ├── webhook/
│   │   │   └── main/src/module/
│   │   │       ├── jira/              # ~50 lines: verify HMAC, extract event
│   │   │       ├── gitlab/            # ~50 lines: verify token, extract event
│   │   │       ├── github/            # ~50 lines: verify HMAC, extract event
│   │   │       └── linear/            # ~50 lines: verify HMAC, extract event
│   │   │
│   │   ├── gate/
│   │   └── tenant/
│   │
│   ├── workflow-dsl/
│   │   └── src/
│   │       ├── schema/                # Zod-validated DSL schema
│   │       ├── compiler/              # YAML → Temporal Workflow
│   │       └── type/
│   │
│   ├── common/
│   │   ├── bootstrap/
│   │   ├── config/
│   │   ├── database/                  # MikroORM setup
│   │   ├── temporal/                  # Temporal client, worker factory
│   │   ├── exception/                 # Result<T,E> / AsyncResult<T,E>
│   │   ├── logger/                    # Pino
│   │   ├── health/
│   │   ├── auth/
│   │   ├── otel/
│   │   └── test/
│   │
│   ├── db/
│   │   └── src/
│   │       ├── entity/                # MikroORM entities (Tenant, TenantMcpServer,
│   │       │                          #   TenantVcsCredential, TenantRepoConfig,
│   │       │                          #   WebhookDelivery, WorkflowMirror,
│   │       │                          #   WorkflowEvent, AgentSession, AgentToolCall,
│   │       │                          #   WorkflowDsl)
│   │       ├── repository/
│   │       └── migration/
│   │
│   └── shared-type/
│
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker              # Temporal worker + SandboxPort (E2B SDK or K8s client)
│   ├── Dockerfile.agent               # Git, Node, Python, Go toolchain
│   │                                  # Shared source for both backends:
│   │                                  #   E2B: `e2b template build` → E2B template registry
│   │                                  #   Agent Sandbox: `docker build` → OCI registry (ECR/GCR/private)
│   │                                  # Contains common MCP server runtimes (Node.js for JS-based
│   │                                  # MCP servers). Tenant-specific command-type MCP servers
│   │                                  # spawned from pre-installed binaries (common) or downloaded
│   │                                  # at sandbox startup (custom, adds latency). url-type MCP servers
│   │                                  # (remote) require no local binaries
│   ├── Dockerfile.credential-proxy    # Standalone service — injects VCS PAT + MCP
│   │                                  # tokens into sandbox requests via authenticated HTTPS
│   └── Dockerfile.dashboard
│
├── .helm/
├── docker-compose.dev.yml             # PostgreSQL + Temporal auto-setup + credential-proxy (local dev)
├── nx.json
├── tsconfig.base.json
├── package.json
├── pnpm-workspace.yaml
├── mikro-orm.config.ts
├── CLAUDE.md
└── .ai-orchestrator.yaml
│                                      # Per-target-repo config file — defines setup/test/lint/build
│                                      # commands, branch prefix, and coding guidelines for the agent.
│                                      # See Integration — Prompt Structure (integration.md)
```
