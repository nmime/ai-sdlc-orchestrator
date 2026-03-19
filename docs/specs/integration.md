# Integration Model

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Agent-First Principle

The agent handles **all** interaction with external platforms via MCP servers. The orchestrator has **zero** outbound *platform* SDK dependencies — no `jira.js`, no `@gitbeaker/rest`, no `octokit`, no `@linear/sdk`. The `invokeAgent` Activity performs lightweight verification calls (HTTP GET) against VCS APIs via the credential proxy service after agent completion — these use a generic HTTP client, not a platform SDK.

```
Orchestrator code (per platform):  ~50 lines webhook handler (inbound only)
Agent code (per platform):          0 lines — MCP servers handle everything
```

Adding a new platform = writing a thin webhook handler + configuring the platform's MCP server in tenant config.

### What the Orchestrator Handles (inbound only)

Thin webhook handlers — verify signature, extract event, normalize, signal Temporal:

| Platform | Webhook Verification | Extract |
|---|---|---|
| **Jira** | HMAC-SHA256 via `X-Hub-Signature` header | `webhookEvent` + `issue.key` |
| **GitLab** | `X-Gitlab-Token` header match | event type + `project.id` + entity ID |
| **GitHub** | HMAC-SHA256 via `X-Hub-Signature-256` header | `X-GitHub-Event` + entity ID |
| **Linear** | HMAC-SHA256 via signature header | `type` + `data.id` |

### What the Agent Handles (via MCP)

Everything outbound — the agent has the full platform MCP tool set:

| Operation | Agent Does Via |
|---|---|
| Fetch task details, acceptance criteria | Task tracker MCP (`jira_get_issue`, `linear` MCP) |
| Gather context (similar MRs, linked issues) | VCS MCP (`list_merge_requests`), task tracker MCP |
| Create branch | `git checkout -b` (Bash) |
| Implement code | Built-in tools (Read / Write / Edit / Bash) |
| Run tests, lint, build | Bash |
| Create MR / PR | VCS MCP (`create_merge_request` / `create_pull_request`) |
| Push code | `git push` (Bash) |
| Read CI logs | VCS MCP (`get_pipeline_job_output`) |
| Transition task status | Task tracker MCP (`jira_transition_issue`) |
| Add comments | Task tracker MCP (`jira_add_comment`) |
| Respond to review | VCS MCP (`mr_discussions`) → fix → push |

### AiAgentPort (the only port)

Every invocation — initial implementation, CI fix, review fix — is a **fresh agent session**. There is no "resume" at the SDK level. The `invokeAgent` Activity always:

1. Clones the repo fresh (stateless workers — Temporal can reschedule to any worker)
2. For fix loops: checks out the existing branch the previous session created
3. Builds an invocation-type-specific prompt (implement / ci_fix / review_fix)
4. Passes the previous session summary so the agent has continuity without needing full conversation history

```typescript
interface AiAgentPort {
  invoke(params: AgentInvocation): AsyncResult<AgentResult>;
  cancel(sessionId: string): AsyncResult<void>;
}

interface AgentInvocation {
  workflowId: string;
  repoPath: string;                    // Already cloned by the Activity
  prompt: string;                      // Different per invocation type
  mcpServers: McpServerConfig[];
  costLimitUsd: number;
  maxTurns: number;
  previousSessionSummary?: string;     // For fix loops — what was done, what branch, what MR
}

interface AgentResult {
  sessionId: string;
  status: 'success' | 'failure' | 'cost_limit' | 'turn_limit';
  errorCode?: string;                  // Structured error classification
  errorMessage?: string;               // Human-readable error description
  summary: string;                     // Agent-generated summary of what it did
  branchName?: string;
  mrUrl?: string;
  cost: { inputTokens: number; outputTokens: number; usd: number };
  turnCount: number;
  toolCalls: AgentToolCall[];          // Full tool call log for observability
}
```

**Why no `resumeSession`:** Claude Agent SDK sessions are stateless between invocations. "Resuming" would require persisting and replaying the full conversation history (potentially hundreds of tool calls over 60 min), which is impractical and wasteful. Instead, the previous session's `summary` + the existing branch state on VCS gives the agent everything it needs to continue effectively.

