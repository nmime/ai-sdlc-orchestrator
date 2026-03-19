# AI SDLC Orchestrator — Overview

> **Version 2.0** · March 2026
> **Author:** Nikita Mejenkov

---

## Executive Summary

A **platform-agnostic SaaS** that automates the cycle from task ticket to reviewed merge request using AI coding agents. Available as a **hosted SaaS** (managed by us) or **self-hosted** (deployed on the customer's own Kubernetes cluster). Multi-tenant architecture with per-tenant configuration, cost tracking, and full isolation in both modes. The core principle is **agent-first**: the orchestrator is a lightweight Temporal-based core that receives webhooks and invokes AI agents — the agent does everything else via MCP servers.

> **Design Goal:** The orchestrator handles what an agent cannot: receiving inbound webhooks, durable workflow orchestration, credential injection, cost tracking, DSL-driven workflow compilation, gate management, and multi-repo coordination. All interaction with external platforms (task trackers, VCS, CI) is delegated to the agent via platform MCP servers.

### What It Does

- **Ingests tasks** from any tracker via thin webhook handlers
- **Invokes AI agents** that autonomously: gather context, create branches, implement code, create MRs, push — all via MCP
- **Monitors CI/CD** via webhook signals and feeds failures back to the agent for self-correction
- **Enforces human checkpoints** at configurable gates
- **Tracks costs** per task, per tenant, with configurable caps
- **Provides workflow visibility** via Temporal UI (v1) and a custom SaaS dashboard (v2+)

### What It Does NOT Do

- Store source code — code lives in VCS, orchestrator passes references
- Run CI/CD pipelines — triggers and monitors, execution is delegated
- Make deployment decisions — stops at the merge stage (by default)

---

## Design Principles

| Principle | Description | Implication |
|---|---|---|
| **Agent-First** | Agent does all platform interaction via MCP — orchestrator never calls external APIs | Zero *platform* SDK dependencies (no jira.js, gitbeaker, octokit). One integration path per platform |
| **Orchestrator = Lightweight Core** | Orchestrator handles: webhooks, Temporal workflows, credential injection, cost tracking, DSL compilation, gate management, multi-repo coordination. Everything else delegated to agent | Focused codebase with clear boundaries. No platform SDK deps. Adding platform support = webhook handler + MCP server config |
| **Plug-and-Play MCP** | Agent's MCP servers fully configured per tenant — orchestrator passes them through, no hardcoded servers | Zero wrapper code, any MCP server pluggable, tenant controls agent's tool set |
| **Temporal-Native** | Workflows are Temporal Workflows from day one | Full execution history, replay, retry, and visibility out of the box |
| **Webhook-First** | Event-driven by default, polling as fallback | Real-time reactivity, minimal latency |
| **Human-in-the-Loop** | Configurable gates where automation pauses | Safety without sacrificing speed |
| **DSL-Driven Workflows** | Workflows defined in typed YAML DSL compiled to Temporal | Visual editor-ready; DSL is the stable contract above the execution engine |
| **Cost-Aware** | Track and cap agent token/cost per task | No runaway API bills |
| **Audit Everything** | Every action and cost logged with trace ID | Full accountability and debugging |
| **Sandbox-First Isolation** | Every agent session runs in a Kata Containers microVM pod (hardware-level KVM isolation) | Real KVM boundary (pod-to-host); container-level isolation (agent-to-sidecar within pod). No Bash allowlists, no command filtering theater |
| **Secure by Default** | Zero-credential agent, credential proxy sidecar | Agent container has no secrets mounted, no token env vars — credential-proxy sidecar injects credentials transparently |
| **Monorepo-First** | Backend, frontend, shared libs in one Nx workspace | Atomic changes, shared types, single CI |

---

## Specification Documents

| Document | Contents |
|---|---|
| [Architecture](specs/architecture.md) | System architecture diagram, three-layer model, supported platforms, project structure, monorepo layout |
| [Integration](specs/integration.md) | Agent-first integration model, agent communication, MCP servers, prompt & context strategy |
| [Workflow Engine](specs/workflow-engine.md) | Event system, workflow DSL, state machine, multi-repo coordination |
| [Data Model](specs/data-model.md) | ER diagram, all entities, workflow mirror reconciliation |
| [Sandbox & Security](specs/sandbox-and-security.md) | Kata Containers microVM pods, credential proxy sidecar, security layers, tenant isolation |
| [Tech Stack](specs/tech-stack.md) | Technology choices, testing strategy, dev & agent tooling |
| [Deployment](specs/deployment.md) | Deployment topology, configuration, retry strategy, monitoring, DR, healthchecks, auth |
| [Roadmap](specs/roadmap.md) | Implementation phases, resolved & open questions |
