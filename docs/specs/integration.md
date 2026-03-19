# Integration Model

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Agent-First Principle

The agent handles **all** interaction with external platforms via MCP servers. The orchestrator has **zero** outbound SDK dependencies — no `jira.js`, no `@gitbeaker/rest`, no `octokit`, no `@linear/sdk`.

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
  summary: string;                     // Agent-generated summary of what it did
  branchName?: string;
  mrUrl?: string;
  cost: { inputTokens: number; outputTokens: number; usd: number };
  turnCount: number;
  toolCalls: AgentToolCall[];          // Full tool call log for observability
}
```

**Why no `resumeSession`:** Claude Agent SDK sessions are stateless between invocations. "Resuming" would require persisting and replaying the full conversation history (potentially hundreds of tool calls over 60 min), which is impractical and wasteful. Instead, the previous session's `summary` + the existing branch state on VCS gives the agent everything it needs to continue effectively.

### MCP Servers (tenant-configured)

| Platform | MCP Server | Agent Uses For |
|---|---|---|
| **Jira** | `atlassian` MCP | Task details, status transitions, comments |
| **Linear** | `linear` MCP | Task details, status updates |
| **GitLab** | `gitlab` MCP | MR creation/comments, pipeline status, CI logs, file access |
| **GitHub** | `github` MCP | PR creation/comments, CI status, file access |
| **context7** | `context7` MCP | Up-to-date library docs |
| **smart-tree** | `smart-tree` MCP | AI-optimized repo structure |
| **Custom** | Any MCP server | Tenant adds Notion, Slack, internal tools |

### Normalized Task Statuses

| Status | Meaning |
|---|---|
| `backlog` | Not yet ready for AI |
| `ready_for_ai` | Triaged and approved |
| `plan_review` | Awaiting plan approval |
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
│  1. Create Kata Containers pod via K8s API:                          │
│     - runtimeClassName: kata-containers                               │
│     - Agent container: OCI image with toolchain (Git, Node, Python,  │
│       Go). No secrets mounted, no credential access                  │
│     - Credential-proxy sidecar: K8s Secret mounted, serves           │
│       localhost:9999                                                  │
│     - K8s NetworkPolicy: egress allowlist per namespace/pod          │
│     - K8s resource limits (CPU, memory, ephemeral storage)           │
│  2. Inside agent container:                                          │
│     a) GIT_ASKPASS configured to call credential proxy sidecar       │
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
│  3. Activity monitors pod, heartbeats to Temporal every 30s          │
│  4. Pod completes → Activity reads AgentResult                       │
│  5. Pod deleted (K8s garbage collection)                             │
│  6. Return AgentResult to Temporal Workflow                          │
└──────────────────────────────────────────────────────────────────────┘
```

For **fix loops** (CI fix / review fix), the `invokeAgent` Activity re-clones the repo, checks out the existing branch, and starts a **new agent session** with:
- `previousSessionSummary` — what the previous session implemented, which branch, which MR
- A fix-specific prompt — "CI pipeline failed, fix the issues" or "reviewer requested changes, address feedback"
- The agent then: fetches CI logs or review comments via MCP → fixes → pushes to the same branch

### Security Boundaries

- Agent **runs in a Kata Containers microVM pod** — hardware-level VM isolation (KVM), separate kernel per pod, no shared host kernel surface
- Agent **has zero credential access** — VCS PAT and MCP tokens are mounted only in the credential-proxy sidecar container. The agent container has no token env vars, no mounted secrets, no way to obtain credentials — K8s provides filesystem and process isolation between containers natively
- Agent **cannot access other tenants' data** — dedicated pod per session, MCP servers scoped to tenant's project/repo, Temporal namespace isolation per tenant
- Agent **cannot make arbitrary network calls** — K8s NetworkPolicy restricts egress to a per-namespace allowlist: platform APIs + MCP endpoints + DNS. All other outbound traffic is denied. The agent cannot modify NetworkPolicy from inside the pod
- Agent **can run any command inside the pod** — no Bash allowlist needed; Kata VM boundary + K8s NetworkPolicy + credential proxy sidecar provides real isolation regardless of what the agent executes
- Platform MCP servers provide **full read/write access** to the tenant's resources — this is intentional; the agent needs to transition statuses, add comments, and interact with CI

### Sandbox Observability

Agent pod logs flow into the centralized observability stack (Loki + Grafana) for debugging and audit:

1. **Agent stdout/stderr** — K8s pod log collection via Promtail/Alloy scrapes container logs natively. Logs are labeled with `workflowId` and `podName` as correlation fields and shipped to Loki automatically
2. **Credential proxy logs** — the credential-proxy sidecar writes to stdout/stderr. Promtail/Alloy scrapes these as a separate container stream, automatically labeled with the container name
3. **Pod lifecycle events** — pod creation time, image tag, resource limits, termination reason (completed / OOM / timeout / error) are logged by the Activity as structured events
4. **Correlation** — all pod logs share the same `traceId` / `workflowId` / `podName`, enabling cross-component queries in Grafana: webhook → workflow → activity → pod

Unlike manual log collection, K8s-native log scraping means logs are captured even if the Activity crashes — Promtail/Alloy operates independently at the node level.

### Activity Heartbeating

Long-running agent sessions (up to 60 min) require Temporal Activity heartbeating to detect dead workers promptly:

- The `invokeAgent` Activity monitors the Kata pod and heartbeats every **30 seconds** with the current agent phase (`cloning`, `implementing`, `testing`, `linting`, `building`, `pushing`, `creating_mr`)
- Temporal's `heartbeatTimeout` is set to **90 seconds** — if a worker dies, Temporal reschedules the Activity within 90s instead of waiting for the full 60-minute `startToCloseTimeout`
- On rescheduling, the Activity receives the last heartbeat details. It checks if the Kata pod is still running (orphaned from previous worker). If running, it reattaches via pod name and continues monitoring. If not, it starts a fresh agent session
- **Graceful shutdown at T-5min:** Activity tracks elapsed time. At T-5min before `startToCloseTimeout`, it sends a shutdown signal to the pod, giving the agent 2 minutes to commit partial work and push. This prevents hard kills at the timeout boundary

---

## Agent Prompt & Context Strategy

There is no separate Context Enrichment layer. The agent gathers its own context via MCP servers — the orchestrator only provides the minimal seed: task ID, repo URL, and `CLAUDE.md` instructions.

### Prompt Structure

The `invokeAgent` Activity builds the agent prompt from:

1. **System prompt** — Role definition, coding guidelines from `.ai-orchestrator.yaml` / `CLAUDE.md`, output format expectations
2. **Task seed** — Task ID + task provider (e.g., `PROJ-123`, `jira`). Agent fetches full details via MCP
3. **Repo info** — Cloned repo path, branch naming convention, setup/test/lint/build commands
4. **Workflow instructions** — What the agent should do in this invocation (implement / fix CI / fix review)

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
