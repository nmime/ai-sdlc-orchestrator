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
  artifacts?: PublishedArtifact[];     // Artifacts produced by the agent (read from /workspace/.artifacts/)
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

interface PublishedArtifact {
  kind: string;                        // Free-form: "merge_request", "figma_update", etc.
  title: string;
  uri: string;
  status: 'draft' | 'published';
  mime_type?: string;
  metadata?: Record<string, unknown>;
  content?: string;
  preview_url?: string;
}
```

**Why no `resumeSession`:** Agent sessions (regardless of provider) are stateless between invocations. "Resuming" would require persisting and replaying the full conversation history (potentially hundreds of tool calls over 60 min), which is impractical and wasteful. Instead, the previous session's `SessionContext` + the existing branch state on VCS gives the agent everything it needs to continue effectively. Critically, `SessionContext` provides **server-side ground truth** — the orchestrator constructs it from actual `AGENT_TOOL_CALL` records, test outputs, and `AgentResult` data rather than relying on the agent's self-reported summary. This means fix-loop context is based on observed behavior (which files were actually modified, which tests actually failed) rather than the agent's potentially inaccurate or hallucinated recollection.

**`cancel()` implementation:** Uses the same two-tier graceful shutdown: writes `/workspace/.shutdown-requested` sentinel file via `SandboxPort.writeFile()`, sends `SIGTERM` after 3 minutes if agent hasn't exited, then destroys the sandbox via `SandboxPort.destroy()` at timeout. Backend-agnostic — works identically with E2B and Agent Sandbox + Kata. The Activity returns a partial `AgentResult` with `status: 'failure'` and `errorCode: 'cancelled'`.

### Agent Provider Resolution

The orchestrator resolves which AI agent provider to use via a three-level fallback chain:

1. **Repo config** `agent_provider` — most specific, per-repository override
2. **Tenant config** `default_agent_provider` — tenant-wide default
3. **System default** — `'claude'`

#### Model Resolution Chain

The system resolves which AI model to use for a task via the following chain (first match wins):

1. **Task label → `model_routing`**: `TENANT_REPO_CONFIG.model_routing` (JSONB) maps task labels to specific models
   - Example: `{"trivial": "claude-haiku-4-5", "standard": "claude-sonnet-4-6", "complex": "claude-opus-4-6"}`
   - Label is determined from issue labels, estimated complexity, or explicit user annotation
2. **Repo-level model**: `TENANT_REPO_CONFIG.agent_model`
3. **Tenant default**: `TENANT.default_agent_model`
4. **System default**: configured in Helm values (default: `claude-sonnet-4-6`)

```typescript
const DEFAULT_MODELS: Record<AgentProvider, string> = {
  claude: 'claude-sonnet-4-6',
  openhands: 'claude-sonnet-4-6',   // OpenHands uses LLM provider underneath
  aider: 'claude-sonnet-4-6',       // Aider uses LLM provider underneath
};

function resolveProvider(repoConfig, tenantConfig): { provider: AgentProvider; model: string } {
  const provider = repoConfig.agent_provider ?? tenantConfig.default_agent_provider ?? 'claude';
  return { provider, model: resolveModel(repoConfig, tenantConfig, provider) };
}

function resolveModel(repoConfig, tenantConfig, provider: AgentProvider, taskLabel?: string): string {
  // 1. Task label → model_routing
  if (taskLabel && repoConfig.model_routing?.[taskLabel]) {
    return repoConfig.model_routing[taskLabel];
  }
  // 2. Repo-level model
  if (repoConfig.agent_model) return repoConfig.agent_model;
  // 3. Tenant default
  if (tenantConfig.default_agent_model) return tenantConfig.default_agent_model;
  // 4. System default
  return DEFAULT_MODELS[provider];
}
```

This allows tenants to route different task complexities to different models (e.g., Haiku for trivial fixes, Opus for complex features), experiment with different providers per-repo while keeping a stable default, and allows the system operator to set a global default.

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

**Primary Defense: Structured Isolation**

All untrusted input (issue descriptions, PR comments, user-provided context) is isolated from trusted instructions using delimiter-based separation:

```xml
<system>
You are an AI coding agent. Follow these instructions exactly.
{trusted_system_prompt}
</system>

