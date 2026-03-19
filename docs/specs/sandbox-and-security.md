# Sandbox & Security

> Part of [AI SDLC Orchestrator](../overview.md) specification
> See also: [Sandbox Research](sandbox-research.md) for full technology evaluation

---

## Technology Choice: Multi-Backend Sandbox Architecture

Each agent session runs in a **dedicated sandbox** — a Firecracker/KVM microVM with its own kernel, filesystem, and network stack. The orchestrator supports **two sandbox backends** via a `SandboxPort` abstraction:

1. **E2B** — Firecracker microVMs, purpose-built for AI agents. Best SDK maturity. Three modes: Cloud (SaaS), BYOC (enterprise, AWS only), Self-Hosted (open-source, Nomad/Consul stack)
2. **K8s Agent Sandbox + Kata Containers** — Kubernetes-native CRDs with hardware VM isolation. Best for regulated/banking/on-prem deployments. Runs in the same K8s cluster as the orchestrator

The backend is selected per deployment model. The orchestrator core is backend-agnostic — all sandbox interaction goes through `SandboxPort`.

### Comparison Table

| Technology | Isolation | Startup | Infrastructure | AI-agent focus | Banking-ready |
|---|---|---|---|---|---|
| **E2B Cloud** | **Firecracker microVM** | **~150ms** | **SaaS** | **Purpose-built** | No (data sovereignty) |
| **E2B BYOC** | **Firecracker microVM** | **~150ms** | **Customer AWS VPC** | **Purpose-built** | **Yes (AWS only)** |
| **E2B Self-Hosted** | **Firecracker microVM** | **~150ms** | **Nomad/Consul stack** | **Purpose-built** | Problematic (dual orchestration) |
| **Agent Sandbox + Kata** | **KVM microVM (CLH/FC/QEMU)** | **~200ms (warm: <1s)** | **K8s RuntimeClass** | **K8s-native** | **Yes (any infra)** |
| Agent Sandbox + gVisor | User-space kernel | ~100ms | K8s RuntimeClass | K8s-native | Marginal (software boundary) |
| Docker/OCI | Shared kernel | 10-50ms | Self-managed | General-purpose | No |

### SandboxPort Abstraction

```typescript
interface SandboxPort {
  create(params: SandboxCreateParams): AsyncResult<SandboxHandle>;
  exec(handle: SandboxHandle, command: string): AsyncResult<ExecResult>;
  writeFile(handle: SandboxHandle, path: string, data: Buffer): AsyncResult<void>;
  readFile(handle: SandboxHandle, path: string): AsyncResult<Buffer>;
  destroy(handle: SandboxHandle): AsyncResult<void>;
}

interface SandboxCreateParams {
  templateId: string;                  // E2B template ID or SandboxTemplate name
  envVars: Record<string, string>;     // AI_PROVIDER_API_KEY, SESSION_TOKEN, etc.
  timeoutSeconds: number;
  metadata: Record<string, string>;    // workflowId, tenantId, sessionId
}
```

Two implementations:
- **`E2bSandboxAdapter`** — wraps `e2b` npm package. Used for SaaS and BYOC deployments
- **`K8sSandboxAdapter`** — wraps Agent Sandbox SDK (creates SandboxClaim, interacts via Sandbox Router HTTP API). Used for regulated/on-prem deployments

### Backend Selection Per Deployment Model

| Deployment Model | Sandbox Backend | Why |
|---|---|---|
| **SaaS** (we run everything) | E2B Cloud | Zero ops, mature SDK, fastest time-to-market |
| **Hybrid** (bank on AWS) | E2B BYOC | Data stays in bank's AWS VPC, E2B manages sandbox infra |
| **Hybrid** (bank on any cloud/on-prem) | Agent Sandbox + Kata | K8s-native, runs in bank's cluster, NetworkPolicy per template |
| **Managed in bank's cloud** | Agent Sandbox + Kata | Same K8s we manage. No second orchestrator |
| **Fully self-hosted by bank** | Agent Sandbox + Kata | On-prem, bare-metal, air-gapped. We provide Helm charts |

### Why E2B (SaaS / BYOC)

