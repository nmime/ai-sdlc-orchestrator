# Implementation Roadmap

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

> **Timeline assumptions:** Estimates assume a single senior full-stack engineer with Temporal and K8s experience. Multiply by 0.6x for a 2-person team. Phases can overlap where dependencies allow (e.g., Phase 4 UI work can start during Phase 3 backend work).

## Phase 1a — Core Skeleton + Temporal (2–3 weeks)

- Nx monorepo: `orchestrator-api`, `orchestrator-worker`, `workflow-dsl`, `common/*`, `db`
- NestJS + Fastify bootstrap with healthcheck endpoints (`/health/live`, `/health/ready`)
- `AiAgentPort` interface — single `invoke()` method (the only port in the system)
- `libs/common/temporal/` — Temporal client factory, Worker factory, interceptors
- Docker Compose: app PostgreSQL + PgBouncer + Temporal auto-setup (server + UI + Elasticsearch for visibility) + agent Docker container for local dev fallback
- Worker validates full Temporal stack with no-op Workflow + Activity
- MikroORM entities + migrations: `Tenant`, `TenantMcpServer`, `TenantVcsCredential`, `TenantRepoConfig`, `WebhookDelivery`, `WorkflowMirror`, `WorkflowEvent`, `AgentSession`, `AgentToolCall`, `WorkflowDsl`
- `updateWorkflowMirror` Activity — writes state transitions to app DB
- `Result<T, E>` error handling setup
- Dev tooling: CLAUDE.md, MCP config, Pino → Loki pipeline
- Temporal namespace creation automation (one per tenant)

## Phase 1b — DSL Compiler + Sandbox (2–3 weeks)

> **Risk note:** The DSL compiler is the most complex component in the system — compiling typed YAML to deterministic Temporal Workflow code with version pinning, `patched()` hotfixes, and replay safety. This deserves a dedicated week, not a sub-item of Phase 1.

- Workflow DSL schema (Zod) + compiler (YAML → Temporal Workflow registration). Handle `signal_wait` type separately from `auto` (compiles to `condition()`, not `executeActivity()`)
- DSL version pinning: Workflow records `dslName + dslVersion` at start, replays use pinned version
- DSL compiler tests: validate every step type (`auto`, `signal_wait`, `gate`, `loop`, `terminal`) compiles to valid Temporal Workflow code. Test replay determinism with version changes
- **Agent sandbox setup:** Build E2B sandbox template from `Dockerfile.agent` with toolchain (Git, Node, Python, Go) via `e2b template build`. Deploy credential proxy service (K8s Deployment + Service + Ingress) from `Dockerfile.credential-proxy`. Validate sandbox with a test agent session — verify Firecracker isolation, credential proxy authentication (sandbox cannot access credentials without valid session token), session token scoping
- E2B template CI pipeline: `Dockerfile.agent` change → build E2B template (`e2b template build`) → smoke test
- Credential proxy deployment: K8s Deployment + Service + Ingress, JWT session token validation, rate limiting, audit logging

## Phase 2 — Webhook Handlers + Agent Integration (4–6 weeks)

- Thin webhook handlers: Jira, GitLab, GitHub, Linear (~50 lines each: verify signature, extract event, normalize)
- Webhook deduplication: delivery ID extraction + `WEBHOOK_DELIVERY` table persistence
- **Tenant CRUD API** — `POST/GET/PUT /tenants` + nested CRUD for MCP servers, VCS credentials, repo configs. Zod-validated. CLI seed script for initial tenant setup
- **Dashboard auth:** OIDC integration (Google/GitHub), API key generation per tenant, RBAC (admin/operator/viewer)
- Claude Code integration via `@anthropic-ai/claude-agent-sdk` — implements `AiAgentPort.invoke()`
- `invokeAgent` Activity: generate session token → create E2B sandbox via SDK → clone repo → setup → build prompt → pass MCP servers → start agent session → heartbeat → collect `AgentResult` (including `toolCalls` for `AGENT_TOOL_CALL` table) → verify agent output (branch exists, MR exists) → destroy sandbox → revoke session token
- Agent output verification: `git ls-remote` for branch, VCS API call for MR existence after agent reports success
- Differentiated retry strategy: retry on infra errors (sandbox OOM, E2B API failure). No retry on agent logic errors / cost limit / turn limit (`ApplicationFailure` with `nonRetryable: true`)
- Agent MCP pass-through: query `TENANT_MCP_SERVER` → build MCP config → pass to Agent SDK
- **Budget reservation:** reserve per-task cost cap from tenant's monthly budget at workflow start. Release surplus on completion. Reject new workflows when budget exhausted
- **Per-repo concurrency:** workflow ID = `{tenant}-{provider}-{taskId}`, but check `TENANT_REPO_CONFIG.max_concurrent_workflows` before starting. Queue excess workflows
- Graceful agent shutdown: SIGTERM at T-5min, 2-min grace period
- `cleanupBranch` Activity: delete remote branch + close draft MR when workflow reaches BLOCKED
- E2E single-repo: task webhook → Temporal Workflow → agent creates branch + code + MR → visible in Temporal UI

