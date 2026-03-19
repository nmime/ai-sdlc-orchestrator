# Sandbox & Security

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Technology Choice: Kata Containers

Each agent session runs in a **dedicated Kata Containers microVM pod** — a K8s pod backed by a lightweight VM with hardware-level KVM isolation. Each agent gets a separate kernel, separate memory space, and no shared host kernel surface.

### Comparison Table

| Technology | Isolation | Startup | Memory OH | I/O OH | KVM? | AI-agent focus |
|---|---|---|---|---|---|---|
| **Kata Containers** | **Full VM (KVM)** | **150-300ms¹** | **50-150 MB** | **5-15%** | **Yes** | **General-purpose** |
| gVisor (runsc) | User-space kernel | ~50-100ms | 10-50 MB | 10-30% | No | General-purpose |
| Docker/OCI | Shared kernel | 10-50ms | ~0 | 0% | No | General-purpose |

¹ VM boot time only — does not include image pull, pod scheduling, or container readiness. Total pod-ready time depends on image size and cluster scheduling.

### Why Kata Containers

1. **Hardware-level isolation (KVM)** — each pod is a separate VM with its own kernel. A pod escape requires a hypervisor exploit (KVM), which is orders of magnitude harder than a kernel exploit (gVisor) or namespace escape (containers). This is a similar isolation *approach* to AWS Lambda/Fargate — note that Lambda uses Firecracker (~50k LoC purpose-built VMM) while Kata typically uses QEMU (much larger attack surface) or Cloud Hypervisor (minimal but less battle-tested). See [Hypervisor Selection in Open Questions](roadmap.md)
2. **K8s-native** — Kata Containers is a CRI-compatible runtime. Pods use `runtimeClassName: kata-containers` — no separate infrastructure to deploy, manage, or Terraform. The sandbox runtime is part of the K8s cluster, not alongside it
3. **No vendor lock-in** — CNCF project, Apache-2.0 license, runs on any K8s cluster with KVM support. No proprietary APIs, no cloud-specific dependencies
4. **Standard K8s primitives** — NetworkPolicy for egress filtering, Secrets for credential mounting, resource limits for CPU/memory, pod lifecycle for cleanup. All existing K8s tooling (monitoring, logging, RBAC) works natively
5. **Multi-container pod model** — agent container and credential-proxy sidecar run in the same pod but with K8s-native container isolation. No uid/hidepid hacks — K8s provides filesystem and process separation between containers out of the box
6. **OCI image versioning** — agent image is a standard Docker/OCI image built from `Dockerfile.agent`, pushed to any container registry, referenced by tag in pod spec. Standard CI/CD — no custom template registries
7. **Simpler than separate infrastructure** — Kata runs as a RuntimeClass in K8s (no Terraform, no separate API servers). However, it requires KVM-capable nodes, hypervisor selection (QEMU vs Cloud Hypervisor), containerd shimv2 configuration, and validation that the managed K8s provider supports nested virtualization. Simpler than a parallel VM fleet, but not zero operational overhead
8. **Ephemeral pods** — pods are created per session and deleted on completion. K8s garbage collection handles cleanup. No persistent state between sessions

**Industry context:** Devin, Google Jules, and Cursor Background Agents all use full VMs per session. Kata Containers provides the same KVM-level isolation using standard K8s primitives, without requiring a separate sandbox infrastructure.

---

