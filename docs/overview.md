# AI SDLC Orchestrator — Overview

> **Version 2.0** · March 2026
> **Author:** Nikita Mejenkov
> **License:** TBD

---

## Executive Summary

A **platform-agnostic SaaS** that automates the cycle from task ticket to reviewed merge request using AI coding agents. Available as a **hosted SaaS** (managed by us) or **self-hosted** (deployed on the customer's own Kubernetes cluster). Multi-tenant architecture with per-tenant configuration, cost tracking, and full isolation in both modes. The core principle is **agent-first**: the orchestrator is a lightweight Temporal-based core that receives webhooks and invokes AI agents — the agent does everything else via MCP servers.

> **Design Goal:** The orchestrator handles what an agent cannot: receiving inbound webhooks, durable workflow orchestration, credential injection, cost tracking, DSL-driven workflow compilation, gate management, and multi-repo coordination. All interaction with external platforms (task trackers, VCS, CI) is delegated to the agent via platform MCP servers.

### What It Does

- **Ingests tasks** from any tracker via thin webhook handlers
- **Invokes AI agents** that autonomously: gather context, create branches, implement code, create MRs, publish artifacts — all via MCP
- **Monitors CI/CD** via webhook signals and feeds failures back to the agent for self-correction
- **Enforces human checkpoints** at configurable gates
- **Tracks costs** per task, per tenant, with configurable caps
- **Provides workflow visibility** via Temporal UI (v1) and a custom SaaS dashboard (v2+)

### What It Does NOT Do

| Category | What we are NOT | Why it matters |
|---|---|---|
| CI/CD | Not a CI/CD platform (Jenkins, GitHub Actions) | We **trigger and monitor** pipelines — never run them |
| Agent framework | Not an AI agent framework (LangChain, CrewAI) | We **invoke** agents — you bring your own or use our defaults |
| Code hosting | Not a code hosting platform (GitHub, GitLab) | Code stays in your VCS — we pass references, never store source |
| Copilot / chatbot | Not a chatbot or IDE copilot (Copilot, Cursor) | We run **autonomous, headless** agents on full tasks — no chat loop |
| General agent orchestrator | Not a general-purpose agent orchestrator (Paperclip, Prefect) | We solve one problem end-to-end: **task ticket → merge request** |
| Deployment | Not a deployment tool (ArgoCD, Spinnaker) | We stop at the merge stage (by default) |

---

## Why It Exists — Problems We Solve

| Pain point | Without us | With AI SDLC Orchestrator |
|---|---|---|
| Agent runs with full credentials | Agent has repo token, CI token, tracker token — any prompt-injection or leak exposes everything | **Zero-credential sandbox** — agent runs in a Firecracker microVM with no secrets; credential proxy injects credentials transparently |
| CI fails, agent gives up | Single-shot agent creates MR, CI fails, human has to take over | **Automated fix loops** — orchestrator feeds CI failures back to the agent, which retries within configurable limits |
| Runaway AI costs | No per-task budget; one hallucination loop can burn through hundreds of dollars | **Per-task budget reservation** — cost cap enforced before the agent starts; real-time tracking shuts it down if exceeded |
| Agent can't access task tracker / VCS / CI | Each agent needs custom integrations for every platform | **MCP servers** — plug-and-play platform adapters; agent talks to Jira, GitLab, GitHub, etc. through a standard protocol |
| Adding a new platform takes weeks | Custom webhook parsing, API clients, auth flows per platform | **~50-line webhook handler** + an MCP server config — no platform SDK dependencies in the orchestrator |
| No audit trail for AI-generated code | Agent makes changes with no record of what tools it called or why | **Full tool-call tracing** — every MCP call, every LLM interaction logged with trace IDs, per tenant, queryable |

---

## How It Works

A simplified end-to-end flow for a single task:

1. **Label a task** — a team member adds a label (e.g. `ai-task`) to a ticket in the task tracker (Jira, Linear, GitHub Issues, etc.)
2. **Webhook fires** — the task tracker sends a webhook to the orchestrator, which validates it and starts a durable Temporal workflow
3. **Agent spins up in a sandbox** — the orchestrator launches an AI agent inside an isolated Firecracker microVM, injects MCP server configs, and the agent reads the task context
4. **Agent codes and publishes artifacts** — the agent gathers context, creates a branch, implements the changes, and publishes deliverables (merge requests, design updates, test reports — whatever the task requires) — all via MCP servers, never touching credentials directly
5. **CI loop + review loop** — CI results flow back via webhooks; if CI fails, the agent retries the fix automatically. A human reviewer approves or requests changes, and the agent can respond to review feedback

> For the full state machine, DSL, and multi-repo coordination details see [Workflow Engine](specs/workflow-engine.md).

---

## Getting Started

> **Status: Coming Soon** — the orchestrator is in active development. The paths below describe the intended onboarding experience.

### SaaS (hosted)

1. **Sign up** at the dashboard (URL TBD)
2. **Connect** your VCS provider (GitHub / GitLab) and task tracker (Jira / Linear / GitHub Issues)
3. **Configure** default agent, MCP servers, cost caps, and review gates
4. **Label a task** and watch the first MR appear

### Self-hosted

1. **Install** via Helm: `helm install ai-sdlc-orchestrator oci://registry/ai-sdlc-orchestrator`
2. **Configure** `values.yaml` — Postgres connection, Temporal (self-hosted or Cloud), sandbox backend (E2B Cloud or self-hosted), VCS/tracker credentials
3. **Register a webhook** on your task tracker pointing at the orchestrator's ingress
4. **Label a task** and watch the first MR appear

> For full deployment topology and configuration see [Deployment](specs/deployment.md).

---

## Cost Model

| Component | SaaS (hosted) | Self-hosted |
|---|---|---|
| **Platform fee** | Pricing TBD | No license fee (TBD — may change) |
| **AI API costs** | Pass-through at cost — you bring your own API key or use ours with markup | Your own API keys, billed directly by provider |
| **Sandbox compute** | Per-minute billing for Firecracker microVM runtime | Your infrastructure costs (E2B self-hosted or K8s Agent Sandbox) |
| **Artifact storage** | Included (S3-backed) | Your object storage (S3 / GCS / MinIO) — sandbox-local files uploaded before sandbox cleanup |
| **Infrastructure** | Managed by us | K8s cluster + PostgreSQL + Temporal + sandbox backend + object storage |

The orchestrator tracks costs at every level: per-task, per-tenant, per-session. Budget reservations, real-time alerts, and configurable caps prevent runaway spending. See [Deployment — Budget & Cost Tracking](specs/deployment.md) for details.

---

## Design Principles

| Principle | Description | Implication |
|---|---|---|
| **Agent-First** | Agent does all platform interaction via MCP — orchestrator never calls external APIs | Zero *platform* SDK dependencies (no jira.js, gitbeaker, octokit). One integration path per platform |
| **Orchestrator = Lightweight Core** | Orchestrator handles: webhooks, Temporal workflows, credential injection, cost tracking, DSL compilation, gate management, multi-repo coordination. Everything else delegated to agent | Focused codebase with clear boundaries. No platform SDK deps. Adding platform support = webhook handler + MCP server config |
| **Plug-and-Play MCP** | Agent's MCP servers fully configured per tenant — orchestrator passes them through, no hardcoded servers | Zero wrapper code, any MCP server pluggable, tenant controls agent's tool set |
| **Temporal-Native** | Workflows are Temporal Workflows from day one | Full execution history, replay, retry, and visibility out of the box |
| **Webhook-First** | Event-driven by default with durable ingestion (write-first-process-second), polling fallback via Temporal Schedule, and periodic reconciliation | Real-time reactivity, minimal latency, no lost events even during outages |
| **Human-in-the-Loop** | Configurable gates where automation pauses | Safety without sacrificing speed |
| **DSL-Driven Workflows** | Workflows defined in typed YAML DSL compiled to Temporal | Visual editor-ready; DSL is the stable contract above the execution engine |
| **Cost-Aware** | Track and cap agent token/cost per task | No runaway API bills |
| **Audit Everything** | Every action and cost logged with trace ID | Full accountability and debugging |
| **Sandbox-First Isolation** | Every agent session runs in a dedicated [E2B](https://e2b.dev) sandbox (Firecracker microVM) — E2B Cloud or self-hosted | Real VM boundary per session — same isolation as AWS Lambda. No Bash allowlists, no command filtering theater |
| **Secure by Default** | Zero-credential sandbox, credential proxy service, MCP server allowlisting | Sandbox has no secrets mounted, no token env vars — credential proxy service injects credentials transparently via authenticated HTTPS. Curated MCP server registry ensures only verified servers are used by default |
| **Monorepo-First** | Backend, frontend, shared libs in one Nx workspace | Atomic changes, shared types, single CI |

---

## Specification Documents

| Document | Contents |
|---|---|
| [Architecture](specs/architecture.md) | System architecture diagram, three-layer model, supported platforms, project structure, monorepo layout |
| [Integration](specs/integration.md) | Agent-first integration model, agent communication, MCP servers, prompt & context strategy |
| [Workflow Engine](specs/workflow-engine.md) | Event system, workflow DSL, state machine, multi-repo coordination |
| [Data Model](specs/data-model.md) | ER diagram, all entities, workflow mirror reconciliation |
| [Sandbox & Security](specs/sandbox-and-security.md) | E2B sandboxes (Firecracker microVM, cloud or self-hosted), credential proxy service, security layers, tenant isolation, sandbox research & alternatives comparison |
| [Tech Stack](specs/tech-stack.md) | Technology choices, testing strategy, dev & agent tooling |
| [Deployment](specs/deployment.md) | Deployment topology, configuration, retry strategy, monitoring, DR, healthchecks, auth |
| [Roadmap](specs/roadmap.md) | Implementation phases, resolved & open questions |
| [Competitive Landscape](comparison.md) | Comparison with Devin, Factory, Paperclip, Sweep/CodeRabbit |