1. **Firecracker microVM isolation** — same technology as AWS Lambda. ~50k LoC Rust VMM with minimal attack surface
2. **Purpose-built for AI agents** — SDK provides filesystem access, process execution, and sandbox lifecycle management out of the box
3. **Custom templates from Dockerfiles** — agent sandbox template built from `Dockerfile.agent`. Standard CI/CD
4. **Fast startup** — ~150ms boot, ~80ms from snapshot
5. **MCP gateway** — built-in, 200+ tools from Docker MCP Catalog
6. **BYOC mode** — sandboxes run in customer's AWS VPC. All sensitive data (templates, code, logs) stays in customer infra. Only anonymized metrics cross to E2B control plane

### Why Agent Sandbox + Kata (Regulated / On-Prem)

1. **K8s-native** — runs in the same cluster as the orchestrator. One orchestration system, not two
2. **Kata Containers** — hardware VM isolation with 0 hypervisor-escape CVEs ever. Ant Group (Alipay, $17T+ annual) uses in production for financial AI agent workloads
3. **NetworkPolicy per template** — secure-by-default: blocks all private IPs, allows public internet only. Custom egress rules per SandboxTemplate CRD — not infra-level firewall hacks
4. **Warm pools** — SandboxWarmPool CRD maintains pre-booted VMs for sub-second allocation. Auto-replenishes
5. **On-prem, bare-metal, air-gapped** — Kata works with VT-x/AMD-V hardware. No external dependencies
6. **Confidential Containers pathway** — Intel TDX / AMD SEV-SNP for hardware-attested encrypted VM memory
7. **Compliance** — inherits K8s platform certifications (OpenShift, AKS). K8s audit logs native

### Why NOT E2B Self-Hosted for Banks

E2B's self-hosted mode ([e2b-dev/infra](https://github.com/e2b-dev/infra), Apache-2.0) uses **Nomad + Consul + Cloudflare** — not Kubernetes. This creates problems for banking deployments:

1. **Dual orchestration** — bank operates K8s (orchestrator) AND Nomad/Consul (E2B). Doubles ops complexity
2. **Cloudflare hard dependency** — required for DNS + TLS. Problematic for air-gapped networks
3. **No API-level egress control** — E2B Cloud's `allowOut`/`denyOut` is cloud-only. Self-hosted uses infra-level firewalls
4. **Known stability issues** — orchestrator memory leaks, orphan Firecracker processes, NBD pool exhaustion
5. **Community-only support** — no SLA for self-hosted deployments

See [Sandbox Research](sandbox-research.md) for full E2B self-hosted analysis.

### Deployment Mode Details

| | E2B Cloud | E2B BYOC | Agent Sandbox + Kata |
|---|---|---|---|
| **Where sandboxes run** | E2B's infrastructure | Customer's AWS VPC | Customer's K8s cluster (KVM nodes) |
| **Setup** | API key only | Enterprise agreement + Terraform | `kubectl apply` CRDs + Kata RuntimeClass |
| **SDK** | `e2b` npm package (`domain: 'e2b.app'`) | `e2b` npm package (`domain: 'custom'`) | Agent Sandbox Python/Go SDK or K8s client |
| **Isolation** | Firecracker microVM | Firecracker microVM | Kata microVM (Cloud Hypervisor / Firecracker / QEMU) |
| **Data sovereignty** | Code on E2B infra | **Code in customer VPC** | **Code in customer cluster** |
| **Credential proxy** | Public HTTPS endpoint (Ingress) | Internal LB in customer VPC | K8s ClusterIP Service (private) |
| **Egress control** | `allowOut`/`denyOut` API (HTTP/TLS only) | AWS Security Groups / NACLs | **K8s NetworkPolicy per SandboxTemplate** |
| **Operational overhead** | None | Low (AWS account + E2B management) | Medium (K8s + Kata RuntimeClass + KVM nodes) |
| **Cost model** | Per sandbox-second ($0.05/hr per vCPU) | Per sandbox-second + AWS infra | Infrastructure cost only (open source) |
| **Best for** | SaaS, rapid start | Enterprise on AWS | Regulated, on-prem, air-gapped, any cloud |

**Configuration:**