## Sandbox Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Worker Pod (orchestrator-worker, in K8s)                            │
│                                                                      │
│  invokeAgent Activity:                                               │
│    1. Create Kata pod via K8s API:                                   │
│       - runtimeClassName: kata-containers                             │
│       - Agent container from OCI image (Dockerfile.agent)            │
│       - Credential-proxy sidecar from OCI image                      │
│         (Dockerfile.credential-proxy)                                │
│       - K8s Secret mounted into credential-proxy sidecar only        │
│       - Resource limits (CPU, memory, ephemeral storage)             │
│       - Labels: workflowId, tenantId, sessionId                      │
│    2. Wait for pod Ready                                             │
│    3. Inside agent container: clone repo, install deps, run agent    │
│    4. Monitor pod, heartbeat to Temporal                             │
│    5. Collect AgentResult from pod logs / exit status                │
│    6. Delete pod (K8s API)                                           │
└──────────────────────────────────────────────────────────────────────┘
         │ K8s API
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Kata Containers microVM Pod (dedicated VM per session)              │
│                                                                      │
│  Isolation: KVM hardware boundary — separate kernel, memory,         │
│             network namespace. No shared host kernel surface.        │
│                                                                      │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────┐│
│  │  agent container                │ │  credential-proxy sidecar   ││
│  │                                 │ │                             ││
│  │  /workspace → writable dir      │ │  Listens on localhost:9999  ││
│  │  NO secrets mounted             │ │  K8s Secret mounted:        ││
│  │  NO credential env vars         │ │    - VCS PAT                ││
│  │  GIT_ASKPASS → calls proxy      │ │    - MCP tokens             ││
│  │    at localhost:9999             │ │  Serves git credential      ││
│  │                                 │ │    protocol only             ││
│  │  Toolchain:                     │ │  Never exposes raw tokens   ││
│  │    Git, Node.js, Python, Go     │ │                             ││
│  │    claude-agent-sdk             │ │  Read-only filesystem       ││
│  │    MCP server binaries          │ │                             ││
│  └─────────────────────────────────┘ └─────────────────────────────┘│
│                                                                      │
│  Network (K8s NetworkPolicy):                                        │
│    - api.anthropic.com (Claude API)                                  │
│    - Platform APIs (jira, gitlab, github — from tenant config)       │
│    - MCP server endpoints (from tenant config)                       │
│    - DENY all other egress                                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Security Layers (Defense-in-Depth)

| Layer | Control | What It Prevents |
|---|---|---|
| **1. Kata VM boundary (KVM)** | Each pod is a separate KVM microVM with its own kernel | Kernel exploits, `/proc` abuse, pod breakout — requires hypervisor exploit to escape |
| **2. K8s NetworkPolicy** | Per-namespace egress allowlist. Only platform APIs + MCP endpoints + DNS permitted. All other outbound traffic denied. Agent cannot modify NetworkPolicy from inside the pod | Exfiltration to unauthorized destinations. Standard K8s NetworkPolicy operates at L3/L4 — DNS tunneling mitigation requires L7 inspection (CoreDNS response policy zones or DNS proxy). See [Open Questions](roadmap.md) |
| **3. Multi-container pod isolation** | Agent container and credential-proxy sidecar are separate containers in the same pod. Within the Kata guest VM, K8s provides **guest-kernel namespace isolation** between containers — separate filesystem, PID, and mount namespaces. This is container-level isolation (similar to Docker), not hardware-level | Credential theft via casual filesystem traversal, environment inspection (`/proc/self/environ`), or process listing. Note: a sufficiently privileged process within the guest VM could theoretically cross container boundaries (guest-kernel isolation, not KVM-level between containers) |
| **4. K8s resource limits** | CPU, memory, ephemeral storage limits per pod (K8s resource requests/limits) | Resource exhaustion, noisy neighbors |
| **5. Agent SDK limits** | `maxTurns`, `costLimitUsd` | Runaway sessions, cost overruns |
| **6. Ephemeral pods** | Pod deleted after session — no persistent state between sessions. K8s garbage collection handles cleanup | Cross-session data leakage |

