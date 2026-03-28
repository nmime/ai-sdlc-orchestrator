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
| AI Agent | Provider-agnostic via AiAgentPort + MCP |
| Error Handling | neverthrow Result\<T, E\> |
| Cache | Redis 7 (optional) |
| Object Storage | MinIO (S3-compatible) |

## Provider-Agnostic Architecture

The system uses a **port/adapter pattern** for all AI agent and sandbox interactions. No hardcoded provider references exist in the core codebase.

### Agent System

```
┌─────────────────────────────────────────┐
│           AgentProviderRegistry          │
│  ┌───────────┐  ┌───────────┐  ┌─────┐ │
│  │ claude_code│  │  future   │  │ ... │ │
│  │  adapter   │  │  adapter  │  │     │ │
│  └─────┬─────┘  └─────┬─────┘  └──┬──┘ │
│        └───────────┬───┘───────────┘    │
│              AiAgentPort                 │
│         (invoke / cancel)               │
└─────────────────────────────────────────┘
```

- **`AiAgentPort`** — Interface with `name`, `invoke()`, `cancel()`. Any provider implements this.
- **`AgentProviderRegistry`** — Cascaded resolution: repo config → tenant default → system default (`auto`).
- **`auto` resolution** — When provider is `auto`, the registry picks the first registered adapter.
- **Dynamic loading** — Worker loads adapters based on configured API keys (e.g., `ANTHROPIC_API_KEY` → claude_code adapter).
- **`PromptFormatter`** — Strategy pattern. Register formatting strategies per provider via `registerStrategy()`.

### Credential Proxy

- Provider-agnostic AI API proxying via configurable `AiProviderConfig` entries.
- Default configs for `anthropic` and `openai`; extend via `AI_PROVIDER_CONFIGS` env (JSON) or `registerProvider()`.
- API key resolution: `{PROVIDER}_API_KEY` env var pattern.

### MCP Integration

- Agents receive `McpServerConfig[]` with transport, URL, headers, and env configuration.
- MCP servers are configured per-tenant and passed through the workflow pipeline.

## Quick Start

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm test
pnpm typecheck
pnpm dev:api
pnpm dev:worker
```

## Project Structure

```
apps/
  orchestrator-api/       # HTTP API
  orchestrator-worker/    # Temporal Worker (dynamic adapter loading)
  credential-proxy/       # Provider-agnostic credential proxy
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
      registry/           # AiAgentPort + SandboxPort + AgentProviderRegistry
      claude-code/        # ClaudeAgentAdapter (implements AiAgentPort)
      sandbox/            # E2bSandboxAdapter (implements SandboxPort)
      credential-proxy/   # Credential proxy client
      shared/
        prompt/           # PromptFormatter (strategy pattern)
        mcp-policy/       # MCP policy enforcement
        security/         # Prompt sanitization
```

## Adding a New Agent Provider

1. Create a new lib under `libs/feature/agent/` implementing `AiAgentPort`:
   ```typescript
   @Injectable()
   export class MyAdapter implements AiAgentPort {
     readonly name = 'my_provider';
     async invoke(input: AgentInvokeInput) { /* ... */ }
     async cancel(sessionId: string) { /* ... */ }
   }
   ```

2. Add dynamic loading in `apps/orchestrator-worker/src/main.ts`:
   ```typescript
   if (configService.get('MY_PROVIDER_API_KEY', { infer: true })) {
     const { MyAdapter } = await import('@app/feature-agent-my-provider');
     adapters.push(new MyAdapter(configService, pinoLogger));
   }
   ```

3. Optionally register a prompt strategy:
   ```typescript
   promptFormatter.registerStrategy({ name: 'my_provider', format: (data) => '...' });
   ```

4. Add credential proxy config if needed:
   ```bash
   AI_PROVIDER_CONFIGS='{ "my_provider": { "baseUrl": "https://api.example.com", "authType": "bearer" } }'
   MY_PROVIDER_API_KEY=sk-xxx
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
| `/tenants/:id/dsl/validate` | POST | Validate workflow DSL YAML |
| `/tenants/:id/repos` | CRUD | Tenant repo configuration |
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

Workflows are defined in typed YAML. Step types: `auto`, `signal_wait`, `gate`, `loop`, `terminal`, `recovery`, `parallel`, `conditional`.

```yaml
name: default
version: 1
defaults:
  agentProvider: auto      # or specific provider name
  sandboxProvider: e2b
  maxRetries: 3
  maxCostPerTaskUsd: 50
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

## Testing

```bash
pnpm test                    # Run all 603 tests across 55 files
pnpm typecheck               # Typecheck all 18 projects
npx vitest run --config vitest.config.ts   # Direct vitest invocation
```

Test categories:
- Unit tests for all core modules (DSL, webhook handlers, controllers, services)
- Integration tests for credential proxy, tenant CRUD, agent registry
- E2E tests against running API (health, tenants, DSL validation)
- Security & quality gate validation tests

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_AGENT_PROVIDER` | `auto` | Default agent provider (or specific name) |
| `DEFAULT_AGENT_MODEL` | _(optional)_ | Default model (provider-specific) |
| `ANTHROPIC_API_KEY` | _(optional)_ | Enables claude_code adapter |
| `OPENAI_API_KEY` | _(optional)_ | OpenAI API key for future adapters |
| `AI_PROVIDER_CONFIGS` | _(optional)_ | JSON map of provider configs |
| `E2B_API_KEY` | _(optional)_ | E2B sandbox API key |
| `DATABASE_PASSWORD` | _(required)_ | PostgreSQL password |
| `CREDENTIAL_PROXY_INTERNAL_TOKEN` | _(required)_ | Internal auth token |
| `ENCRYPTION_KEY` | _(required)_ | Data encryption key |
| `ENCRYPTION_SALT` | _(required)_ | Encryption salt (16+ chars) |

See `libs/common/src/config/app-config.module.ts` for the full schema.

## License

MIT — see [LICENSE](./LICENSE) for details.