<task>
<trusted_context>
Repository: {repo_name}
Branch: ai/{task_id}
Files to modify: {file_list}
</trusted_context>

<user_input>
<!-- BEGIN UNTRUSTED: Content below is from external issue/PR description -->
{sanitized_user_input}
<!-- END UNTRUSTED -->
</user_input>
</task>
```

**Input Validation** (pre-prompt):
- Reject binary content / non-UTF-8 input
- Enforce maximum input length (configurable, default: 50,000 characters)
- Strip null bytes and control characters (except newlines/tabs)

**Output Scanning** (secondary defense layer):
- Scan agent output for credential patterns (API keys, tokens) before committing
- Detect and block attempts to modify files outside the task scope
- Log anomalous tool call patterns for security review

> **Note**: Output scanning is a defense-in-depth layer, not the primary defense. The structured isolation above ensures untrusted input cannot override system instructions even if scanning misses a pattern.

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

**Built-in (always available):** `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `publish_artifact` — covers code work, tests, git operations, and artifact publishing.

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
│     - Env: SESSION_TOKEN,                                            │
│       AI_API_BASE_URL=$CREDENTIAL_PROXY_URL/ai-api/{provider},      │
│       CREDENTIAL_PROXY_URL, TRACEPARENT                             │
│     - Timeout: startToCloseTimeout + 5-min buffer                   │
│     - No secrets mounted, no API keys, no VCS/MCP credential access  │
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

> **Note**: AI provider API keys are never injected into sandboxes. The credential proxy's AI API proxy endpoint injects the `x-api-key` header server-side. See [Sandbox & Security — AI API Proxy](sandbox-and-security.md#ai-api-proxy).

For **fix loops** (CI fix / review fix), the `invokeAgent` Activity re-clones the repo, checks out the existing branch, and starts a **new agent session** with:
- `previousSessionContext` — structured data about the previous session: files modified, test output, tool calls summary, branch, MR URL
- A fix-specific prompt — "CI pipeline failed, fix the issues" or "reviewer requested changes, address feedback"
- The agent then: fetches CI logs or review comments via MCP → fixes → pushes to the same branch

#### Sandbox Reuse for Fix Iterations

Between `ci_fix` → `ci_watch` → `ci_fix` transitions, the orchestrator can reuse the existing sandbox to avoid repeated clone and setup costs:

1. After `ci_fix` pushes code, call `SandboxPort.pause(handle)` instead of `destroy`
2. During `ci_watch`, the sandbox is paused (zero compute cost on E2B Cloud)
3. If CI fails within 15 minutes: call `SandboxPort.resume(handle)`, agent continues with full workspace state
4. If CI takes >15 minutes or CI succeeds: call `SandboxPort.destroy(handle)`
5. If `resume` fails (sandbox evicted/expired): create fresh sandbox (fallback to current behavior)

**Decision logic** (in Workflow code, not Activity):
```typescript
if (ciResult === 'failed' && ciDuration < MAX_REUSE_WINDOW) {
  handle = await sandboxPort.resume(pausedHandle);
} else {
  await sandboxPort.destroy(pausedHandle);
  handle = await sandboxPort.create(config);
}
```

**Cost impact**: Eliminates ~2–5 minutes of sandbox setup per fix iteration. For a 3-iteration fix loop, saves ~6–15 minutes of sandbox compute time.

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

#### MCP Protocol Version Compatibility

Each MCP server in the registry tracks its supported protocol version:

- `MCP_SERVER_REGISTRY.protocol_version` — e.g., `'2025-03-26'`
- At sandbox startup, the entrypoint script validates MCP server protocol version compatibility
- **On version mismatch**: log warning, attempt connection (many MCP servers maintain backward compatibility)
- **On hard connection failure**: MCP server marked as unavailable for this session; agent adapts by using remaining tools
- Version compatibility matrix maintained in `MCP_SERVER_REGISTRY` to prevent known-incompatible combinations

See [Data Model — MCP_SERVER_REGISTRY](data-model.md) for the `protocol_version` field definition.

### MCP Token Injection

MCP servers that require authentication receive tokens via the credential proxy, fetched just-in-time during sandbox startup:

- The sandbox init script (runs before agent session starts) calls `curl -H "Authorization: Bearer $SESSION_TOKEN" $CREDENTIAL_PROXY_URL/mcp-token/{server-name}` for each authenticated MCP server
- Retrieved tokens are set as environment variables for the corresponding MCP server processes only
- The agent process itself does not receive MCP tokens as environment variables — they are passed directly to MCP server child processes

**Trust boundary note:** MCP tokens, like VCS PATs obtained via `GIT_ASKPASS`, transit through processes running inside the sandbox. The "zero-credential sandbox" guarantee means **no credentials are present at sandbox creation time** — they are fetched on-demand from the credential proxy during operation. Inside an active sandbox, an agent with Bash access could theoretically read MCP server process environment via `/proc/<pid>/environ`. This is the same trust boundary as every agent-in-sandbox architecture.

**Mitigations:**
- MCP tokens are session-scoped and short-lived (TTL matches sandbox timeout)
- Credential proxy logs all token requests for anomaly detection
- Rate limiting prevents bulk token exfiltration
- MCP servers with `scoping_capability: 'full'` issue tokens scoped to the specific repo/project, limiting blast radius

### Activity ↔ Sandbox Communication Protocol

All communication uses `SandboxPort` — backend-agnostic:

- **Prompt injection:** The agent prompt + MCP config is written to `/etc/agent/invocation.json` via `SandboxPort.writeFile()` at creation time. The sandbox's entrypoint reads this file to configure the agent session
- **Result extraction:** The agent writes `AgentResult` JSON to `/workspace/.agent-result.json` on completion. The Activity reads this file via `SandboxPort.readFile()` after sandbox completion. If the file is missing (crash/OOM), the Activity constructs a failure `AgentResult` from the sandbox exit status and collected logs
- **Graceful shutdown (two-tier):**
  1. **Sentinel file** (T-5min): Activity writes `/workspace/.shutdown-requested` via `SandboxPort.writeFile()`. The agent's system prompt instructs: *"Between tool calls, check if `/workspace/.shutdown-requested` exists. If present, commit and push partial work immediately, then exit."*
  2. **Process signal** (T-2min): If the agent hasn't exited 3 minutes after the sentinel was written, the Activity sends `SIGTERM` to the agent process via `SandboxPort.exec('kill -TERM <agent_pid>')`. Agent PID is obtained from the initial `SandboxPort.exec()` return value. Agent runtimes (Claude SDK, OpenHands, Aider) handle `SIGTERM` by flushing state and exiting
  3. **Force kill** (T-0): If still running, `SandboxPort.destroy()` terminates the sandbox. Any partial work not pushed is lost
  - **Grace period**: default 5 minutes total (sentinel at T-5min, SIGTERM at T-2min, destroy at T-0). Configurable via `graceful_shutdown_minutes` in DSL
  - **Long-running commands**: If the agent is in a long Bash command (e.g., a 10-minute build), the sentinel file won't be checked until that command completes. The SIGTERM at T-2min ensures the agent is interrupted even during long operations. Agents should prefer streaming build output over blocking commands to enable faster shutdown response

### Artifact Publishing (`publish_artifact` Tool)

Agents can produce any type of deliverable by calling the `publish_artifact` built-in tool. This follows the MCP "tool-mediated artifact" pattern — the agent calls a tool that writes a typed reference; the orchestrator tracks references without understanding artifact internals.

```typescript
// Built-in tool available in every sandbox alongside Read, Write, Edit, Bash, Glob, Grep
interface PublishArtifactInput {
  kind: string;                          // Free-form: "merge_request", "figma_update", "design_token",
                                         // "test_report", "image", "config", "documentation", ...
  title: string;                         // Human-readable: "MR: Add login form", "Figma: Dashboard redesign"
  uri?: string;                          // External location: MR URL, Figma link, CDN URL
                                         // Either `uri` or `local_path` must be provided
  local_path?: string;                   // Sandbox-local file: "/workspace/coverage/report.html"
                                         // Activity uploads to MinIO → becomes `uri` after upload
  status?: 'draft' | 'published';        // Default: 'published'
  mime_type?: string;                    // "text/x-diff", "image/png", "application/json", ...
  metadata?: Record<string, unknown>;    // Arbitrary structured data (diff stats, coverage %, Figma node IDs)
  content?: string;                      // Optional inline content for small artifacts (JSON configs, summaries)
  preview_url?: string;                  // URL for human review (Figma preview, deployed Storybook, image viewer)
}

interface PublishArtifactOutput {
  artifact_id: string;                   // UUID assigned by orchestrator
  status: 'accepted';
}
```