```yaml
# E2B backend
sandbox:
  backend: e2b
  e2b:
    api_key: k8s://secret/e2b-api-key
    domain: e2b.app                       # E2B Cloud (default)
    # domain: e2b.bank-vpc.internal       # E2B BYOC
    default_template_id: agent-sandbox-v3
    sandbox_timeout_seconds: 3900

# Agent Sandbox + Kata backend
sandbox:
  backend: k8s-agent-sandbox
  k8s_agent_sandbox:
    namespace: agent-sandboxes
    template_name: agent-sandbox-template  # SandboxTemplate CRD name
    runtime_class: kata-clh                # kata-clh | kata-fc | kata-qemu | gvisor
    warm_pool_size: 10                     # SandboxWarmPool replicas
    router_url: http://sandbox-router-svc.agent-sandboxes.svc.cluster.local:8080
    shutdown_policy: Delete
```

---

## Sandbox Architecture

### E2B Backend

```
┌──────────────────────────────────────────────────────────────────────┐
│  Worker Pod (orchestrator-worker, in K8s)                            │
│                                                                      │
│  invokeAgent Activity → SandboxPort (E2bSandboxAdapter):             │
│    1. Generate session token (JWT, short-lived, tenant-scoped)      │
│    2. SandboxPort.create() → E2B SDK:                                │
│       - Template: agent-sandbox (built from Dockerfile.agent)        │
│       - Env vars: AI_PROVIDER_API_KEY (injected by credential       │
│         proxy), SESSION_TOKEN, CREDENTIAL_PROXY_URL, TRACEPARENT   │
│       - Timeout: startToCloseTimeout + 5-min buffer                 │
│    3. SandboxPort.exec() → clone repo, install deps, run agent       │
│    4. Monitor sandbox, heartbeat to Temporal                         │
│    5. SandboxPort.readFile() → AgentResult from sandbox filesystem   │
│    6. SandboxPort.destroy() → E2B SDK                                │
│    7. Revoke session token                                           │
└──────────────────────────────────────────────────────────────────────┘
         │ E2B SDK (HTTPS)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  E2B Sandbox (dedicated Firecracker microVM per session)             │
│                                                                      │
│  Isolation: Firecracker VM boundary — separate kernel, memory,       │
│             filesystem. Same isolation as AWS Lambda.                 │
│  /workspace → writable dir                                           │
│  NO secrets mounted (except AI provider API key)                     │
│  GIT_ASKPASS → calls credential proxy at $CREDENTIAL_PROXY_URL       │
│  Network: outbound internet (AI provider API, platform APIs, proxy)  │
└──────────────────────────────────────────────────────────────────────┘
```

### Agent Sandbox + Kata Backend

