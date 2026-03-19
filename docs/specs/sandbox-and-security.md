# Sandbox & Security

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Technology Choice: E2B Sandboxes

Each agent session runs in a **dedicated [E2B](https://e2b.dev) sandbox** — a Firecracker microVM with its own kernel, filesystem, and network stack. E2B is available in two deployment modes: **E2B Cloud** (managed SaaS) and **self-hosted E2B** (deployed on your own infrastructure). Both modes use the same SDK, same API, same Firecracker isolation — the only difference is where the VMs run.

The orchestrator always runs in K8s. Sandboxes always run in E2B. The two are cleanly separated.

### Comparison Table

| Technology | Isolation | Startup | Infrastructure | AI-agent focus |
|---|---|---|---|---|
| **E2B** | **Full VM (Firecracker)** | **~150ms** | **Cloud SaaS or self-hosted** | **Purpose-built for AI agents** |
| Kata Containers | Full VM (KVM) | 150-300ms | Self-managed K8s RuntimeClass | General-purpose |
| gVisor (runsc) | User-space kernel | ~50-100ms | Self-managed K8s RuntimeClass | General-purpose |
| Docker/OCI | Shared kernel | 10-50ms | Self-managed | General-purpose |

### Why E2B

1. **Firecracker microVM isolation** — each sandbox is a separate Firecracker VM (the same technology powering AWS Lambda and Fargate). Separate kernel, separate memory space, hardware-level isolation. ~50k LoC purpose-built VMM with minimal attack surface
2. **Cloud or self-hosted** — E2B Cloud for zero-ops, self-hosted E2B for full data sovereignty. Same SDK, same API, same isolation in both modes. The orchestrator's `E2B_BASE_URL` config switches between them
3. **Purpose-built for AI agents** — E2B was designed specifically for running AI agent code. SDK provides filesystem access, process execution, and sandbox lifecycle management out of the box
4. **Custom templates from Dockerfiles** — agent sandbox template is built from `Dockerfile.agent`. E2B builds and caches the template. Standard CI/CD — no custom template registries
5. **Consistent across environments** — same E2B sandboxes in development, CI, staging, and production. No "Docker fallback mode" needed for local dev. Eliminates environment parity issues
6. **Fast startup** — Firecracker VMs boot in ~150ms. E2B pre-warms VMs from templates for near-instant sandbox creation
7. **Ephemeral by design** — sandboxes are destroyed after use. No persistent state between sessions. E2B handles cleanup automatically
8. **Timeout management** — built-in sandbox timeout. E2B automatically terminates sandboxes that exceed the configured lifetime

**Industry context:** Devin, Google Jules, and Cursor Background Agents all use full VMs per session. E2B provides the same Firecracker-level isolation as AWS Lambda.

### Deployment Modes

| | E2B Cloud | Self-Hosted E2B |
|---|---|---|
| **Where sandboxes run** | E2B's infrastructure | Your own servers (bare-metal or VMs with KVM support) |
| **Setup** | API key only | Deploy E2B orchestrator on your infrastructure ([open-source, Apache-2.0](https://github.com/e2b-dev/infra)) |
| **SDK / API** | Same | Same — `E2B_BASE_URL` points to your instance |
| **Isolation** | Firecracker microVM | Firecracker microVM (identical) |
| **Data sovereignty** | Code executes on E2B infra | Code executes on your infra — full control |
| **Credential proxy networking** | Proxy needs public HTTPS endpoint (Ingress) — E2B Cloud sandboxes reach it over the internet | Proxy can use private networking (K8s ClusterIP / internal LB) if E2B nodes share the same network |
| **Network control** | E2B manages sandbox networking. Outbound internet by default — no fine-grained egress filtering | Full control over sandbox network. Can place E2B nodes behind firewall rules, restrict egress at the infrastructure level |
| **Operational overhead** | None (managed) | You manage E2B infra (nodes, updates, capacity) |
| **Cost model** | Per sandbox-hour (see [E2B pricing](https://e2b.dev/pricing)) | Infrastructure cost only |
| **Best for** | SaaS deployment, rapid start, low ops | Enterprise / self-hosted deployment, data sovereignty, regulated environments |

**Configuration:** The orchestrator switches modes via a single config:

```yaml
e2b:
  api_key: k8s://secret/e2b-api-key
  base_url: https://api.e2b.dev          # E2B Cloud (default)
  # base_url: https://e2b.internal.corp  # Self-hosted E2B
  default_template_id: agent-sandbox-v3
  sandbox_timeout_seconds: 3900          # startToCloseTimeout + 5min buffer
```

---

## Sandbox Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Worker Pod (orchestrator-worker, in K8s)                            │
│                                                                      │
│  invokeAgent Activity:                                               │
│    1. Generate session token (JWT, short-lived, tenant-scoped)      │
│    2. Create E2B sandbox via SDK:                                    │
│       - Template: agent-sandbox (built from Dockerfile.agent)        │
│       - Env vars: ANTHROPIC_API_KEY, SESSION_TOKEN,                 │
│         CREDENTIAL_PROXY_URL, TRACEPARENT                           │
│       - Timeout: startToCloseTimeout + 5-min buffer                 │
│       - Metadata: workflowId, tenantId, sessionId                   │
│    3. Inside sandbox: clone repo, install deps, run agent            │
│    4. Monitor sandbox, heartbeat to Temporal                         │
│    5. Collect AgentResult from sandbox filesystem                    │
│    6. Destroy sandbox (E2B SDK)                                      │
│    7. Revoke session token                                           │
└──────────────────────────────────────────────────────────────────────┘
         │ E2B SDK (HTTPS)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  E2B Sandbox (dedicated Firecracker microVM per session)             │
│                                                                      │
│  Isolation: Firecracker VM boundary — separate kernel, memory,       │
│             filesystem. Same isolation as AWS Lambda.                 │
│                                                                      │
│  /workspace → writable dir                                           │
│  NO secrets mounted (except Anthropic API key)                       │
│  GIT_ASKPASS → calls credential proxy                                │
│    at $CREDENTIAL_PROXY_URL with $SESSION_TOKEN                      │
│                                                                      │
│  Toolchain:                                                          │
│    Git, Node.js, Python, Go                                          │
│    claude-agent-sdk                                                  │
│    MCP server binaries                                               │
│                                                                      │
│  Network:                                                            │
│    Outbound internet access (needed for Claude API, platform APIs,   │
│    MCP endpoints, credential proxy)                                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Credential Proxy Service (K8s Deployment, in our cluster)           │
│                                                                      │
│  HTTPS endpoint exposed via Ingress                                  │
│  Authenticates requests via session token (Bearer header)            │
│  Session tokens: short-lived JWT, scoped to tenant + session         │
│                                                                      │
│  Endpoints:                                                          │
│    POST /git-credential — returns VCS PAT for git operations         │
│    GET  /mcp-token/{server-name} — returns MCP server token          │
│                                                                      │
│  K8s Secrets mounted:                                                │
│    - VCS PATs (per tenant)                                           │
│    - MCP tokens (per tenant)                                         │
│    - Session token signing key                                       │
│                                                                      │
│  Security:                                                           │
│    - TLS termination at Ingress                                      │
│    - Session token validation (JWT, short TTL, tenant-scoped)        │
│    - Rate limiting per session token                                 │
│    - Audit logging (every request logged)                            │
│    - Read-only filesystem                                            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Security Layers (Defense-in-Depth)

| Layer | Control | What It Prevents |
|---|---|---|
| **1. Firecracker VM boundary** | Each sandbox is a separate Firecracker microVM with its own kernel. Same isolation technology as AWS Lambda (~50k LoC VMM) | Kernel exploits, sandbox breakout — requires hypervisor exploit to escape. Minimal attack surface compared to QEMU (~1.4M LoC) |
| **2. Credential proxy service** | Credentials stored in K8s cluster, served via authenticated HTTPS endpoint. Sandbox has no direct access to credential store | Credential theft — sandbox cannot access K8s Secrets. Must authenticate via session token to obtain credentials. Stronger isolation than sidecar model (separate host entirely) |
| **3. Session token scoping** | Each sandbox gets a unique JWT session token: short TTL, scoped to tenant + session ID. Token is the only credential the sandbox holds (besides Anthropic API key) | Cross-session credential reuse, cross-tenant access. Token expires with sandbox |
| **4. E2B sandbox limits** | Configurable timeout and resource limits per sandbox (CPU, memory, disk) | Resource exhaustion, runaway processes |
| **5. Agent SDK limits** | `maxTurns`, `costLimitUsd` | Runaway sessions, cost overruns |
| **6. Ephemeral sandboxes** | Sandbox destroyed after session — no persistent state between sessions. E2B handles cleanup | Cross-session data leakage |

**Isolation boundary clarification:** Firecracker provides hardware-level VM isolation between the sandbox and the host. The agent runs alone in the sandbox — no sidecar containers, no shared processes. This is a simpler security model than the multi-container pod approach: one process boundary (VM), one trust boundary (sandbox ↔ outside world).

**Network model:**
- **E2B Cloud** — sandboxes have outbound internet access. No fine-grained L3/L4 egress control.
- **Self-hosted E2B** — full network control. Sandboxes can be placed behind firewall rules restricting egress to only the required endpoints (Claude API, platform APIs, MCP endpoints, credential proxy). This is the equivalent of K8s NetworkPolicy but at the infrastructure level.

Mitigations (both modes):
- **Credential proxy is the only source of secrets** — even with unrestricted egress, the agent has no credentials to exfiltrate (except the Anthropic API key and the session token)
- **Session token is short-lived** — expires when the sandbox is destroyed, scoped to one session
- **Agent prompt hardening** — system prompt instructs the agent to never access unauthorized endpoints
- **Credential proxy audit logging** — all credential requests logged for post-incident analysis

### Sandbox Security Hardening

E2B sandboxes enforce the following security posture:

| Setting | Value |
|---|---|
| Isolation | Firecracker microVM (hardware-level) |
| Root access | Non-root user (configurable in template) |
| Timeout | `startToCloseTimeout` + 5-min buffer |
| Credential access | Session token only (no raw VCS/MCP credentials) |
| Anthropic API key | Environment variable (agent needs it for Claude API) |
| Persistent storage | None — ephemeral filesystem destroyed on sandbox termination |

**Ingress policy:** E2B sandboxes have no exposed ports — no inbound connections are possible except via the E2B SDK. The sandbox can only be controlled by the `invokeAgent` Activity that created it.

---

## Credential Proxy

The credential proxy runs as a **standalone K8s service** (Deployment + Service), serving credentials to E2B sandboxes over HTTPS:

### Architecture

- **E2B sandbox:** No secrets mounted (except Anthropic API key). `GIT_ASKPASS` environment variable points to a script that calls the credential proxy at `$CREDENTIAL_PROXY_URL` with the session token
- **Credential proxy service:** K8s Deployment + Service. K8s Secrets mounted (VCS PATs, MCP tokens, signing key). Authenticates requests via JWT session token. Implements git credential protocol and MCP token endpoints
- **Communication:** HTTPS from E2B sandbox to credential proxy. Session token in `Authorization: Bearer` header
- **Session tokens:** Generated by the `invokeAgent` Activity before sandbox creation. JWT with claims: `tenantId`, `sessionId`, `exp` (sandbox timeout + buffer). Signed with an HMAC key stored in K8s Secrets. Validated by the proxy on every request

### Networking by Deployment Mode

| Mode | Credential proxy exposure | TLS | Sandbox → Proxy path |
|---|---|---|---|
| **E2B Cloud** | Public HTTPS endpoint via K8s Ingress (e.g., `https://credential-proxy.example.com`) | TLS termination at Ingress | Internet: sandbox in E2B Cloud → public Ingress → proxy pod |
| **Self-hosted E2B** (same network) | K8s ClusterIP or internal LoadBalancer — no public exposure needed | mTLS or TLS within private network | Private: sandbox on E2B node → internal LB / ClusterIP → proxy pod |
| **Self-hosted E2B** (separate network) | Internal HTTPS endpoint via VPN / private peering | TLS over private link | VPN/peering: sandbox on E2B node → private link → proxy pod |

Self-hosted E2B on the same network as the K8s cluster is the most secure option: the credential proxy is never exposed to the internet, and sandbox-to-proxy communication stays on the private network.

> **Anthropic API key:** The Anthropic API key is passed as an environment variable to the E2B sandbox. Unlike VCS PATs and MCP tokens, the API key is intentionally accessible to the agent process — the agent needs it to call the Claude API directly. This is the one credential the sandbox holds.

### GIT_ASKPASS Flow

```
Agent: git push origin ai/PROJ-123
  → git asks GIT_ASKPASS for credentials
  → GIT_ASKPASS script: curl -H "Authorization: Bearer $SESSION_TOKEN"
      $CREDENTIAL_PROXY_URL/git-credential
  → credential proxy: validates JWT session token, extracts tenantId
  → reads PAT from mounted K8s Secret for that tenant
  → returns PAT to git process
  → git authenticates with VCS
  → Agent never sees the PAT
```

### MCP Token Injection

MCP servers that require authentication tokens receive their tokens through the same credential proxy service:

- The proxy mounts all tenant MCP tokens from K8s Secrets
- MCP server configurations reference `$CREDENTIAL_PROXY_URL/mcp-token/{server-name}` for token injection
- The agent process never has access to MCP tokens directly
- All token requests authenticated via session token

### Threat Model & Limitations

The credential proxy pattern provides strong **accidental exposure prevention**:
- No credentials in environment variables (except Anthropic API key) — agent cannot read `/proc/self/environ` to obtain VCS/MCP secrets
- No credentials on filesystem — sandbox has no mounted secrets
- Session token is the only bearer credential, and it only grants access to the proxy endpoints (not raw credential storage)

**What the proxy does NOT prevent:** A deliberately malicious or prompt-injected agent could call the credential proxy to obtain the PAT (the proxy serves it to authenticated requests — that's its job), then exfiltrate it via any outbound endpoint. This is the same trust boundary as every agent-in-sandbox architecture (Devin, Jules, Cursor Background Agents) — you must trust that the agent will not actively exfiltrate credentials via allowed channels.

**Advantage over sidecar model:** The proxy runs on a **completely separate host** from the agent (K8s cluster vs. E2B sandbox VM). Even a full VM escape from the E2B sandbox would not grant access to the credential store — credentials live on the K8s cluster, not in the sandbox's VM or host. With the sidecar model, a guest-kernel namespace escape within the same pod would expose sidecar secrets.

**Recommended mitigations:**
- **Credential proxy audit logging** — log every request (timestamp, session token claims, endpoint, response status, source IP) for post-incident analysis
- **Rate limiting per session token** — limit credential requests to expected usage patterns (e.g., max 10 git-credential requests per session)
- **Agent prompt hardening** — system prompt explicitly instructs the agent to never log, print, or transmit credentials
- **Session token revocation** — tokens are revoked immediately when the sandbox is destroyed. The proxy rejects requests with expired/revoked tokens
- **Egress content inspection** (future) — L7 proxy on the credential proxy to detect credential patterns in outbound traffic

> **Note:** The PAT transits through the agent's git process memory space during `GIT_ASKPASS` flow. The proxy prevents *storage* and *casual access* to credentials, not *transit through the git process*.

---

## E2B Template Versioning

The agent sandbox template (built from `Dockerfile.agent`) is managed through E2B's template system:

1. **Immutable template versions** — each build produces a versioned E2B template. Old versions are never overwritten — new sandboxes reference a specific template ID
2. **Standard Dockerfile** — the template is built from `Dockerfile.agent` using `e2b template build`. Same Dockerfile, different build target (E2B instead of container registry)
3. **Per-tenant template override** — `TENANT_REPO_CONFIG.agent_template_id` can specify a custom E2B template ID. Default: latest stable template. Enables canary rollout — update one tenant's template, validate, then promote to all tenants
4. **Rollback** — if a new template breaks agent sessions, revert `TENANT_REPO_CONFIG.agent_template_id` to the previous template ID. Old templates remain available in E2B
5. **In-flight safety** — running sandboxes use the template they were created with. Template updates only affect new sandboxes. No disruption to in-progress sessions
6. **Template CI pipeline** — `Dockerfile.agent` changes trigger: build E2B template (`e2b template build`) → deploy to staging tenant → run smoke test (agent clones a test repo, runs `npm ci`, `tsc`, `jest`) → promote to production tenants
7. **Template supply chain security** — Base images pinned by digest (`FROM node:22@sha256:...`), not tag, to prevent supply chain attacks via base image mutation. Vulnerability scanning with Trivy in CI pipeline — templates with critical CVEs are blocked from promotion

---

## Sandbox Lifecycle & Cleanup

- **E2B timeout** — set to `startToCloseTimeout` + 5-minute buffer. E2B automatically terminates sandboxes that exceed this timeout, preventing indefinite hangs from zombie agent processes
- **Orphaned sandbox cleanup** — if the Activity crashes before destroying the sandbox, E2B's built-in timeout terminates it automatically. Additionally, a reconciliation CronJob (every 15 min) queries active E2B sandboxes (via SDK) with metadata `orchestrator.ai/managed=true` and terminates any that don't have a corresponding active Temporal Activity
- **Heartbeat-based reattachment** — the Activity stores the E2B sandbox ID in Temporal heartbeat details. On Activity retry (worker crash/reschedule), the new Activity instance reads the last heartbeat, checks if the sandbox is still running (via E2B SDK), and reattaches instead of creating a new sandbox

---

## Secrets Rotation

Credentials are stored in K8s Secrets and served by the credential proxy:

1. Update K8s Secret (via external secrets operator, Vault sync, or manual rotation)
2. Credential proxy reads secrets from mounted volumes — picks up changes automatically (K8s Secret volume mounts auto-update)
3. In-flight sandboxes are unaffected — they obtain credentials per-request from the proxy, so they automatically get the new credential on next git/MCP operation
4. For emergency rotation (compromised credential): update K8s Secret → credential proxy serves new credential immediately → in-flight sandboxes get new credential on next proxy call. No need to restart sandboxes

**Advantage over pod-mounted secrets:** With the sidecar model, secrets were mounted at pod creation time and immutable for the pod's lifetime. With the credential proxy service, secret rotation is immediate — no need to restart sandboxes or wait for session completion.

---

## Tenant Isolation

| Layer | Mechanism |
|---|---|
| **Hardware-level isolation** | Each agent session runs in a dedicated E2B Firecracker microVM. Separate kernel, memory, filesystem, network stack. Same isolation as AWS Lambda. Escape requires a Firecracker hypervisor exploit |
| **Zero-credential sandbox** | Sandbox has **no mounted secrets, no VCS/MCP token env vars**. Credentials served only via authenticated credential proxy. Even a VM escape yields zero credentials from the sandbox (credentials are on the K8s cluster, not in the sandbox VM) |
| **Session-scoped authentication** | Each sandbox gets a unique JWT session token, scoped to tenant + session. Cannot access other tenants' credentials even if the proxy endpoint is known |
| **No cross-session leakage** | Sandbox destroyed after session completion. No persistent state — E2B handles cleanup automatically |
| **Credential proxy tenant scoping** | Proxy validates `tenantId` claim in session token. Returns only that tenant's credentials. Separate K8s Secrets per tenant |
| **Temporal namespace isolation** | One namespace per tenant (see [Deployment](deployment.md)). Workflow IDs, signals, and queries scoped to tenant |