**Implementation:**

The `publish_artifact` tool is a **shell script** (`/usr/local/bin/publish-artifact`) baked into the agent sandbox template (`Dockerfile.agent`). It is registered with each agent provider differently:

| Provider | Registration Mechanism |
|---|---|
| **Claude** (`claude-agent-sdk`) | Listed in `allowedTools` configuration. The SDK discovers it as a Bash-callable tool. System prompt instructs: *"To publish artifacts, run: `publish-artifact --kind <kind> --title <title> [--uri <uri>] [--local-path <path>] [--preview-url <url>] [--metadata '<json>']`"* |
| **OpenHands** | Registered as a custom tool in the OpenHands tool configuration. OpenHands' tool execution engine calls the script |
| **Aider** | Included in Aider's shell command allowlist. Aider calls it via `/run publish-artifact ...` |

**Script behavior:**
1. Generates a UUID for the artifact
2. Validates input (requires `kind`, `title`, and at least one of `uri` or `local_path`)
3. If `local_path` is specified, copies the file to `/workspace/.artifacts/files/<uuid>/<filename>`
4. Writes artifact metadata JSON to `/workspace/.artifacts/<uuid>.json`
5. Returns `{"artifact_id": "<uuid>", "status": "accepted"}` to stdout
6. Exit code 0 on success, 1 on validation error

**Mechanics:**
1. Agent calls `publish_artifact` tool during its session
2. The tool writes artifact metadata to `/workspace/.artifacts/<uuid>.json`
3. If the artifact has a `local_path` (file inside the sandbox), the tool copies the file to `/workspace/.artifacts/files/<uuid>/<filename>`
4. At session end, the `invokeAgent` Activity reads all files in `/workspace/.artifacts/` via `SandboxPort.readFile()`
5. For artifacts with local files: the Activity uploads them to MinIO (S3-compatible) via `SandboxPort.uploadArtifact()` and replaces `local_path` with a presigned URL as the artifact's `uri`
   - **Upload idempotency**: Each artifact file is uploaded to a path that includes the artifact UUID (`{tenant-slug}/artifacts/{workflow-id}/{artifact-id}/{filename}`). If the Activity retries after a crash, it checks for an existing object at the target path (S3 `HeadObject`) before re-uploading. Duplicate uploads are skipped, and the existing URL is used. This prevents orphaned duplicate files in object storage
6. Artifacts are persisted to `WORKFLOW_ARTIFACT` table (see [Data Model](data-model.md))
7. If a gate has `require_artifacts`, the Workflow validates required kinds exist with `status: published`

**Why object storage is needed:** Sandbox-local files (generated images, test reports, coverage HTML, design exports, build artifacts) are destroyed when the sandbox is cleaned up. Artifacts that point to external URLs (MR links, Figma URLs) don't need upload — only files created inside the sandbox do.

**`kind` is a free string, not an enum** — new artifact types require no schema changes, no DSL updates, and no orchestrator code changes. The agent (or the LLM powering it) decides what it produced. Common kinds:

| `kind` | Source | Typical `uri` / `local_path` | Typical `preview_url` | Use case |
|---|---|---|---|---|
| `merge_request` | External URL | `uri`: PR/MR URL | Same as `uri` | Standard code output |
| `figma_update` | External URL | `uri`: Figma file URL with node ID | Figma prototype link | Design changes |
| `design_token` | Git commit | `uri`: file path in repo (`tokens/colors.json`) | Storybook deploy URL | Design system tokens |
| `test_report` | Sandbox upload | `local_path`: `/workspace/coverage/index.html` | Auto-generated from uploaded URL | Test/coverage HTML |
| `image` | Sandbox upload | `local_path`: `/workspace/output/diagram.png` | Auto-generated from uploaded URL | Generated images/diagrams |
| `documentation` | Git commit | `uri`: file path in repo (`docs/api.md`) | Deployed docs URL | Generated docs |
| `config` | Git commit | `uri`: file path in repo (`.env.example`) | — | Configuration files |
| `build_artifact` | Sandbox upload | `local_path`: `/workspace/dist/bundle.js` | — | Build outputs |