```
┌──────────────────────────────────────────────────────────────────────┐
│  Worker Pod (orchestrator-worker, in K8s)                            │
│                                                                      │
│  invokeAgent Activity → SandboxPort (K8sSandboxAdapter):             │
│    1. Generate session token (JWT, short-lived, tenant-scoped)      │
│    2. SandboxPort.create() → creates SandboxClaim CRD:               │
│       - SandboxTemplate: agent-sandbox-template (runtimeClass: kata) │
│       - Warm pool provides pre-booted VM (sub-second)                │
│       - Env vars injected via K8s Secret / ConfigMap                 │
│       - shutdownTime set to startToCloseTimeout + buffer             │
│    3. SandboxPort.exec() → Sandbox Router HTTP API:                  │
│       - X-Sandbox-ID header routes to correct pod                    │
│       - Clone repo, install deps, run agent                          │
│    4. Monitor via K8s pod status, heartbeat to Temporal              │
│    5. SandboxPort.readFile() → Sandbox Router HTTP API               │
│    6. SandboxPort.destroy() → kubectl delete SandboxClaim            │
│    7. Revoke session token                                           │
└──────────────────────────────────────────────────────────────────────┘
         │ K8s API (SandboxClaim) + HTTP (Sandbox Router)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Kata Sandbox Pod (dedicated KVM microVM per session)                 │
│                                                                      │
│  Isolation: Kata Containers VM boundary — separate kernel, memory,   │
│             filesystem. Cloud Hypervisor / Firecracker VMM.          │
│  /workspace → writable dir (PVC for persistence across retries)      │
│  NO secrets mounted (except AI provider API key)                     │
│  GIT_ASKPASS → calls credential proxy (K8s ClusterIP — private)      │
│  NetworkPolicy (from SandboxTemplate):                               │
│    - Egress: AI provider API + credential proxy + public internet    │
│    - All private IPs blocked by default                              │
│    - Ingress: Sandbox Router only                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Credential Proxy Service (Shared by Both Backends)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Credential Proxy Service (K8s Deployment, in orchestrator cluster)   │
│                                                                      │
│  Exposure depends on sandbox backend:                                │
│    E2B Cloud:          Public HTTPS endpoint (Ingress)               │
│    E2B BYOC:           Internal LB in customer VPC                   │
│    Agent Sandbox+Kata: K8s ClusterIP (private — same cluster)        │
│                                                                      │
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
│    - TLS termination at Ingress (E2B) or mTLS (Agent Sandbox)       │
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
| **3. Session token scoping** | Each sandbox gets a unique JWT session token: short TTL, scoped to tenant + session ID. Token is the only credential the sandbox holds (besides AI provider API key) | Cross-session credential reuse, cross-tenant access. Token expires with sandbox |
| **4. E2B sandbox limits** | Configurable timeout and resource limits per sandbox (CPU, memory, disk) | Resource exhaustion, runaway processes |
| **5. Agent SDK limits** | `maxTurns`, `costLimitUsd` | Runaway sessions, cost overruns |
| **6. Ephemeral sandboxes** | Sandbox destroyed after session — no persistent state between sessions. E2B handles cleanup | Cross-session data leakage |
| **7. Per-tenant API key rotation** | K8s CronJob — separate API keys per provider per tenant, 90-day rotation cycle | Stale or compromised API keys persisting indefinitely |
| **8. Credential proxy anomaly detection** | Behavioral analysis — detect excessive requests, post-completion calls, unknown MCP servers | Credential exfiltration, prompt injection exploitation, lingering processes |
| **9. MCP server allowlisting** | Curated registry — only verified MCP servers allowed when tenant policy is `'curated'` | Malicious or unvetted MCP servers executing in sandbox |
| **10. Egress audit** | Credential proxy logs — all outbound connections logged with tenant, session, destination | Undetected exfiltration, post-incident forensics gaps |

**Isolation boundary clarification:** Firecracker provides hardware-level VM isolation between the sandbox and the host. The agent runs alone in the sandbox — no sidecar containers, no shared processes. This is a simpler security model than the multi-container pod approach: one process boundary (VM), one trust boundary (sandbox ↔ outside world).

**Network model by backend:**
- **E2B Cloud** — sandboxes have outbound internet access. API-level egress control via `allowOut`/`denyOut` (HTTP port 80 + TLS port 443 only, no UDP/QUIC). 2,500 outbound connections per sandbox
- **E2B BYOC** — sandboxes in customer VPC. Standard AWS networking controls (Security Groups, NACLs, PrivateLink). Can operate in private subnets with no public internet
- **Agent Sandbox + Kata** — **K8s NetworkPolicy per SandboxTemplate CRD**. Secure-by-default: blocks all private IPs (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), allows public internet only. Custom egress rules allowlist credential proxy + AI provider API. Works with any NetworkPolicy-capable CNI (Calico, Cilium). Dynamic updates — changing template policy updates all sandboxes

Mitigations (all backends):
- **Credential proxy is the only source of secrets** — even with unrestricted egress, the agent has no credentials to exfiltrate (except the AI provider API key and the session token)
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
| AI provider API key | Environment variable (agent needs it for AI provider API calls) |
| Persistent storage | None — ephemeral filesystem destroyed on sandbox termination |

**Ingress policy:** E2B sandboxes have no exposed ports — no inbound connections are possible except via the E2B SDK. The sandbox can only be controlled by the `invokeAgent` Activity that created it.

---

## Credential Proxy

The credential proxy runs as a **standalone K8s service** (Deployment + Service), serving credentials to E2B sandboxes over HTTPS:

### Architecture

- **E2B sandbox:** No secrets mounted (except AI provider API key). `GIT_ASKPASS` environment variable points to a script that calls the credential proxy at `$CREDENTIAL_PROXY_URL` with the session token
- **Credential proxy service:** K8s Deployment + Service. K8s Secrets mounted (VCS PATs, MCP tokens, signing key). Authenticates requests via JWT session token. Implements git credential protocol and MCP token endpoints
- **Communication:** HTTPS from E2B sandbox to credential proxy. Session token in `Authorization: Bearer` header
- **Session tokens:** Generated by the `invokeAgent` Activity before sandbox creation. JWT with claims: `tenantId`, `sessionId`, `exp` (sandbox timeout + buffer). Signed with an HMAC key stored in K8s Secrets. Validated by the proxy on every request

### Networking by Deployment Mode

| Mode | Credential proxy exposure | TLS | Sandbox → Proxy path |
|---|---|---|---|
| **E2B Cloud** | Public HTTPS endpoint via K8s Ingress (e.g., `https://credential-proxy.example.com`) | TLS termination at Ingress | Internet: sandbox in E2B Cloud → public Ingress → proxy pod |
| **E2B BYOC** | Internal LB in customer VPC — no public exposure | TLS within VPC | Private: sandbox in customer VPC → internal LB → proxy pod |
| **Agent Sandbox + Kata** (same cluster) | **K8s ClusterIP Service — never exposed to internet** | mTLS via service mesh or plain TLS within cluster | Private: sandbox pod → ClusterIP → proxy pod (same cluster network) |
| **Agent Sandbox + Kata** (separate cluster) | Internal HTTPS endpoint via VPN / private peering | TLS over private link | VPN/peering: sandbox cluster → private link → proxy pod |

