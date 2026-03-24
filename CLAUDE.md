# AI SDLC Orchestrator

Platform-agnostic SaaS that automates: **task ticket → reviewed merge request** using AI coding agents.

## Architecture

- **Monorepo**: Nx 22 + pnpm
- **Backend**: NestJS 11 + Fastify, TypeScript 5.9 strict
- **Workflow Engine**: Temporal (TypeScript SDK)
- **Database**: PostgreSQL 18 + PgBouncer + Row-Level Security
- **ORM**: MikroORM (Unit of Work pattern)
- **AI Agent**: Anthropic Claude via `@anthropic-ai/sdk`
- **Sandbox**: E2B (Firecracker microVMs)
- **Error Handling**: `neverthrow` (`Result<T,E>` / `ResultAsync<T,E>`)
- **Frontend**: React 19 + Vite 8 + TanStack Query + Tailwind CSS 4

## Project Structure

```
apps/
  orchestrator-api/     # HTTP API (NestJS + Fastify)
  orchestrator-worker/  # Temporal Worker
  dashboard/            # SaaS frontend (React + Vite)
libs/
  common/               # Config, logger, temporal, database, bootstrap, result
  db/                   # MikroORM entities
  shared-type/          # Shared TypeScript types
  workflow-dsl/         # DSL Zod schema + YAML→Temporal compiler
  feature/
    workflow/           # Temporal workflows + activities
    agent/
      registry/         # AgentProviderRegistry + ports
      claude-code/      # ClaudeAgentAdapter
      sandbox/          # E2bSandboxAdapter
      credential-proxy/ # Credential proxy client
      shared/prompt/    # PromptFormatter
    webhook/            # Jira, GitLab, GitHub, Linear handlers
    gate/               # Gate approval API
    tenant/             # Tenant CRUD + RBAC + API keys
docker/                 # Dockerfiles + configs
.helm/                  # Kubernetes Helm charts
```

## Key Conventions

1. All service methods return `Result<T, AppError>` from neverthrow
2. All entities use UUID primary keys
3. Budget reservation uses optimistic concurrency via `budgetVersion`
4. Webhook handlers follow write-first-process-second pattern
5. All agent interaction goes through `AiAgentPort` interface
6. Sandbox interaction goes through `SandboxPort` interface
7. Credential proxy ensures zero credentials in sandbox
8. DSL workflows are Zod-validated YAML compiled to Temporal

## Commands

```bash
pnpm docker:up          # Start dev infrastructure
pnpm dev:api            # Start API server
pnpm dev:worker         # Start Temporal worker
pnpm dev:dashboard      # Start dashboard
pnpm test               # Run all tests
pnpm lint               # Lint all projects
pnpm typecheck          # Type check all projects
pnpm db:migrate         # Run database migrations
pnpm db:migrate:create  # Create new migration
```

## Workflow Flow

1. Label task with `ai-sdlc` → webhook fires
2. Webhook handler writes delivery record + starts Temporal workflow
3. Workflow: reserve budget → create sandbox → invoke agent → verify output → gate → collect artifacts → destroy sandbox
4. Agent codes in sandboxed environment via MCP
5. CI signals loop (auto-fix failures)
6. Human gate approval
7. Merge request created