**`cancel()` implementation:** Writes a `/workspace/.shutdown-requested` sentinel file via E2B SDK, waits up to 2 minutes for graceful completion (agent commits and pushes partial work), then destroys the sandbox via E2B SDK. The Activity returns a partial `AgentResult` with `status: 'failure'` and `errorCode: 'cancelled'`.

### MCP Servers (tenant-configured)

| Platform | MCP Server | Agent Uses For |
|---|---|---|
| **Jira** | `atlassian` MCP | Task details, status transitions, comments |
| **Linear** | `linear` MCP | Task details, status updates |
| **GitLab** | `gitlab` MCP | MR creation/comments, pipeline status, CI logs, file access |
| **GitHub** | `github` MCP | PR creation/comments, CI status, file access |
| **context7** | `context7` MCP | Up-to-date library docs |
| **smart-tree** | `smart-tree` MCP | AI-optimized repo structure |
| **Sequential Thinking** | `sequential-thinking` MCP | Structured reasoning for complex tasks |
| **Custom** | Any MCP server | Tenant adds Notion, Slack, internal tools |

### Normalized Task Statuses

| Status | Meaning |
|---|---|
| `backlog` | Not yet ready for AI |
| `ready_for_ai` | Triaged and approved |
| `plan_review` | Awaiting plan approval *(reserved for DSL variants with plan review gate — not used in default workflow)* |
| `ai_in_progress` | Agent actively implementing |
| `ai_blocked` | Failed, needs human |
| `in_review` | MR open, CI green |
| `changes_requested` | Reviewer requested changes |
| `done` | Merged, complete |

---

## Agent Communication Model

The agent is the primary actor in the system. It runs inside a Temporal Activity (`invokeAgent`) and handles all platform interaction via MCP servers + built-in tools.

### Agent Tools

**Built-in (always available):** `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep` — covers code work, tests, git operations.

**Platform MCP (per-tenant):** `atlassian`, `gitlab`, `github`, `linear` — covers all platform interaction: task details, MR/PR creation, CI logs, status transitions, comments.

**Productivity MCP (per-tenant):** `context7`, `smart-tree`, `sequential-thinking` — improves agent quality.

All MCP servers are plug-and-play from tenant config. Orchestrator passes them to Agent SDK as-is:

```typescript
// Inside invokeAgent Activity — zero hardcoded servers
const mcpServers = tenantConfig.agentMcpServers;
// Orchestrator doesn't know or care what servers are in the list
```

The tenant can add any MCP server — Notion, Slack, custom internal tools.

