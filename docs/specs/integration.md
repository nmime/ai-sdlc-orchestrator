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
4. Passes the previous session context so the agent has continuity without needing full conversation history

```typescript
type AgentProvider = 'claude' | 'openhands' | 'aider';

interface AiAgentPort {
  invoke(params: AgentInvocation): AsyncResult<AgentResult>;
  cancel(sessionId: string): AsyncResult<void>;
}

interface AgentInvocation {
  workflowId: string;
  provider: AgentProvider;
  model?: string;
  repoPath: string;                    // Already cloned by the Activity
  prompt: AgentPromptData;             // Canonical prompt data — formatted per provider
  mcpServers: McpServerConfig[];
  costLimitUsd: number;
  maxTurns: number;
  previousSessionContext?: SessionContext;
  staticAnalysisCommand?: string;      // e.g., 'npm run lint && npm run typecheck'
  sparseCheckoutPaths?: string[];      // Limit clone to specific paths for large repos
  workflowVariables?: Record<string, string>; // Tenant-defined key-value pairs passed to prompt
}

interface AgentPromptData {
  taskSeed: string;              // Original task description from platform
  repoInfo: {
    url: string;
    branch: string;
    defaultBranch: string;
    paths?: string[];            // allowed_paths from repo config
  };
  workflowInstructions: {
    qualityGates: string[];      // ['test', 'lint', 'typecheck', 'build']
    maxDiffLines?: number;
    allowedPaths?: string[];
    commitMessagePattern?: string;
    mrDescriptionTemplate?: string;
    staticAnalysisCommand?: string;
  };
  mcpServers: McpServerConfig[];
  previousContext?: SessionContext;
}

interface PromptFormatter {
  provider: AgentProvider;
  format(data: AgentPromptData): string;
}

interface SessionContext {
  summary: string;
  filesModified: string[];
  testOutputSnippet?: string;
  toolCallsSummary: string[];
  errorCode?: string;
  branchName: string;
  mrUrl?: string;
}

interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  filesChanged: string[];
}

interface AgentResult {
  sessionId: string;
  provider: AgentProvider;
  model: string;
  status: 'success' | 'failure' | 'cost_limit' | 'turn_limit';
  errorCode?: string;                  // Structured error classification
  errorMessage?: string;               // Human-readable error description
  summary: string;                     // Agent-generated summary of what it did
  branchName?: string;
  mrUrl?: string;
  mrDescription?: string;
  commitMessages?: string[];
  diffStats?: DiffStats;
  cost: {
    ai: { inputTokens: number; outputTokens: number; usd: number; provider: AgentProvider; model: string };
    sandbox: { durationSeconds: number; usd: number };
    totalUsd: number;
  };
  turnCount: number;
  toolCalls: AgentToolCall[];          // Full tool call log for observability
  staticAnalysisResult?: 'passed' | 'failed' | 'skipped';
  staticAnalysisOutput?: string;
}
```

**Why no `resumeSession`:** Agent sessions (regardless of provider) are stateless between invocations. "Resuming" would require persisting and replaying the full conversation history (potentially hundreds of tool calls over 60 min), which is impractical and wasteful. Instead, the previous session's `SessionContext` + the existing branch state on VCS gives the agent everything it needs to continue effectively. Critically, `SessionContext` provides **server-side ground truth** — the orchestrator constructs it from actual `AGENT_TOOL_CALL` records, test outputs, and `AgentResult` data rather than relying on the agent's self-reported summary. This means fix-loop context is based on observed behavior (which files were actually modified, which tests actually failed) rather than the agent's potentially inaccurate or hallucinated recollection.

**`cancel()` implementation:** Writes a `/workspace/.shutdown-requested` sentinel file via `SandboxPort.writeFile()`, waits up to 2 minutes for graceful completion (agent commits and pushes partial work), then destroys the sandbox via `SandboxPort.destroy()`. Backend-agnostic — works identically with E2B and Agent Sandbox + Kata. The Activity returns a partial `AgentResult` with `status: 'failure'` and `errorCode: 'cancelled'`.

### Agent Provider Resolution

The orchestrator resolves which AI agent provider and model to use via a three-level fallback chain:

1. **Repo config** `agent_provider` / `agent_model` — most specific, per-repository override
2. **Tenant config** `default_agent_provider` / `default_agent_model` — tenant-wide default
3. **System default** — `'claude'` with the default model for that provider

