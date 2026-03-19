# Data Model

> Part of [AI SDLC Orchestrator](../overview.md) specification

---

## Storage Systems

Two distinct storage systems:

**Temporal DB** — managed by Temporal Server, stores all Workflow execution history, activity results, signal queues, timers. Never written to directly by application code.

**App DB (PostgreSQL via MikroORM)** — tenants, MCP server configs, DSL definitions, cost aggregates, and a `workflow_mirror` table updated by a `updateWorkflowMirror` Activity at each state transition.

---

## Entity Relationship Diagram

```mermaid
erDiagram
    TENANT {
        uuid id PK
        varchar name
        varchar slug UK
        varchar temporal_namespace
        int max_concurrent_workflows
        numeric monthly_cost_limit_usd
        numeric monthly_cost_reserved_usd
        numeric monthly_cost_actual_usd
        jsonb meta
        timestamptz created_at
        timestamptz updated_at
    }

    TENANT_MCP_SERVER {
        uuid id PK
        uuid tenant_id FK
        varchar name
        %% UNIQUE(tenant_id, name)
        varchar transport
        varchar url
        varchar command
        jsonb args
        jsonb headers_secret_ref
        jsonb env_secret_ref
        boolean is_enabled
        timestamptz created_at
    }

    TENANT_VCS_CREDENTIAL {
        uuid id PK
        uuid tenant_id FK
        varchar provider
        varchar host
        varchar secret_ref
        timestamptz created_at
    }

    TENANT_REPO_CONFIG {
        uuid id PK
        uuid tenant_id FK
        varchar repo_id
        %% UNIQUE(tenant_id, repo_id)
        varchar repo_url
        varchar branch_prefix
        varchar setup_command
        varchar test_command
        varchar lint_command
        varchar typecheck_command
        varchar build_command
        varchar agent_template_id
        int max_concurrent_workflows
        timestamptz created_at
    }

    WEBHOOK_DELIVERY {
        uuid id PK
        uuid tenant_id FK
        varchar platform
        varchar delivery_id
        %% UNIQUE(platform, delivery_id)
        varchar event_type
        varchar payload_hash
        varchar status
        uuid workflow_id FK
        text error_message
        timestamptz created_at
    }

    WORKFLOW_MIRROR {
        uuid id PK
        uuid tenant_id FK
        varchar temporal_workflow_id UK
        varchar temporal_run_id
        uuid parent_workflow_id FK
        varchar task_id
        varchar task_provider
        varchar repo_id
        varchar repo_url
        varchar branch_name
        varchar mr_id
        varchar mr_url
        varchar state
        varchar current_step_id
        varchar dsl_name
        int dsl_version
        int fix_attempt_count
        int review_attempt_count
        numeric cost_usd_total
        numeric cost_usd_reserved
        jsonb children_status
        text error_message
        timestamptz created_at
        timestamptz updated_at
    }

    WORKFLOW_EVENT {
        uuid id PK
        uuid workflow_id FK
        varchar event_type
        varchar from_state
        varchar to_state
        jsonb payload
        numeric cost_usd
        timestamptz created_at
    }

    AGENT_SESSION {
        uuid id PK
        uuid workflow_id FK
        varchar mode
        varchar step_id
        int loop_iteration
        text prompt_sent
        text agent_summary
        jsonb result
        varchar status
        varchar error_code
        int input_tokens
        int output_tokens
        numeric cost_usd
        varchar model
        int turn_count
        int tool_call_count
        timestamptz started_at
        timestamptz completed_at
    }

    AGENT_TOOL_CALL {
        uuid id PK
        uuid session_id FK
        int sequence_number
        varchar tool_name
        jsonb input_summary
        jsonb output_summary
        varchar status
        int duration_ms
        timestamptz created_at
    }

    WORKFLOW_DSL {
        uuid id PK
        uuid tenant_id FK
        varchar name
        int version
        %% UNIQUE(tenant_id, name, version)
        jsonb definition
        boolean is_active
        timestamptz created_at
    }

    TENANT_API_KEY {
        uuid id PK
        uuid tenant_id FK
        varchar key_hash
        varchar name
        varchar role
        timestamptz expires_at
        timestamptz created_at
    }

    TENANT_USER {
        uuid id PK
        uuid tenant_id FK
        varchar external_id
        varchar provider
        varchar email
        varchar role
        timestamptz created_at
    }

    TENANT ||--o{ TENANT_MCP_SERVER : "has many"
    TENANT ||--o{ TENANT_VCS_CREDENTIAL : "has many"
    TENANT ||--o{ TENANT_REPO_CONFIG : "has many"
    TENANT ||--o{ WEBHOOK_DELIVERY : "receives"
    TENANT ||--o{ WORKFLOW_MIRROR : "has many"
    TENANT ||--o{ WORKFLOW_DSL : "owns"
    TENANT ||--o{ TENANT_API_KEY : "has many"
    TENANT ||--o{ TENANT_USER : "has many"
    WORKFLOW_MIRROR ||--o{ WORKFLOW_MIRROR : "parent/children"
    WORKFLOW_MIRROR ||--o{ WORKFLOW_EVENT : "has many"
    WORKFLOW_MIRROR ||--o{ AGENT_SESSION : "has many"
    AGENT_SESSION ||--o{ AGENT_TOOL_CALL : "has many"
```

