# Provider-Agnostic Architecture Refactor

## Summary

Refactored the Opwerf to be fully **provider-agnostic**. The core codebase no longer contains hardcoded references to specific AI providers (claude, openhands, aider). All provider selection is config-driven via environment variables and the `AiAgentPort` interface.

## Changes

### Type System (`libs/shared-type/src/agent.types.ts`)
- **Removed** `AGENT_PROVIDER` const with hardcoded `{ CLAUDE, OPENHANDS, AIDER }` values
- `AgentProvider` is now `type AgentProvider = string` — any provider name is valid

### Database Entity (`libs/db/src/entities/tenant-repo-config.entity.ts`)
- **Removed** `AgentProvider` enum with `claude_code | openhands | aider` values
- `agentProvider` column is now a free-form `string` — no enum constraint
- Removed `AgentProvider` from `libs/db/src/index.ts` exports

### Agent Provider Registry (`libs/feature/agent/registry/src/agent-provider-registry.ts`)
- Constructor now takes `ConfigService` — reads `DEFAULT_AGENT_PROVIDER` (default: `'auto'`) and `DEFAULT_AGENT_MODEL` (optional) from env
- **New `auto` resolution**: When provider is `'auto'`, registry picks the first registered adapter
- `get()` method handles `'auto'` transparently
- `resolveProvider()` returns `provider.name` as the resolved name (not the input string)
- Removed `_providerName` unused parameter in `resolveModel()`

### Worker Bootstrap (`apps/orchestrator-worker/src/main.ts`)
- **Removed** static `import { ClaudeAgentAdapter }` and direct instantiation
- **Added** `loadAdapters()` function with config-driven dynamic imports:
  - `ANTHROPIC_API_KEY` set → loads `ClaudeAgentAdapter`
  - Future providers: add similar `if` blocks with their API key checks
- Logs which adapters were loaded; warns if none configured

### Prompt Formatter (`libs/feature/agent/shared/prompt/src/prompt-formatter.ts`)
- **Replaced** `switch(provider)` dispatch with strategy pattern
- `registerStrategy({ name, format })` — register provider-specific formatting
- Falls back to `formatDefault()` when no strategy is registered
- `listStrategies()` method for introspection

### Credential Proxy (`apps/credential-proxy/src/credential-proxy.service.ts`)
- **Rewrote** `getAiCredential` as generic `proxyAiRequest(provider, path, body, headers)`
- Provider configs loaded from `AI_PROVIDER_CONFIGS` env (JSON) + `registerProvider()` API
- Default configs for `anthropic` and `openai` as sensible defaults
- API keys resolved by convention: `{PROVIDER}_API_KEY` env var
- Base URLs overridable: `AI_BASE_URL_{PROVIDER}` env var

### App Config (`libs/common/src/config/app-config.module.ts`)
- `DEFAULT_AGENT_PROVIDER` default changed from `'claude_code'` to `'auto'`
- `DEFAULT_AGENT_MODEL` made optional (no default — adapter decides)
- Added `OPENAI_API_KEY`, `AI_PROVIDER_CONFIGS` to schema

### Workflow DSL (`libs/workflow-dsl/`)
- `schema.ts`: `agentProvider` is `z.string().optional()` (no default — resolved at runtime)
- `compiler.ts`: `agentProvider` fallback changed from `'claude'` to `'auto'`

### Tenant Service (`libs/feature/tenant/src/tenant-repo-config.service.ts`)
- Removed `AgentProvider` enum import; uses plain `string` type

## Test Suite

**55 test files, 603 tests, all passing.**

### New Test Files
| File | Tests | Category |
|------|-------|----------|
| `apps/orchestrator-api/src/__tests__/e2e-integration.spec.ts` | E2E | API integration (health, tenants, DSL validate) |
| `apps/orchestrator-api/src/__tests__/controller-logic.spec.ts` | Unit | Controller business logic |
| `apps/credential-proxy/src/__tests__/session-limits.spec.ts` | Unit | Session limit enforcement |
| `apps/credential-proxy/src/__tests__/credential-proxy-validation.spec.ts` | Unit | Input validation |
| `libs/workflow-dsl/src/__tests__/dsl-real.spec.ts` | Unit | Real-world DSL compilation |
| `libs/feature/webhook/src/__tests__/handlers-ci-review.spec.ts` | Unit | CI/review webhook handlers |
| `libs/feature/workflow/src/activities/__tests__/security-and-quality.spec.ts` | Unit | Security & quality gates |
| `libs/feature/tenant/src/__tests__/tenant-crud.spec.ts` | Unit | Tenant CRUD operations |

### Modified Test Files
| File | Change |
|------|--------|
| `libs/db/src/__tests__/entities.spec.ts` | Removed `AgentProvider` enum test, uses string |
| `libs/feature/agent/registry/src/__tests__/agent-registry.spec.ts` | Passes mock ConfigService; tests auto resolution |
| `libs/feature/agent/shared/prompt/src/__tests__/prompt-formatter.spec.ts` | Tests strategy pattern registration |
| `libs/workflow-dsl/src/__tests__/dsl.spec.ts` | Changed `'claude'` → `'auto'` default assertion |

## How to Add a New Provider

See README.md "Adding a New Agent Provider" section.

## Verification

```bash
# All tests pass
npx vitest run --config vitest.config.ts   # 55 files, 603 tests

# All projects typecheck
npx nx run-many --target=typecheck --all   # 18/18 pass

# No hardcoded providers in core code
grep -rn 'claude_code\|openhands\|aider' --include='*.ts' \
  --exclude-dir=node_modules --exclude-dir=dist \
  | grep -v claude-code/src/ | grep -v __tests__ | grep -v Migration
# Only result: worker log message "Loaded agent adapter: claude_code"
```
