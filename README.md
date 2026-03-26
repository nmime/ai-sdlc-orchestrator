# AI SDLC Orchestrator

An AI-powered Software Development Lifecycle orchestration platform that automates task implementation using AI agents in secure sandboxes.

## Architecture

- **orchestrator-api** — NestJS + Fastify HTTP API (webhook ingestion, REST API, Temporal client)
- **orchestrator-worker** — Temporal Worker (Workflows + Activities)
- **credential-proxy** — Standalone credential proxy service for sandbox sessions
- **dashboard** — React + Vite frontend (v2+)

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Nx 22 + pnpm |
| Runtime | Node.js 24 + TypeScript 5.9 (strict) |
| Framework | NestJS 11 + Fastify |
| Workflow | Temporal (self-hosted, TypeScript SDK) |
| Database | PostgreSQL 18 + MikroORM + PgBouncer |
| Sandbox | E2B (SaaS) / K8s Agent Sandbox + Kata (on-prem) |
| AI Agent | Claude via AiAgentPort abstraction |
| Error Handling | neverthrow Result\<T, E\> |
| Cache | Redis 7 (optional) |
| Object Storage | MinIO (S3-compatible) |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# Run all tests
pnpm test

# Typecheck
pnpm typecheck

# Start API (dev)
pnpm dev:api

# Start Worker (dev)
pnpm dev:worker
```

## Project Structure

```
apps/
  orchestrator-api/       # HTTP API
  orchestrator-worker/    # Temporal Worker
  credential-proxy/       # Credential proxy service
  dashboard/              # React frontend
libs/
  common/                 # Config, Logger, Temporal, Database, Result
  db/                     # MikroORM entities (17 tables)
  shared-type/            # Shared TypeScript types
  workflow-dsl/           # YAML DSL schema, compiler, validator
  feature/
    workflow/             # Temporal Workflows + Activities
    webhook/              # Platform webhook handlers
    gate/                 # Human approval gates
    tenant/               # Multi-tenant management
    agent/
      registry/           # AgentProviderRegistry
      claude-code/        # ClaudeAgentAdapter
      sandbox/            # E2bSandboxAdapter
      credential-proxy/   # Credential proxy client
      shared/prompt/      # PromptFormatter
```

## API Endpoints

All endpoints prefixed with `/api/v1/`.

| Endpoint | Method | Description |
|---|---|---|
| `/health/live` | GET | Liveness check |
| `/health/ready` | GET | Readiness check (DB + Temporal) |
| `/health/business` | GET | Deep business health check |
| `/webhooks/:platform/:tenantId` | POST | Webhook ingestion |
| `/tenants` | CRUD | Tenant management |
| `/workflows` | GET | List workflow mirrors |
| `/workflows/:id` | GET | Get workflow details |
| `/workflows/:id/events` | GET | Workflow events |
| `/workflows/:id/sessions` | GET | Agent sessions |
| `/workflows/:id/artifacts` | GET | Workflow artifacts |
| `/workflows/:id/retry` | POST | Retry blocked workflow |
| `/gates/:workflowId/decide` | POST | Submit gate decision |
| `/costs/summary/:tenantId` | GET | Cost summary |
| `/costs/alerts/:tenantId` | GET | Cost alerts |

## Workflow DSL

Workflows are defined in typed YAML:

```yaml
name: default
version: 1
steps:
  - id: implement
    type: auto
    action: invoke_agent
    mode: implement
    timeout_minutes: 60
    on_success: ci_watch
    on_failure: blocked
  - id: ci_watch
    type: signal_wait
    signal: pipelineSucceeded | pipelineFailed
    timeout_minutes: 120
    on_success: review_gate
    on_failure: ci_fix_loop
  - id: ci_fix_loop
    type: loop
    action: invoke_agent
    mode: ci_fix
    loop_strategy:
      max_iterations: 5
      no_progress_limit: 2
    on_success: ci_watch
    on_exhausted: blocked
  - id: review_gate
    type: gate
    signal: gateApproved | changesRequested
    on_approved: done
    on_changes_requested: review_fix_loop
  - id: done
    type: terminal
    action: close_workflow
  - id: blocked
    type: recovery
    action: cleanup_and_escalate
```

## Environment Variables

See `.env.example` for all configuration options.

## License

MIT — see [LICENSE](./LICENSE) for details.