### Agent Workflow (inside `invokeAgent` Activity)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Temporal Activity                            │
│                                                                      │
│  1. Generate session token (JWT: tenantId, sessionId, short TTL)    │
│  2. Create E2B sandbox via SDK:                                      │
│     - Template: agent-sandbox (Dockerfile.agent)                     │
│     - Env: ANTHROPIC_API_KEY, SESSION_TOKEN,                        │
│       CREDENTIAL_PROXY_URL, TRACEPARENT                             │
│     - Timeout: startToCloseTimeout + 5-min buffer                   │
│     - No secrets mounted, no VCS/MCP credential access               │
│  3. Inside sandbox:                                                  │
│     a) GIT_ASKPASS configured to call credential proxy service       │
│     b) Clone repo to /workspace (auth via proxy)                     │
│     c) For fix loops: checkout existing branch                       │
│     d) Build agent prompt (task ID, repo info, CLAUDE.md)            │
│     e) Pass tenant's MCP server list                                 │
│     f) Start agent session — agent autonomously:                     │
│                                                                      │
│        i)   Fetch task details    → task tracker MCP                 │
│        ii)  Gather context        → MCP: similar MRs, linked issues, │
│                                     library docs, repo structure     │
│        iii) Create branch         → git checkout -b (Bash)           │
│        iv)  Implement code        → Read / Write / Edit              │
│        v)   Run tests/lint/build  → Bash                             │
│        vi)  Commit + Push         → git commit + git push (Bash)     │
│        vii) Create MR/PR         → VCS MCP                          │
│        viii)Transition status     → task tracker MCP                 │
│                                                                      │
│  4. Activity monitors sandbox, heartbeats to Temporal every 30s      │
│  5. Sandbox completes → Activity reads AgentResult via E2B SDK       │
│  6. Sandbox destroyed (E2B SDK). Session token revoked               │
│  7. Return AgentResult to Temporal Workflow                          │
└──────────────────────────────────────────────────────────────────────┘
```

For **fix loops** (CI fix / review fix), the `invokeAgent` Activity re-clones the repo, checks out the existing branch, and starts a **new agent session** with:
- `previousSessionSummary` — what the previous session implemented, which branch, which MR
- A fix-specific prompt — "CI pipeline failed, fix the issues" or "reviewer requested changes, address feedback"
- The agent then: fetches CI logs or review comments via MCP → fixes → pushes to the same branch

### Security Boundaries

- Agent **runs in a dedicated E2B sandbox** — Firecracker microVM isolation (same as AWS Lambda), separate kernel per sandbox, no shared host kernel surface
- Agent **has zero credential access** — VCS PATs and MCP tokens are stored in the K8s cluster and served only via the credential proxy service. The sandbox has no token env vars, no mounted secrets — credentials are on the K8s cluster, not in the sandbox VM
- Agent **cannot access other tenants' data** — dedicated sandbox per session, session token scoped to tenant, MCP servers scoped to tenant's project/repo, Temporal namespace isolation per tenant
- Agent **has outbound network access** — needed for Claude API, platform APIs, and MCP endpoints. With E2B Cloud, sandboxes have unrestricted internet egress. With self-hosted E2B, egress can be restricted at the infrastructure level (firewall rules). Mitigated in both modes by: zero-credential sandbox (nothing to exfiltrate), short-lived session tokens, agent prompt hardening
- Agent **can run any command inside the sandbox** — no Bash allowlist needed; Firecracker VM boundary + zero-credential model + credential proxy service provides real isolation regardless of what the agent executes
- Platform MCP servers provide **full read/write access** to the tenant's resources — this is intentional; the agent needs to transition statuses, add comments, and interact with CI

### Sandbox Observability

Agent sandbox logs flow into the centralized observability stack (Loki + Grafana) for debugging and audit:

1. **Agent stdout/stderr** — the `invokeAgent` Activity reads agent logs from the E2B sandbox via SDK before destroying it. Logs are labeled with `workflowId`, `sandboxId`, and `tenantId` as correlation fields and shipped to Loki
2. **Credential proxy logs** — the credential proxy service runs as a K8s pod. Promtail/Alloy scrapes its container logs natively, automatically labeled with the pod name. Includes audit logs of every credential request (session token, endpoint, response status)
3. **Sandbox lifecycle events** — sandbox creation time, template ID, timeout, termination reason (completed / OOM / timeout / error) are logged by the Activity as structured events
4. **Correlation** — all logs share the same `traceId` / `workflowId` / `sandboxId`, enabling cross-component queries in Grafana: webhook → workflow → activity → sandbox

**Log collection resilience:** If the Activity crashes before collecting sandbox logs, the reconciliation CronJob (which terminates orphaned sandboxes) also collects and ships their logs before destruction.

### MCP Server Lifecycle Inside Agent Pod

- **`command`-type MCP servers** (local process) are started by the Agent SDK automatically when the agent session begins — the SDK spawns MCP server processes based on the config passed to it
- **`url`-type MCP servers** (remote HTTP/SSE) are connected to by the SDK — no local process management needed
- If a local MCP server process crashes, the Agent SDK retries the tool call (built-in retry). If the server is unrecoverable, the tool becomes unavailable and the agent adapts its approach
- The sandbox's entrypoint script validates MCP server availability (health check on `command`-type servers, connectivity check on `url`-type) before starting the agent session

### MCP Token Injection

MCP servers that require authentication receive tokens via environment variables injected by a sandbox-level init script. The init script reads tokens from the credential proxy service (`curl -H "Authorization: Bearer $SESSION_TOKEN" $CREDENTIAL_PROXY_URL/mcp-token/{server-name}`) during sandbox startup (before the agent session begins) and sets them as environment variables for the MCP server processes. This runs once at startup, not per-request. The agent process itself never sees the raw MCP tokens — they are passed directly to the MCP server processes via their environment.

### Activity ↔ Sandbox Communication Protocol

- **Prompt injection:** The agent prompt + MCP config is written to `/etc/agent/invocation.json` in the E2B sandbox via SDK filesystem API at creation time. The sandbox's entrypoint reads this file to configure the agent session
- **Result extraction:** The agent writes `AgentResult` JSON to `/workspace/.agent-result.json` on completion. The Activity reads this file via E2B SDK filesystem API after sandbox completion. If the file is missing (crash/OOM), the Activity constructs a failure `AgentResult` from the sandbox exit status and collected logs
- **Graceful shutdown:** The Activity writes a sentinel file `/workspace/.shutdown-requested` via E2B SDK filesystem API. The agent's system prompt instructs: "Check for `/workspace/.shutdown-requested` between tool calls. If present, wrap up immediately"

### Activity Heartbeating

Long-running agent sessions (up to 60 min) require Temporal Activity heartbeating to detect dead workers promptly:

- The `invokeAgent` Activity monitors the E2B sandbox and heartbeats every **30 seconds** with sandbox status (`running` / `completed` / `failed`) and elapsed time
- **Agent-internal phase** (`implementing`, `testing`, etc.) is **not observable from the Activity** — the agent process does not expose its internal phase via an API. Phase-level observability is available via agent logs (the Agent SDK logs tool calls to stdout as structured JSON, collected by the Activity). The heartbeat carries: sandbox status, elapsed time, last known agent output line
- Temporal's `heartbeatTimeout` is set to **90 seconds** — if a worker dies, Temporal reschedules the Activity within 90s instead of waiting for the full 60-minute `startToCloseTimeout`
- On rescheduling, the Activity receives the last heartbeat details. It checks if the E2B sandbox is still running (via SDK). If running, it reattaches via sandbox ID and continues monitoring. If not (terminated by E2B timeout), it starts a fresh agent session
- **Graceful shutdown at T-5min:** Activity tracks elapsed time. At T-5min before `startToCloseTimeout`, it writes a sentinel file `/workspace/.shutdown-requested` via E2B SDK filesystem API. The agent's system prompt instructs: "Between tool calls, check if `/workspace/.shutdown-requested` exists. If present, commit and push partial work immediately, then exit." The Activity waits up to 2 min for graceful completion before destroying the sandbox

---

## Agent Prompt & Context Strategy

There is no separate Context Enrichment layer. The agent gathers its own context via MCP servers — the orchestrator only provides the minimal seed: task ID, repo URL, and `CLAUDE.md` instructions.

### Prompt Structure

The `invokeAgent` Activity builds the agent prompt from:

1. **System prompt** — Role definition, coding guidelines from `.ai-orchestrator.yaml` / `CLAUDE.md`, output format expectations
2. **Task seed** — Task ID + task provider (e.g., `PROJ-123`, `jira`). Agent fetches full details via MCP
3. **Repo info** — Cloned repo path, branch naming convention, setup/test/lint/build commands
4. **Workflow instructions** — What the agent should do in this invocation (implement / fix CI / fix review)
5. **Branch naming** — branch prefix from `TENANT_REPO_CONFIG.branch_prefix` (default: `ai/`), injected as `branchPrefix` in the agent prompt. Agent constructs branch name as `{branchPrefix}{taskId}` (e.g., `ai/PROJ-123`)

### Agent-Driven Context Gathering

The system prompt instructs the agent to gather context before implementing:

```
Before implementing, you MUST:
1. Fetch the full task from Jira/Linear MCP — read description, acceptance criteria, linked issues
2. Review CLAUDE.md and .ai-orchestrator.yaml in the repo root for coding conventions
3. Use smart-tree MCP to understand the repo structure
4. Search for similar recent MRs via VCS MCP to understand patterns
5. Use context7 MCP for any unfamiliar libraries referenced in the task
```

This replaces a dedicated Context Enrichment orchestrator layer with agent intelligence. The agent decides what context it needs and fetches it on demand — more flexible, less code.

### Fix Loop Prompts (CI fix / review fix)

Fix loops use a fresh `invoke()` call with a fix-specific prompt and the previous session's summary:

- **CI fix prompt:** `"You previously implemented [summary]. The CI pipeline on branch [branch] failed. Fetch the pipeline logs via VCS MCP and fix the issues. Push to the same branch."`
- **Review fix prompt:** `"You previously implemented [summary]. The reviewer requested changes on MR [mrUrl]. Fetch the discussion threads via VCS MCP and address the feedback. Push to the same branch."`

The agent fetches the actual logs/comments via MCP — the orchestrator doesn't parse or preprocess them. The `previousSessionSummary` field gives the agent continuity without needing the full conversation history.
