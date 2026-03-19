# Sandbox & Security

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Technology Choice: Kata Containers

Each agent session runs in a **dedicated Kata Containers microVM pod** — a K8s pod backed by a lightweight VM with hardware-level KVM isolation. Each agent gets a separate kernel, separate memory space, and no shared host kernel surface.

### Comparison Table

| Technology | Isolation | Startup | Memory OH | I/O OH | KVM? | AI-agent focus |
|---|---|---|---|---|---|---|
| **Kata Containers** | **Full VM (KVM)** | **150-300ms** | **50-150 MB** | **5-15%** | **Yes** | **General-purpose** |
| gVisor (runsc) | User-space kernel | ~50-100ms | 10-50 MB | 10-30% | No | General-purpose |
| Docker/OCI | Shared kernel | 10-50ms | ~0 | 0% | No | General-purpose |

### Why Kata Containers

1. **Hardware-level isolation (KVM)** — each pod is a separate VM with its own kernel. A pod escape requires a hypervisor exploit (KVM), which is orders of magnitude harder than a kernel exploit (gVisor) or namespace escape (containers). This is the same isolation level as AWS Lambda/Fargate
2. **K8s-native** — Kata Containers is a CRI-compatible runtime. Pods use `runtimeClassName: kata-containers` — no separate infrastructure to deploy, manage, or Terraform. The sandbox runtime is part of the K8s cluster, not alongside it
3. **No vendor lock-in** — CNCF project, Apache-2.0 license, runs on any K8s cluster with KVM support. No proprietary APIs, no cloud-specific dependencies
4. **Standard K8s primitives** — NetworkPolicy for egress filtering, Secrets for credential mounting, resource limits for CPU/memory, pod lifecycle for cleanup. All existing K8s tooling (monitoring, logging, RBAC) works natively
5. **Multi-container pod model** — agent container and credential-proxy sidecar run in the same pod but with K8s-native container isolation. No uid/hidepid hacks — K8s provides filesystem and process separation between containers out of the box
6. **OCI image versioning** — agent image is a standard Docker/OCI image built from `Dockerfile.agent`, pushed to any container registry, referenced by tag in pod spec. Standard CI/CD — no custom template registries
7. **Operational simplicity** — Kata runs as a RuntimeClass in K8s. Cluster operators install it once (containerd + kata-runtime). No separate infrastructure nodes, no Terraform, no API servers to manage
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
| **2. K8s NetworkPolicy** | Per-namespace egress allowlist. Only platform APIs + MCP endpoints + DNS permitted. All other outbound traffic denied. Agent cannot modify NetworkPolicy from inside the pod | Exfiltration to unauthorized destinations. DNS tunneling mitigated by restricting DNS to known resolvers |
| **3. Multi-container pod isolation** | Agent container and credential-proxy sidecar are separate containers in the same pod. K8s provides filesystem and process isolation between containers natively — agent container cannot see sidecar's filesystem, environment variables, or process list | Credential theft via filesystem traversal, environment inspection, or process memory reading. **Agent literally has no path to the sidecar's secrets** |
| **4. K8s resource limits** | CPU, memory, ephemeral storage limits per pod (K8s resource requests/limits) | Resource exhaustion, noisy neighbors |
| **5. Agent SDK limits** | `maxTurns`, `costLimitUsd` | Runaway sessions, cost overruns |
| **6. Ephemeral pods** | Pod deleted after session — no persistent state between sessions. K8s garbage collection handles cleanup | Cross-session data leakage |

**Why credential proxy instead of env vars:**
Passing VCS PAT as an env var to the agent container would expose it — the agent could read `/proc/self/environ` or print env vars. The credential proxy pattern (recommended by [Anthropic's secure deployment guide](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)) ensures the agent container **never has access to the credential at all** — credentials are mounted only in the sidecar container, and the agent authenticates transparently through the proxy.

**Multi-container isolation advantage over single-container approaches:**
In a single-container model, both the agent and the credential proxy share the same filesystem and process namespace. This requires workarounds like separate Unix users, `hidepid=2` on `/proc`, and careful permission management. The multi-container pod model eliminates all of this — K8s provides container-level isolation by default. The agent container physically cannot access the sidecar's mounted secrets, environment variables, or processes.

---

## Credential Proxy

The credential-proxy sidecar runs alongside the agent container in the same Kata pod:

### Architecture

- **Agent container:** No secrets mounted. `GIT_ASKPASS` environment variable points to a script that calls `localhost:9999` (the credential proxy sidecar)
- **Credential-proxy sidecar:** K8s Secret mounted as a volume. Listens on `localhost:9999`. Implements the git credential protocol — receives credential requests from the agent's git process and returns the PAT from the mounted secret
- **Communication:** Both containers share the pod's network namespace (`localhost`). The proxy only serves credential-related requests (git credential protocol). No endpoint exposes raw tokens
- **Read-only sidecar:** The credential-proxy container runs with a read-only root filesystem. Agent cannot modify or replace the proxy even if it could somehow access the sidecar's filesystem

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

---

## Agent Image Versioning

The agent image (built from `Dockerfile.agent`) is a standard OCI container image managed through standard CI/CD:

1. **Immutable tags** — each build produces a tagged image (e.g., `agent:v3`, `agent:sha-abc123`). Old tags are never overwritten — new pods reference a specific tag
2. **Standard container registry** — images pushed to the cluster's container registry (any OCI-compliant registry). No custom template systems
3. **Per-tenant image override** — `TENANT_REPO_CONFIG.agent_image_tag` can specify a custom image tag. Default: latest stable tag. Enables canary rollout — update one tenant's image tag, validate, then promote to all tenants
4. **Rollback** — if a new image breaks agent sessions, revert `TENANT_REPO_CONFIG.agent_image_tag` to the previous tag. Old images remain available in the registry
5. **In-flight safety** — running pods use the image they were created with. Image tag updates only affect new pods. No disruption to in-progress sessions
6. **Image CI pipeline** — `Dockerfile.agent` changes trigger: build image → push to registry → deploy to staging tenant → run smoke test (agent clones a test repo, runs `npm ci`, `tsc`, `jest`) → promote to production tenants

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