**Artifact size limits and upload behavior:**

| Setting | Default | Configurable |
|---|---|---|
| Max artifact file size | 100 MB | Per tenant via admin API |
| Multipart upload threshold | 10 MB | System config |
| Per-tenant artifact storage quota | 10 GB / month | Per tenant |
| Upload timeout | 5 minutes | System config |

- Files > 10 MB use **multipart upload** (S3 multipart API via `@aws-sdk/lib-storage` `Upload` class) for reliability and streaming
- Files > 100 MB are **rejected** — the `publish_artifact` script validates file size before writing metadata. The agent receives an error message instructing it to reduce output size or split into multiple artifacts
- **Streaming upload**: `SandboxPort.uploadArtifact()` streams files from the sandbox to MinIO without buffering the entire file in worker memory. E2B backend: reads file in chunks via E2B SDK's `readFileChunked()`. Agent Sandbox backend: streams via Sandbox Router HTTP API with `Transfer-Encoding: chunked`
- **Quota enforcement**: before upload, the Activity checks `SUM(size) FROM workflow_artifact WHERE tenant_id = :tenantId AND created_at > date_trunc('month', now())` against the tenant's quota. Exceeding quota fails the upload with a clear error (not the agent session)

**Auto-supersede**: When the agent publishes an artifact with the same `kind` as an existing `published` artifact in the same workflow, the previous one is automatically marked `superseded`. This handles re-creation after force-pushes or iterative updates.

**Concurrent publishing safety**: Each `publish_artifact` call generates a unique UUID for the artifact file path (`/workspace/.artifacts/<uuid>.json`), so concurrent calls from parallel tool executions cannot collide on filenames. For **same-kind artifacts within a single session**: all are collected by the Activity at session end, and auto-supersede runs in creation timestamp order (from the `created_at` field in the artifact JSON). The last-published artifact of a given `kind` retains `published` status; earlier ones are marked `superseded`.

**Default behavior for code tasks**: The default DSL's `implement` step instructs the agent to publish a `merge_request` artifact after creating the MR. The agent's system prompt includes: *"After creating an MR, call `publish_artifact` with `kind: 'merge_request'`, the MR URL as `uri`, and diff stats in `metadata`."*

**Design tasks**: The same `implement` step works — the agent reads the task description, determines it's a design task, and publishes appropriate artifact kinds (`figma_update`, `design_token`, `image`). The DSL doesn't need to know the task type; the agent adapts.

### Activity Heartbeating

Long-running agent sessions (up to 60 min) require Temporal Activity heartbeating to detect dead workers promptly:

- The `invokeAgent` Activity monitors the sandbox and heartbeats every **30 seconds** with sandbox status (`running` / `completed` / `failed`) and elapsed time
- **Agent-internal phase** (`implementing`, `testing`, etc.) is **not observable from the Activity** — the agent process does not expose its internal phase via an API. Phase-level observability is available via agent logs (the AI agent runtime logs tool calls to stdout as structured JSON, collected by the Activity). The heartbeat carries: sandbox status, elapsed time, last known agent output line
- Temporal's `heartbeatTimeout` is set to **90 seconds** — if a worker dies, Temporal reschedules the Activity within 90s instead of waiting for the full 60-minute `startToCloseTimeout`
- On rescheduling, the Activity receives the last heartbeat details. It checks if the sandbox is still running: E2B backend checks via E2B SDK, Agent Sandbox backend checks via K8s pod status. If running, it reattaches via sandbox ID / SandboxClaim name and continues monitoring. If not, it starts a fresh agent session
- **Graceful shutdown at T-5min:** Activity tracks elapsed time. At T-5min before `startToCloseTimeout`, it writes a sentinel file `/workspace/.shutdown-requested` via `SandboxPort.writeFile()`. The agent's system prompt instructs: "Between tool calls, check if `/workspace/.shutdown-requested` exists. If present, commit and push partial work immediately, then exit." The Activity sends SIGTERM at T-2min if agent hasn't exited, then destroys sandbox at T-0

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