## Phase 3 — CI/Review Feedback Loops + Multi-Repo (2–3 weeks)

- CI webhook handlers → signal running Workflow (`pipelineFailed` / `pipelineSucceeded`)
- Review webhook handlers → signal (`changesRequested`)
- `ci_watch` step compiled as Workflow-level `condition()` wait (not an Activity) with 2h timeout
- `ci_fix_loop`: fresh `invoke()` call with `mode: ci_fix` — agent receives `previousSessionSummary`, checks out existing branch, fetches CI logs via MCP, fixes, pushes
- `review_fix_loop`: fresh `invoke()` call with `mode: review_fix` — same pattern with review comments
- Multi-repo: parent Temporal Workflow spawns child workflow executions. Configurable failure strategy (`wait_all` / `fail_fast`)
- E2E: red pipeline → agent fix loop → green pipeline → review → done

## Phase 4 — Gate UI + Cost Dashboard (2–3 weeks)

- Gate approval: `POST /workflows/:id/gates/:gateId/approve` → `gateApproved` signal (authenticated, RBAC-checked)
- Minimal dashboard:
  - Tenant config screens (MCP servers, VCS credentials, repo configs — from normalized tables)
  - Gate approval UI (workflows waiting for approval)
  - Cost dashboard from app DB (reserved vs actual, per-task breakdown)
  - Agent session viewer: tool calls timeline from `AGENT_TOOL_CALL` table
- Temporal UI remains primary visibility tool — link from dashboard per workflow
- Prometheus + Grafana dashboards: throughput, success rate, cost/task, E2B sandbox metrics
- Webhook delivery log viewer (from `WEBHOOK_DELIVERY` table)

## Phase 5 — Full Custom Dashboard (3–4 weeks)

- Workflow list: all workflows with status badges, filters — from `workflow_mirror` via Elasticsearch-backed Temporal queries
- Workflow detail: timeline from `workflow_event`, agent session panel (tool calls, summary), cost breakdown, link to Temporal UI
- SSE endpoint: real-time state updates tailing `workflow_event`
- Alerts on cost spikes, stuck workflows, failure rates, pod OOM kills
- Periodic reconciliation dashboard: stale mirrors, orphaned cost reservations

## Phase 6 — DSL Visual Editor (future)

- React Flow-based editor for workflow YAML DSL
- Drag-and-drop steps, gate condition editor, loop config
- Real-time Zod validation via `@ai-orchestrator/workflow-dsl`
- Per-tenant versioning and rollback

## Phase 7 — Cross-Platform Expansion (future)

- YouTrack, ClickUp webhook handlers + MCP server configs
- Bitbucket webhook handler + MCP server config
- OpenHands agent support via `AiAgentPort`
- Tenant onboarding wizard (self-service), team management, audit log viewer

---

## Open Questions

### Resolved

| Question | Decision | Rationale |
|---|---|---|
| **MikroORM vs Prisma** | **MikroORM** | Unit of Work, explicit transactions, better for Activity-level DB control where you need to confirm DB write before marking Activity complete |
| **Temporal DB: shared or dedicated PostgreSQL?** | **Dedicated** | Separate instance for isolation, independent scaling, simpler DR. SaaS with many tenants needs this |
| **Agent sandbox isolation** | **E2B sandboxes (cloud or self-hosted)** | Firecracker microVM per session — same isolation as AWS Lambda. E2B Cloud for zero-ops, self-hosted for data sovereignty. Same SDK/API in both modes. Open-source (Apache-2.0). Agent runs alone in sandbox — simpler security model than multi-container pod. See [Sandbox & Security](sandbox-and-security.md) |
| **Agent reliability for MR creation** | **`cleanupBranch` Activity** | When workflow reaches BLOCKED, a cleanup Activity deletes the remote branch and closes any draft MR. Prevents orphaned resources |
| **`resumeSession` semantics** | **No resume — fresh sessions** | Each invocation (implement, ci_fix, review_fix) is a fresh agent session. Previous session's `summary` + existing branch state provides continuity. No conversation history persistence needed |
| **Credential proxy isolation** | **External service model** (separate host) | Credential proxy runs as a standalone K8s service, not a sidecar. E2B sandbox and credential store are on completely separate hosts — stronger isolation than sidecar model. Session-scoped JWT authentication. See [Sandbox & Security — Credential Proxy](sandbox-and-security.md) |
| **Agent output trust** | **Server-side verification** | Activity verifies branch existence (`git ls-remote`) and MR existence (VCS API) after agent reports success. Prevents silent failures from hallucinating agents |
| **Retry strategy** | **Error-type differentiation** | Retry on infra errors (pod OOM, scheduling failure). No retry on agent logic errors, cost limit, turn limit. `ApplicationFailure` with `nonRetryable: true` |
| **Local dev sandbox** | **E2B sandboxes (same as production)** | E2B sandboxes (cloud or self-hosted) are API-driven and work from any environment. No fallback mode needed — same code path in development, CI, and production. `E2B_BASE_URL` switches between cloud and self-hosted |
| **DSL compiler timeline** | **Dedicated Phase 1b (2–3 weeks)** | DSL compiler is the most complex component — version pinning, replay determinism, `patched()` hotfixes. Deserves dedicated week, not a sub-item |