---

## Key Design Decisions

- **`TENANT` normalized** — MCP servers, VCS credentials, and repo configs extracted into dedicated tables. `meta` JSONB retained for truly unstructured data only. Enables querying ("all tenants using GitLab MCP"), per-record CRUD, and change tracking
- **`WEBHOOK_DELIVERY` added** — every incoming webhook persisted for debugging ("why didn't my task trigger?"), audit, and replay. 30-day retention
- **`AGENT_TOOL_CALL` added** — logs every MCP/built-in tool call the agent made. Essential for debugging "why did the agent do X?" without storing the full (massive) conversation history. `input_summary` / `output_summary` are truncated to prevent bloat
- **`AGENT_SESSION.enriched_context_snapshot` removed** — contradicted the agent-first principle (no orchestrator-side context enrichment). Replaced with `agent_summary` (agent-generated summary of what it did) and `mode` (implement / ci_fix / review_fix)
- **`WORKFLOW_MIRROR.dsl_name` + `dsl_version` added** — required for DSL version pinning (replay safety)
- **`WORKFLOW_MIRROR.cost_usd_reserved` added** — supports the budget reservation model (see [Deployment — Rate Limiting](deployment.md))
- **`TENANT.monthly_cost_reserved_usd` + `monthly_cost_actual_usd` added** — split tracking for reserved vs actual spend
- **`TENANT_REPO_CONFIG.agent_template_id`** — references the E2B sandbox template ID for the agent. Enables per-tenant template pinning and canary rollout (see [Sandbox & Security — E2B Template Versioning](sandbox-and-security.md))
- **`TENANT_API_KEY` and `TENANT_USER` added** — supports OIDC authentication, API key management, and RBAC (`admin` / `operator` / `viewer`). API keys stored hashed with bcrypt
- **`AGENT_SESSION.step_id` + `loop_iteration` added** — links each agent session to the DSL step (`implement`, `ci_fix`, `review_fix`) and tracks which iteration of a fix loop the session belongs to
- **`AGENT_SESSION.error_code` added** — structured error classification (`cancelled`, `cost_limit`, `turn_limit`, `infra_error`, `agent_error`) for retry strategy and analytics

---

## Workflow Mirror Reconciliation

`workflow_mirror` is a read model updated by the `updateWorkflowMirror` Activity after each state transition. Since it's eventually consistent, the following safeguards apply:

- **Retry policy** — The `updateWorkflowMirror` Activity has aggressive retries (`maximumAttempts: 10`, `initialInterval: 1s`). It's a simple DB upsert, so failures are rare and transient.
- **Periodic reconciliation** — A scheduled job (every 15 min) queries Temporal for open Workflow executions (via Elasticsearch visibility store for efficient queries) and compares against `workflow_mirror`. Stale or missing mirrors are updated by fetching the latest Workflow state via `describeWorkflowExecution`.
- **Staleness indicator** — `workflow_mirror.updated_at` is compared against current time in the dashboard. Mirrors older than 5 minutes for active workflows display a "possibly stale" badge.
- **Cost reservation reconciliation** — Same scheduled job checks for `cost_usd_reserved > 0` on completed/blocked workflows (orphaned reservations from crashed Activities) and releases them back to the tenant's monthly budget.