Agent Sandbox + Kata in the same K8s cluster is the most secure option: the credential proxy is a ClusterIP Service (no Ingress, no public IP), and sandbox-to-proxy communication is entirely within the cluster network. NetworkPolicy on the SandboxTemplate explicitly allows egress to the credential proxy's ClusterIP.

> **AI Provider API key:** The credential proxy injects the appropriate provider API key (e.g., Anthropic, OpenAI, Google) based on the tenant's `ai_provider_api_key_refs` JSONB configuration. Each provider key is stored as a separate K8s secret. Unlike VCS PATs and MCP tokens, the API key is intentionally accessible to the agent process — the agent needs it to call the AI provider API directly. This is the one credential the sandbox holds besides the session token.

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

### Credential Proxy Anomaly Detection

The credential proxy implements behavioral analysis to detect suspicious agent activity in real time.

**Tracked signals:**

| Signal | Threshold (default) | Indicates |
|---|---|---|
| Excessive requests per session | >500/hour | Possible credential exfiltration attempt — agent rapidly requesting tokens |
| Post-completion requests | Any request after agent reports done | Possible lingering process — sandbox should be destroyed post-completion |
| Requests to unknown MCP servers | Server not in `TENANT_MCP_SERVER` or `MCP_SERVER_REGISTRY` | Possible prompt injection payload — agent trying to reach attacker-controlled server |
| Unusual token patterns | Token request for platform not associated with task | Possible lateral movement — agent requesting credentials outside task scope |

**Thresholds:** Configurable per tenant via admin API. Tenants with high-volume workflows can raise limits; security-sensitive tenants can lower them.

**Implementation:**
- Sliding window counters maintained in credential proxy memory (per session token)
- When a threshold is breached: alert fires → `AGENT_SESSION.status` updated to `'anomaly_detected'` → `COST_ALERT` entity created in data model (see [Data Model](data-model.md))
- Optional auto-terminate: if tenant policy `anomaly_action = 'terminate'`, credential proxy signals the orchestrator to destroy the sandbox immediately
- All anomaly events logged with full context (session ID, tenant ID, request details, signal type)

### Credential Proxy High Availability

The credential proxy is a critical path dependency — sandbox git operations and MCP token requests fail if the proxy is unreachable.

**Deployment topology:**
- **2+ replicas** with `PodDisruptionBudget` (`minAvailable: 1`) — at least one replica survives node drains and rolling updates
- **Pod anti-affinity rule** (`preferredDuringSchedulingIgnoredDuringExecution`) — spreads replicas across nodes to survive single-node failure

**GIT_ASKPASS circuit breaker:**
- If the credential proxy is unreachable after **3 retries** (1s timeout each), fail open with **short-TTL cached credentials** (60s cache in sandbox) rather than blocking git operations indefinitely
- Cache is **per-session**, cleared on sandbox destroy — no stale credentials persist
- Cache hit logs a warning for post-incident review