**Isolation boundary clarification:** KVM provides hardware-level isolation between the Kata pod and the host (Layer 1). However, isolation *between containers within the same pod* (agent ↔ credential-proxy sidecar) is **guest-kernel namespace isolation** — the same mechanism Docker uses, running inside the Kata guest VM. This is still defense-in-depth (two layers must be breached: guest-kernel namespace escape + KVM escape to reach the host), but it is not hardware-level isolation between the agent and the sidecar. A guest-kernel namespace escape within the Kata VM would expose sidecar secrets. The practical risk is low (Kata's guest kernel has a minimal attack surface), but the boundary should be understood accurately.

**Ingress policy:** Kata agent pods have no exposed ports and no K8s Service — no inbound connections are possible except from within the same pod (localhost). The only network listener is the credential-proxy sidecar on `localhost:9999`, accessible only from within the pod's network namespace.

### Pod Security Hardening

Agent pods enforce the following security contexts:

| Container | Setting | Value |
|---|---|---|
| agent | `securityContext.runAsNonRoot` | `true` |
| agent | `securityContext.allowPrivilegeEscalation` | `false` |
| agent | `capabilities` | `drop: ["ALL"]` |
| credential-proxy | `securityContext.runAsNonRoot` | `true` |
| credential-proxy | `securityContext.readOnlyRootFilesystem` | `true` |
| credential-proxy | `securityContext.allowPrivilegeEscalation` | `false` |
| credential-proxy | `capabilities` | `drop: ["ALL"]` |

**Pod-level:** Pod Security Admission enforces the `restricted` profile on agent namespaces. Seccomp profile: `RuntimeDefault` on both containers.

**`shareProcessNamespace: false`** (default) must be maintained on agent pods to prevent cross-container process visibility within the Kata guest VM.

**Why credential proxy instead of env vars:**
Passing VCS PAT as an env var to the agent container would expose it — the agent could read `/proc/self/environ` or print env vars. The credential proxy pattern (recommended by [Anthropic's secure deployment guide](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)) ensures the agent container **never has access to the credential at all** — credentials are mounted only in the sidecar container, and the agent authenticates transparently through the proxy.

**Multi-container isolation advantage over single-container approaches:**
In a single-container model, both the agent and the credential proxy share the same filesystem and process namespace. This requires workarounds like separate Unix users, `hidepid=2` on `/proc`, and careful permission management. The multi-container pod model avoids these workarounds — K8s provides container-level namespace isolation by default (separate filesystem, PID, mount namespaces). The agent container cannot access the sidecar's mounted secrets or processes through standard interfaces. This is guest-kernel-level isolation within the Kata VM — not hardware-level between containers, but significantly stronger than same-container approaches.

---

## Credential Proxy

The credential-proxy sidecar runs alongside the agent container in the same Kata pod:

### Architecture

- **Agent container:** No secrets mounted. `GIT_ASKPASS` environment variable points to a script that calls `localhost:9999` (the credential proxy sidecar)
- **Credential-proxy sidecar:** K8s Secret mounted as a volume. Listens on `localhost:9999`. Implements the git credential protocol — receives credential requests from the agent's git process and returns the PAT from the mounted secret
- **Communication:** Both containers share the pod's network namespace (`localhost`). The proxy only serves credential-related requests (git credential protocol). No endpoint exposes raw tokens
- **Read-only sidecar:** The credential-proxy container runs with a read-only root filesystem. Agent cannot modify or replace the proxy even if it could somehow access the sidecar's filesystem

> **Anthropic API key:** The Anthropic API key is mounted as an environment variable in the agent container from a K8s Secret. Unlike VCS PATs and MCP tokens, the API key is intentionally accessible to the agent process — the agent needs it to call the Claude API directly. This is the one credential the agent container holds.

### GIT_ASKPASS Flow

```
Agent: git push origin ai/PROJ-123
  → git asks GIT_ASKPASS for credentials
  → GIT_ASKPASS script: curl localhost:9999/git-credential
  → credential-proxy sidecar: reads PAT from mounted K8s Secret
  → returns PAT to git process
  → git authenticates with VCS
  → Agent never sees the PAT
```

### MCP Token Injection

MCP servers that require authentication tokens (e.g., Atlassian, GitLab, GitHub MCP) receive their tokens through the same credential-proxy sidecar:

- The sidecar mounts all tenant MCP tokens from K8s Secrets
- MCP server configurations reference `localhost:9999/mcp-token/{server-name}` for token injection
- The agent process never has access to MCP tokens directly

### Threat Model & Limitations

The credential proxy pattern provides strong **accidental exposure prevention**:
- No credentials in environment variables — agent cannot read `/proc/self/environ` to obtain secrets
- No credentials on filesystem — agent container has no mounted secrets
- No credential endpoints beyond the git credential protocol and MCP token injection

**What the proxy does NOT prevent:** A deliberately malicious or prompt-injected agent could call `curl localhost:9999/git-credential` to obtain the PAT, then exfiltrate it via an allowed egress endpoint (e.g., embed it in a commit message, send it via an MCP server call, or POST it to an allowed API). This is the same trust boundary as every agent-in-sandbox architecture (Devin, Jules, Cursor Background Agents) — you must trust that the agent will not actively exfiltrate credentials via allowed channels.

**Recommended mitigations:**
- **Credential proxy audit logging** — log every request to the proxy (timestamp, caller, endpoint, response status) for post-incident analysis
- **Rate limiting on proxy endpoints** — limit credential requests to expected usage patterns (e.g., max 10 git-credential requests per session)
- **Agent prompt hardening** — system prompt explicitly instructs the agent to never log, print, or transmit credentials
- **Egress content inspection** (future) — L7 proxy on allowed endpoints to detect credential patterns in outbound traffic

> **Note:** The PAT transits through the agent's git process memory space during `GIT_ASKPASS` flow. The proxy prevents *storage* and *casual access* to credentials, not *transit through the git process*.

---

## Agent Image Versioning

The agent image (built from `Dockerfile.agent`) is a standard OCI container image managed through standard CI/CD:

1. **Immutable tags** — each build produces a tagged image (e.g., `agent:v3`, `agent:sha-abc123`). Old tags are never overwritten — new pods reference a specific tag
2. **Standard container registry** — images pushed to the cluster's container registry (any OCI-compliant registry). No custom template systems
3. **Per-tenant image override** — `TENANT_REPO_CONFIG.agent_image_tag` can specify a custom image tag. Default: latest stable tag. Enables canary rollout — update one tenant's image tag, validate, then promote to all tenants
4. **Rollback** — if a new image breaks agent sessions, revert `TENANT_REPO_CONFIG.agent_image_tag` to the previous tag. Old images remain available in the registry
5. **In-flight safety** — running pods use the image they were created with. Image tag updates only affect new pods. No disruption to in-progress sessions
6. **Image CI pipeline** — `Dockerfile.agent` changes trigger: build image → push to registry → deploy to staging tenant → run smoke test (agent clones a test repo, runs `npm ci`, `tsc`, `jest`) → promote to production tenants
7. **Image supply chain security** — Images signed with `cosign` (Sigstore) at build time. K8s admission controller (e.g., Kyverno or Gatekeeper) rejects unsigned images. Vulnerability scanning with Trivy in CI pipeline — images with critical CVEs are blocked from promotion. Base images pinned by digest (`FROM node:22@sha256:...`), not tag, to prevent supply chain attacks via base image mutation

---

## Pod Lifecycle & Cleanup

- **`activeDeadlineSeconds`** on pod spec — set to `startToCloseTimeout` + 5-minute buffer. K8s automatically terminates pods that exceed this deadline, preventing indefinite hangs from zombie agent processes
- **Orphaned pod CronJob** — A K8s CronJob (every 15 min) queries for pods with label `orchestrator.ai/managed=true` older than their `activeDeadlineSeconds` and deletes them. Catches pods orphaned by worker crashes where the Activity never cleaned up
- **Heartbeat-based reattachment** — The Activity stores the pod name in Temporal heartbeat details. On Activity retry (worker crash/reschedule), the new Activity instance reads the last heartbeat, checks if the pod is still running, and reattaches instead of creating a new pod

---

## Secrets Rotation

K8s Secrets are mounted at pod creation time and are immutable for that pod's lifetime. Rotation follows this process:

1. Update K8s Secret (via external secrets operator, Vault sync, or manual rotation)
2. New pods created after the update receive the new secret value
3. In-flight pods continue with the old secret value until session completes — no disruption to running sessions
4. For emergency rotation (compromised credential): delete in-flight agent pods → Temporal retries Activities → new pods get new credentials

No downtime or coordination required for routine rotation. The credential proxy sidecar reads secrets from the mounted volume at startup, not per-request.

---

## Tenant Isolation

| Layer | Mechanism |
|---|---|
| **Hardware-level isolation** | Each agent session runs in a dedicated Kata Containers microVM pod. Separate kernel, separate memory space, separate network namespace. No shared host kernel surface between sessions. Escape requires a KVM hypervisor exploit |
| **Zero-credential agent** | Agent container has **no mounted secrets, no token env vars**. Credentials are mounted only in the credential-proxy sidecar container. Even a container escape within the pod yields zero credentials from the agent container |
| **No cross-task leakage** | Pod deleted after session completion. No persistent state between sessions — K8s garbage collection handles cleanup |
| **Network isolation** | K8s NetworkPolicy per namespace restricts egress to tenant's platform APIs + MCP endpoints + DNS only. Agent cannot modify NetworkPolicy from inside the pod |
| **Temporal namespace isolation** | One namespace per tenant (see [Deployment](deployment.md)). Workflow IDs, signals, and queries scoped to tenant |
| **K8s namespace isolation** | Agent pods for each tenant run in a dedicated K8s namespace. Combined with NetworkPolicy, this prevents cross-tenant network access |