```typescript
const DEFAULT_MODELS: Record<AgentProvider, string> = {
  claude: 'claude-opus-4-6',
  openhands: 'claude-opus-4-6',   // OpenHands uses LLM provider underneath
  aider: 'claude-opus-4-6',       // Aider uses LLM provider underneath
};

function resolveProvider(repoConfig, tenantConfig): { provider: AgentProvider; model: string } {
  const provider = repoConfig.agent_provider ?? tenantConfig.default_agent_provider ?? 'claude';
  const model = repoConfig.agent_model ?? tenantConfig.default_agent_model ?? DEFAULT_MODELS[provider];
  return { provider, model };
}
```

This allows tenants to experiment with different providers per-repo while keeping a stable default, and allows the system operator to set a global default.

### Prompt Format Abstraction

Each agent provider expects prompts in a different format — Claude uses a system prompt + human message, OpenHands uses a task description with its own conventions, Aider uses a coding-focused instruction format. The orchestrator decouples task semantics from provider-specific prompt engineering via `PromptFormatter`:

- **`ClaudePromptFormatter`** — Builds a structured system prompt with role definition, `CLAUDE.md` instructions, and a human message with task details, workflow instructions, and MCP server configuration
- **`OpenHandsPromptFormatter`** — Translates `AgentPromptData` into OpenHands' task specification format with workspace setup instructions
- **`AiderPromptFormatter`** — Converts to Aider's coding instruction format with file context hints and edit mode configuration

The orchestrator constructs canonical `AgentPromptData` once, then the resolved `PromptFormatter` transforms it to the provider-specific format. Adding a new provider = implementing a new `PromptFormatter` + an adapter for the provider's SDK/CLI.

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

### Prompt Injection Defense

Agent sessions are exposed to untrusted input — task descriptions from issue trackers, code review comments, repository contents. A three-layer defense mitigates prompt injection risks:

1. **Input sanitization:** Before constructing `AgentPromptData`, the orchestrator strips known injection patterns from task descriptions and review comments — system prompt overrides (`<|system|>`, `[INST]`), role-play instructions ("ignore previous instructions", "you are now"), base64-encoded command blocks, and Unicode homoglyph obfuscation. Sanitized fields are logged for audit
2. **Output validation:** After agent completion, the orchestrator scans `AgentResult` outputs (MR descriptions, commit messages, file diffs) for credential patterns (`-----BEGIN.*KEY-----`, `AKIA[0-9A-Z]{16}`, `ghp_`, `glpat-`), suspicious URLs (data exfiltration endpoints), and encoded payloads (base64 blobs in source code). Flagged results are quarantined for human review before the MR is published
3. **Credential proxy anomaly detection:** Unusual API call patterns from within the sandbox are flagged — see [Sandbox & Security — Credential Proxy Anomaly Detection](sandbox-and-security.md)

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