### Open

| Question | Context | Decision Needed By |
|---|---|---|
| **Gate approval UX: dashboard vs tracker comment** | Dashboard UI (explicit, traceable) vs reply to Jira/GitLab comment (easier for reviewers in the tracker). Both can coexist — comment triggers webhook, dashboard is fallback | Phase 4 start |
| **MCP server scoping per tenant** | Platform MCP servers give agent full access to the tenant's project. Need to verify each MCP server supports project/repo-level scoping to prevent cross-tenant data access via agent. Consider MCP server allowlisting (curated list of verified servers) vs open (tenant adds any server) | Phase 2 start |
| **Elasticsearch vs OpenSearch for Temporal visibility** | Both supported by Temporal. Elasticsearch is the default. OpenSearch is fully open-source (no licensing concerns). For self-hosted SaaS, OpenSearch may be preferable | Phase 1a start |
| **Agent conversation log storage** | `AGENT_TOOL_CALL` captures tool calls, but full conversation logs (reasoning, intermediate thoughts) could be valuable for debugging. Storage cost vs debugging value. Consider: store full logs in object storage (S3/GCS), reference from `AGENT_SESSION`, 30-day retention | Phase 2 |
| **Multi-repo review gate UX** | Parent workflow has N child MRs. Does the reviewer approve each MR individually (N approvals) or approve the parent workflow (1 approval, auto-merges all)? Former is safer but slower | Phase 3 |
| **E2B concurrency limits** | E2B has per-account concurrency limits for active sandboxes. With many concurrent workflows, we may hit the limit. Need to validate E2B tier limits and implement admission control if needed (queue excess sandbox creation requests) | Phase 2 |
| **Agent model routing per task complexity** | Default cost cap $5/task. Simple tasks (typo fix) cost ~$0.50 with Opus, could use Haiku/Sonnet for 5-10x savings. Complex tasks (refactor auth module) may need $20-50. No mechanism to estimate complexity or select model. Consider: task label-based model selection, or let agent start with cheap model and escalate | v2 |
| **E2B sandbox backpressure** | If 50 workflows start simultaneously, 50 sandbox creation calls hit E2B API. Temporal's `maxConcurrentActivityTaskExecutions` limits per-worker, but cluster-wide surge needs E2B tier capacity planning. Consider queuing excess requests with exponential backoff | Phase 2 |
| **E2B egress control** | E2B Cloud sandboxes have unrestricted outbound internet access. Self-hosted E2B allows infrastructure-level egress filtering (firewall rules). For E2B Cloud: current mitigation is zero-credential sandbox + session token scoping + prompt hardening. Consider: E2B network configuration features if available, or L7 proxy for credential proxy endpoint | Phase 2 |
| **`@anthropic-ai/claude-agent-sdk` availability** | If not released by Phase 2, implement agent loop in-house via `@anthropic-ai/sdk` Messages API + tool use. Increases Phase 2 scope by ~1 week | Phase 2 start |
| **E2B self-hosted deployment guide** | E2B is open-source and self-hostable. Document self-hosted E2B deployment procedure: hardware requirements (KVM-capable nodes), E2B orchestrator setup, template registry, networking with K8s cluster. Required for enterprise / regulated customers | Phase 2 |
| **Credential proxy high availability** | Credential proxy is a critical service — if it goes down, all sandboxes lose credential access. Need at least 2 replicas with health checks. Consider: circuit breaker in sandbox GIT_ASKPASS script, credential caching (short TTL) in sandbox for resilience | Phase 2 |