**Health endpoints:**
- `/healthz` — readiness probe (returns 200 when proxy can serve requests, validate JWTs, and read mounted secrets)
- `/livez` — liveness probe (returns 200 when process is responsive)

### Threat Model & Limitations

The credential proxy pattern provides strong **accidental exposure prevention**:
- No credentials in environment variables (except AI provider API key) — agent cannot read `/proc/self/environ` to obtain VCS/MCP secrets
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

### Prompt Injection Threat

**Risk:** Malicious task descriptions or code review comments could contain prompt injection attempts targeting the AI agent, potentially causing it to exfiltrate credentials, modify unrelated files, or create malicious code.

**Mitigation — three-layer defense-in-depth:**

1. **Input sanitization in orchestrator** — strip known prompt injection patterns before agent invocation. The `invokeAgent` Activity preprocesses task descriptions and code review comments to remove common injection payloads
2. **Output validation post-agent** — scan MR descriptions, commit messages, and file diffs for suspicious patterns (credential-like strings, encoded payloads, references to unrelated repositories)
3. **Credential proxy anomaly detection** — flag unusual request patterns that may indicate a successfully injected prompt (see [Credential Proxy Anomaly Detection](#credential-proxy-anomaly-detection) above)

See [Integration — Prompt Injection Defense](integration.md) for implementation details.

---

## Template Versioning

The agent sandbox template (built from `Dockerfile.agent`) is managed differently per backend, but shares the same Dockerfile source:

### E2B Backend

1. **Immutable template versions** — each build produces a versioned E2B template ID. Old versions remain available
2. **Build:** `Dockerfile.agent` → `e2b template build` → E2B template registry
3. **Per-tenant override** — `TENANT_REPO_CONFIG.agent_template_id` specifies a custom E2B template ID. Default: latest stable. Enables canary rollout
4. **Rollback** — revert `agent_template_id` to previous template. Old templates remain in E2B

### Agent Sandbox + Kata Backend

1. **Standard OCI images** — `Dockerfile.agent` → `docker build` → push to any OCI registry (ECR, GCR, private)
2. **SandboxTemplate CRD** references the image tag: `image: registry.internal/agent-sandbox:v3`
3. **Per-tenant override** — `TENANT_REPO_CONFIG.agent_template_id` specifies a SandboxTemplate CRD name. Default: `agent-sandbox-template`
4. **Rollback** — update SandboxTemplate image tag. Warm pool replenishes with new image. Running sandboxes unaffected
5. **SandboxWarmPool** — pre-pulls and pre-boots images. Template update → pool drains old pods, creates new ones

### Shared

- **Template CI pipeline** — `Dockerfile.agent` changes trigger: build (E2B template + OCI image) → deploy to staging → smoke test (clone test repo, `npm ci`, `tsc`, `jest`) → promote
- **In-flight safety** — running sandboxes use the template they were created with. Updates only affect new sandboxes
- **Supply chain security** — base images pinned by digest (`FROM node:22@sha256:...`). Trivy scanning in CI — critical CVEs block promotion

---

## Sandbox Lifecycle & Cleanup

### E2B Backend

- **E2B timeout** — set to `startToCloseTimeout` + 5-minute buffer. E2B automatically terminates sandboxes that exceed this timeout
- **Orphaned sandbox cleanup** — if the Activity crashes, E2B's timeout terminates the sandbox automatically. Reconciliation CronJob (every 15 min) queries active E2B sandboxes (via SDK) with metadata `orchestrator.ai/managed=true` and terminates orphans
- **Heartbeat-based reattachment** — Activity stores E2B sandbox ID in Temporal heartbeat details. On retry, new Activity reads last heartbeat, checks if sandbox is running (via SDK), and reattaches

### Agent Sandbox + Kata Backend

- **SandboxClaim TTL** — `shutdownTime` set to `startToCloseTimeout` + 5-minute buffer. Controller automatically deletes expired sandboxes (`shutdownPolicy: Delete`)
- **Orphaned sandbox cleanup** — if the Activity crashes, the SandboxClaim's `shutdownTime` ensures cleanup. K8s garbage collection (OwnerReference) deletes Pod, Service, and PVCs when the SandboxClaim is deleted
- **Heartbeat-based reattachment** — Activity stores SandboxClaim name in Temporal heartbeat details. On retry, new Activity checks if the sandbox pod is still running (via K8s API), and reconnects via Sandbox Router
- **Warm pool replenishment** — when a SandboxClaim adopts a warm pod, SandboxWarmPool controller automatically creates a replacement to maintain target replica count

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
| **Zero-credential sandbox** | Sandbox has **no mounted secrets, no VCS/MCP token env vars**. Only the AI provider API key is present (injected by credential proxy based on tenant's `ai_provider_api_key_refs`). Other credentials served only via authenticated credential proxy. Even a VM escape yields zero additional credentials from the sandbox (credentials are on the K8s cluster, not in the sandbox VM) |
| **Session-scoped authentication** | Each sandbox gets a unique JWT session token, scoped to tenant + session. Cannot access other tenants' credentials even if the proxy endpoint is known |
| **No cross-session leakage** | Sandbox destroyed after session completion. No persistent state — E2B handles cleanup automatically |
| **Credential proxy tenant scoping** | Proxy validates `tenantId` claim in session token. Returns only that tenant's credentials. Separate K8s Secrets per tenant |
| **Temporal namespace isolation** | One namespace per tenant (see [Deployment](deployment.md)). Workflow IDs, signals, and queries scoped to tenant |

---

## API Key Management

Each tenant has **separate API keys per AI provider**, stored as individual K8s Secrets and referenced via the `TENANT.ai_provider_api_key_refs` JSONB column.

### Per-Tenant Keys

- Each tenant configures one or more AI provider keys (e.g., Anthropic, OpenAI, Google) in `ai_provider_api_key_refs`
- Each key reference points to a K8s Secret: `{"anthropic": "k8s://secret/tenant-acme-anthropic-key", "openai": "k8s://secret/tenant-acme-openai-key"}`
- The credential proxy resolves the appropriate key at sandbox creation time based on the tenant's configured provider for the task
- **Key isolation:** one compromised tenant key does not affect other tenants — blast radius is limited to a single tenant + single provider

### Rotation Cycle

- **Recommended:** 90-day rotation, automated via K8s CronJob
- **Process:** CronJob creates new K8s Secret with new key → updates `ai_provider_api_key_refs` reference → deletes old Secret after grace period (24h)
- **Zero-downtime:** in-flight sandboxes continue using the key injected at sandbox creation. New sandboxes pick up the rotated key
- **Emergency rotation:** manual trigger via admin API — immediate Secret update, no grace period

### Spend Tracking

- Per-key usage tracked for cost attribution to specific tenants and providers
- AI provider API keys are unique per tenant, enabling accurate cost allocation without token-counting approximations
- Links to `COST_EVENT` entity in [Data Model](data-model.md) for recording per-session spend

---

## MCP Server Policy Enforcement

MCP server access is controlled by the tenant's `mcp_server_policy` setting, enforced at sandbox creation time.

### Policy Modes

| Mode | Behavior | Default for |
|---|---|---|
| `'curated'` | Only MCP servers from `MCP_SERVER_REGISTRY` with `is_verified = true` are allowed | New tenants |
| `'open'` | Any MCP server configured in `TENANT_MCP_SERVER` is allowed (tenant-managed) | Self-hosted / enterprise tenants |

### Enforcement Point

The `invokeAgent` Activity checks the tenant's `mcp_server_policy` before configuring sandbox MCP servers:

1. Load tenant's `TENANT_MCP_SERVER` entries for the task's repository
2. If policy is `'curated'`: filter out any server where `MCP_SERVER_REGISTRY.is_verified = false` or server is not in the registry at all
3. If policy is `'open'`: pass all configured servers through (tenant assumes responsibility)
4. Remaining servers are injected into the sandbox MCP configuration

Unverified servers in curated mode are silently filtered out, and a warning is logged for the tenant administrator.

### Admin Workflow

New MCP server onboarding:
1. Server added to `MCP_SERVER_REGISTRY` with `is_verified = false`
2. Security review: assess server permissions, data access patterns, network behavior
3. Set `is_verified = true` after review — server becomes available to curated-mode tenants
4. `scoping_capability` field set: `'full'` (server supports per-repo/per-tenant scoping), `'partial'` (limited scoping), `'none'` (global access only). This informs tenant administrators about the access scope of each server