All MCP servers are plug-and-play from tenant config. Orchestrator passes them to the AI agent runtime as-is:

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
│  2. Resolve agent provider + model (repo → tenant → system default) │
│  3. Create sandbox via SandboxPort.create():                          │
│     - E2B: E2B template | Agent Sandbox: SandboxClaim from warm pool │
│     - Template source: Dockerfile.agent (shared by both backends)    │
│     - Env: AI_PROVIDER_API_KEY, SESSION_TOKEN,                      │
│       CREDENTIAL_PROXY_URL, TRACEPARENT                             │
│     - Timeout: startToCloseTimeout + 5-min buffer                   │
│     - No secrets mounted, no VCS/MCP credential access               │
│  4. Inside sandbox (via SandboxPort.exec()):                          │
│     a) GIT_ASKPASS configured to call credential proxy service       │
│     b) Clone repo to /workspace (auth via proxy)                     │
│     c) For fix loops: checkout existing branch                       │
│     d) Build agent prompt via resolved PromptFormatter               │
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
│  5. Activity monitors sandbox, heartbeats to Temporal every 30s      │
│  6. Sandbox completes → Activity reads AgentResult via                │
│     SandboxPort.readFile()                                           │
│  7. Sandbox destroyed (SandboxPort.destroy()). Session token revoked │
│  8. Return AgentResult to Temporal Workflow                          │
└──────────────────────────────────────────────────────────────────────┘
```

For **fix loops** (CI fix / review fix), the `invokeAgent` Activity re-clones the repo, checks out the existing branch, and starts a **new agent session** with:
- `previousSessionContext` — structured data about the previous session: files modified, test output, tool calls summary, branch, MR URL
- A fix-specific prompt — "CI pipeline failed, fix the issues" or "reviewer requested changes, address feedback"
- The agent then: fetches CI logs or review comments via MCP → fixes → pushes to the same branch

### Security Boundaries

- Agent **runs in a dedicated sandbox** — Firecracker microVM (E2B) or Kata Containers KVM microVM (Agent Sandbox). Both provide hardware-level isolation: separate kernel per sandbox, no shared host kernel surface. Backend selected per deployment model via `SandboxPort`
- Agent **has zero credential access** — VCS PATs and MCP tokens are stored in the K8s cluster and served only via the credential proxy service. The sandbox has no token env vars, no mounted secrets — credentials are on the K8s cluster, not in the sandbox VM
- Agent **cannot access other tenants' data** — dedicated sandbox per session, session token scoped to tenant, MCP servers scoped to tenant's project/repo, Temporal namespace isolation per tenant
- Agent **has outbound network access** — needed for AI provider API, platform APIs, and MCP endpoints. Egress control varies by backend: E2B Cloud uses `allowOut`/`denyOut` API; E2B BYOC uses AWS Security Groups; Agent Sandbox + Kata uses **K8s NetworkPolicy per SandboxTemplate** (secure-by-default: blocks all private IPs, allows public internet only). Mitigated in all backends by: zero-credential sandbox (nothing to exfiltrate), short-lived session tokens, agent prompt hardening
- Agent **can run any command inside the sandbox** — no Bash allowlist needed; VM boundary + zero-credential model + credential proxy service provides real isolation regardless of what the agent executes
- Platform MCP servers provide **full read/write access** to the tenant's resources — this is intentional; the agent needs to transition statuses, add comments, and interact with CI

### Sandbox Observability

Agent sandbox logs flow into the centralized observability stack (Loki + Grafana) for debugging and audit:

1. **Agent stdout/stderr:**
   - **E2B backend:** The `invokeAgent` Activity reads agent logs from the sandbox via `SandboxPort.readFile()` before destroying it. Logs shipped to Loki with correlation labels
   - **Agent Sandbox backend:** Sandbox pod logs are scraped directly by Promtail/Alloy (standard K8s pod log collection). Labels from pod annotations include `sandboxclaim-name` and `tenant-id`
2. **Credential proxy logs** — the credential proxy service runs as a K8s pod. Promtail/Alloy scrapes its container logs natively, automatically labeled with the pod name. Includes audit logs of every credential request (session token, endpoint, response status)
3. **Sandbox lifecycle events** — sandbox creation time, template ID, timeout, termination reason (completed / OOM / timeout / error) are logged by the Activity as structured events
4. **Correlation** — all logs share the same `traceId` / `workflowId` / `sandboxId`, enabling cross-component queries in Grafana: webhook → workflow → activity → sandbox

**Log collection resilience:** If the Activity crashes before collecting sandbox logs: E2B backend — reconciliation CronJob collects logs before destroying orphaned sandboxes. Agent Sandbox backend — pod logs are already collected by Promtail/Alloy before the SandboxClaim TTL triggers garbage collection.

### MCP Server Lifecycle Inside Agent Pod

- **`command`-type MCP servers** (local process) are started by the AI agent runtime automatically when the agent session begins — the runtime spawns MCP server processes based on the config passed to it
- **`url`-type MCP servers** (remote HTTP/SSE) are connected to by the runtime — no local process management needed
- If a local MCP server process crashes, the AI agent runtime retries the tool call (built-in retry). If the server is unrecoverable, the tool becomes unavailable and the agent adapts its approach
- The sandbox's entrypoint script validates MCP server availability (health check on `command`-type servers, connectivity check on `url`-type) before starting the agent session

### MCP Token Injection

MCP servers that require authentication receive tokens via environment variables injected by a sandbox-level init script. The init script reads tokens from the credential proxy service (`curl -H "Authorization: Bearer $SESSION_TOKEN" $CREDENTIAL_PROXY_URL/mcp-token/{server-name}`) during sandbox startup (before the agent session begins) and sets them as environment variables for the MCP server processes. This runs once at startup, not per-request. The agent process itself never sees the raw MCP tokens — they are passed directly to the MCP server processes via their environment.

### Activity ↔ Sandbox Communication Protocol

All communication uses `SandboxPort` — backend-agnostic:

- **Prompt injection:** The agent prompt + MCP config is written to `/etc/agent/invocation.json` via `SandboxPort.writeFile()` at creation time. The sandbox's entrypoint reads this file to configure the agent session
- **Result extraction:** The agent writes `AgentResult` JSON to `/workspace/.agent-result.json` on completion. The Activity reads this file via `SandboxPort.readFile()` after sandbox completion. If the file is missing (crash/OOM), the Activity constructs a failure `AgentResult` from the sandbox exit status and collected logs
- **Graceful shutdown:** The Activity writes a sentinel file `/workspace/.shutdown-requested` via `SandboxPort.writeFile()`. The agent's system prompt instructs: "Check for `/workspace/.shutdown-requested` between tool calls. If present, wrap up immediately"

### Activity Heartbeating

Long-running agent sessions (up to 60 min) require Temporal Activity heartbeating to detect dead workers promptly:

- The `invokeAgent` Activity monitors the sandbox and heartbeats every **30 seconds** with sandbox status (`running` / `completed` / `failed`) and elapsed time
- **Agent-internal phase** (`implementing`, `testing`, etc.) is **not observable from the Activity** — the agent process does not expose its internal phase via an API. Phase-level observability is available via agent logs (the AI agent runtime logs tool calls to stdout as structured JSON, collected by the Activity). The heartbeat carries: sandbox status, elapsed time, last known agent output line
- Temporal's `heartbeatTimeout` is set to **90 seconds** — if a worker dies, Temporal reschedules the Activity within 90s instead of waiting for the full 60-minute `startToCloseTimeout`
- On rescheduling, the Activity receives the last heartbeat details. It checks if the sandbox is still running: E2B backend checks via E2B SDK, Agent Sandbox backend checks via K8s pod status. If running, it reattaches via sandbox ID / SandboxClaim name and continues monitoring. If not, it starts a fresh agent session
- **Graceful shutdown at T-5min:** Activity tracks elapsed time. At T-5min before `startToCloseTimeout`, it writes a sentinel file `/workspace/.shutdown-requested` via `SandboxPort.writeFile()`. The agent's system prompt instructs: "Between tool calls, check if `/workspace/.shutdown-requested` exists. If present, commit and push partial work immediately, then exit." The Activity waits up to 2 min for graceful completion before destroying the sandbox via `SandboxPort.destroy()`

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

Fix loops use a fresh `invoke()` call with a fix-specific prompt and the previous session's `SessionContext`. Structured context provides significantly better signal than a free-text summary:

Instead of passing a bare string like `"The agent tried to fix the test but failed"`, the orchestrator constructs `SessionContext` from server-side records:

```typescript
// Orchestrator builds SessionContext from AGENT_TOOL_CALL records + AgentResult
const previousContext: SessionContext = {
  summary: "Implemented authentication middleware for /api/protected routes",
  filesModified: ["src/auth.ts", "src/middleware/protect.ts", "src/auth.test.ts"],
  testOutputSnippet: "FAIL src/auth.test.ts\n  Expected: 200\n  Received: 401\n  at Object.<anonymous> (src/auth.test.ts:42:5)",
  toolCallsSummary: [
    "Read src/auth.ts",
    "Write src/middleware/protect.ts (new file)",
    "Bash: npm test -- --testPathPattern=auth (exit 1)",
    "Edit src/auth.ts (fixed token validation)",
    "Bash: npm test -- --testPathPattern=auth (exit 1)",
  ],
  errorCode: "agent_error",
  branchName: "ai/PROJ-123",
  mrUrl: undefined,  // MR not created — agent failed before that step
};
```

The fix-specific prompts then reference this structured data:

- **CI fix prompt:** `"You previously worked on this task. Context: [SessionContext]. The CI pipeline on branch [branchName] failed. Fetch the pipeline logs via VCS MCP and fix the issues. Push to the same branch."`
- **Review fix prompt:** `"You previously worked on this task. Context: [SessionContext]. The reviewer requested changes on MR [mrUrl]. Fetch the discussion threads via VCS MCP and address the feedback. Push to the same branch."`

The agent fetches the actual logs/comments via MCP — the orchestrator doesn't parse or preprocess them. The structured `SessionContext` gives the agent precise continuity (exact files, exact test failures, exact tool sequence) without needing the full conversation history.
