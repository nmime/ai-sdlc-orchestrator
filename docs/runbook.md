# Opwerf — Production Runbook

## Infrastructure

All infrastructure is managed by [ansible-k8s-full-setup](https://github.com/opwerf/ansible-k8s-full-setup).

### Prerequisites

- Hetzner Cloud account with API token
- `ansible-k8s-full-setup` cloned and configured
- Domain with DNS managed by Hetzner DNS (for cert-manager wildcard certs)

### Platform Deployment

```bash
git clone https://github.com/opwerf/ansible-k8s-full-setup.git
cd ansible-k8s-full-setup

# Configure
cp inventory.example inventory
# Edit inventory: set domain, email, tier (small/medium/production), HCLOUD_TOKEN

# Deploy full platform (K8s + all services)
./platform-orchestrator/platform.sh deploy
# Or selectively:
ansible-playbook playbooks/deploy_platform.yml --tags infra,network,cluster,secrets,storage,databases
```

The platform provides:
- **Kubernetes cluster** on Hetzner (Kubespray, Cilium CNI, Gateway API)
- **PostgreSQL** via Percona PG Operator (HA, pgbackrest backups)
- **MinIO** S3-compatible storage
- **Vault** + External Secrets Operator
- **ArgoCD** for GitOps deployments
- **VictoriaMetrics + Grafana + Loki** for observability
- **KEDA** for event-driven autoscaling
- **cert-manager** with Let's Encrypt wildcard certs

## Application Deployment

### Option 1: Helm (Direct)

```bash
# From this repo
helm upgrade --install opwerf .helm/ \
  --namespace opwerf \
  --create-namespace \
  --set postgresql.host=<percona-pg-pgbouncer>.databases.svc \
  --set postgresql.password=<from-vault> \
  --set redis.host=redis-master.databases.svc \
  --set minio.endpoint=minio.storage.svc:9000 \
  --set temporal.address=temporal.temporal.svc:7233 \
  --set e2b.apiKey=<e2b-key> \
  --set anthropic.apiKey=<anthropic-key> \
  --values .helm/values-production.yaml \
  --wait --timeout 5m
```

### Option 2: ArgoCD (GitOps)

Create an ArgoCD Application pointing to this repo's `.helm/` directory:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: opwerf-orchestrator
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/opwerf/opwerf-orchestrator.git
    targetRevision: main
    path: .helm
    helm:
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: opwerf
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Option 3: Docker Compose (Single Node)

```bash
cp .env.example .env
# Fill in .env values
docker compose up -d
```

## Database Migrations

```bash
# Generate a new migration after entity changes
pnpm mikro-orm migration:create

# Run pending migrations
pnpm mikro-orm migration:up

# Check migration status
pnpm mikro-orm migration:pending

# Rollback last migration
pnpm mikro-orm migration:down
```

In Kubernetes, migrations run as an init container or Job before the API starts.
The Helm chart configures a migration Job via `.helm/values.yaml` `api.migrateOnStart`.

## Secrets Management

The platform uses **Vault + External Secrets Operator**. Store secrets in Vault:

```bash
# Via platform CLI
./platform-orchestrator/platform.sh credentials

# Or directly in Vault
vault kv put secret/opwerf/database password=<pw>
vault kv put secret/opwerf/e2b api-key=<key>
vault kv put secret/opwerf/anthropic api-key=<key>
vault kv put secret/opwerf/credential-proxy signing-key=<key>
```

Create ExternalSecret resources:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: opwerf-secrets
  namespace: opwerf
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: opwerf-secrets
  data:
    - secretKey: DATABASE_PASSWORD
      remoteRef:
        key: secret/opwerf/database
        property: password
    - secretKey: E2B_API_KEY
      remoteRef:
        key: secret/opwerf/e2b
        property: api-key
```

## Monitoring

### Grafana Dashboards

Import from `monitoring/grafana/dashboards/`:
- **opwerf-overview.json** — Workflow states, throughput, error rates
- **opwerf-cost.json** — Cost tracking per tenant, AI vs sandbox spend

Grafana is deployed by `ansible-k8s-full-setup` at `grafana.<domain>` (VPN-only via Headscale).

### Prometheus/VictoriaMetrics

Metrics endpoint: `GET /api/v1/metrics`

Key metrics:
- `sdlc_workflows_total{state}` — Workflow count by state
- `sdlc_agent_sessions_total{status}` — Agent session count
- `sdlc_cost_usd{tenant,type}` — Cost tracking
- `sdlc_http_requests_total{method,path,status}` — HTTP request count
- `sdlc_http_request_duration_seconds{method,path}` — Request latency

Scrape config (auto-discovered via ServiceMonitor in the Helm chart):

```yaml
- job_name: opwerf
  kubernetes_sd_configs:
    - role: service
      namespaces:
        names: [opwerf]
  relabel_configs:
    - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
      action: keep
      regex: "true"
```

### Logs

Loki collects logs from all pods. Query in Grafana:

```logql
{namespace="opwerf", app="orchestrator-api"} |= "error"
{namespace="opwerf", app="temporal-worker"} | json | level="error"
```

### Alerts

Configure in VictoriaMetrics alerting rules:

```yaml
groups:
  - name: opwerf
    rules:
      - alert: HighWorkflowFailureRate
        expr: rate(sdlc_workflows_total{state="blocked_terminal"}[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
      - alert: CostLimitApproaching
        expr: sdlc_cost_usd{type="total"} / on(tenant) sdlc_cost_limit_usd > 0.9
        for: 5m
        labels:
          severity: critical
      - alert: APIHighLatency
        expr: histogram_quantile(0.99, rate(sdlc_http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
```

## Scaling

### Horizontal Pod Autoscaling

Configured in `.helm/values.yaml` for api and worker:

```yaml
api:
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPU: 70

worker:
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 20
    targetCPU: 60
```

### KEDA (Event-Driven)

For scaling workers based on Temporal task queue depth:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: temporal-worker-scaler
  namespace: opwerf
spec:
  scaleTargetRef:
    name: opwerf-worker
  minReplicaCount: 1
  maxReplicaCount: 30
  triggers:
    - type: temporal
      metadata:
        address: temporal.temporal.svc:7233
        namespace: default
        taskQueue: sdlc-main
        targetBacklogSize: "5"
```

### Cluster Scaling

Scale the Hetzner cluster nodes:

```bash
cd ansible-k8s-full-setup
# Edit inventory — increase worker count or upgrade tier
ansible-playbook playbooks/deploy_platform.yml --tags infra,cluster
```

## Troubleshooting

### Common Issues

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| API 503 | `kubectl get pods -n opwerf` | Check pod logs, DB connectivity |
| Workflows stuck in `queued` | Temporal worker down | `kubectl rollout restart deploy opwerf-worker` |
| High AI cost | Check `CostDashboard` or `/api/v1/cost/summary` | Lower `costLimitUsd` on repo config |
| Webhook not processed | Check `/api/v1/webhook-deliveries?status=failed` | Verify webhook secret, check logs |
| DB connection errors | PgBouncer pool exhausted | Scale PgBouncer or increase `pool_size` |
| Sandbox timeouts | E2B API issues | Check E2B status page, verify API key |

### Useful Commands

```bash
# Pod status
kubectl get pods -n opwerf -o wide

# API logs
kubectl logs -n opwerf -l app=orchestrator-api --tail=100 -f

# Worker logs
kubectl logs -n opwerf -l app=temporal-worker --tail=100 -f

# DB shell (via Percona PG)
kubectl exec -it -n databases pg-cluster-pgbouncer-0 -- psql -U orchestrator -d orchestrator

# Temporal CLI
kubectl exec -it -n temporal deploy/temporal-admintools -- tctl namespace list
kubectl exec -it -n temporal deploy/temporal-admintools -- tctl workflow list -n default

# Force restart
kubectl rollout restart deploy -n opwerf -l app.kubernetes.io/instance=opwerf

# Check Helm release
helm status opwerf -n opwerf
helm history opwerf -n opwerf
```

### Disaster Recovery

PostgreSQL backups are managed by Percona PG Operator with pgbackrest:

```bash
# Check backup status
kubectl exec -it -n databases pg-cluster-0 -- pgbackrest info

# Trigger manual backup
kubectl annotate perconapgcluster pg-cluster -n databases \
  postgres-operator.crunchydata.com/pgbackrest-backup="$(date +%s)"

# Restore
kubectl annotate perconapgcluster pg-cluster -n databases \
  postgres-operator.crunchydata.com/pgbackrest-restore="$(date +%s)"
```

MinIO data is backed up to Hetzner Object Storage (configured in `ansible-k8s-full-setup`).

## CI/CD Pipeline

### Workflows

- **`.github/workflows/ci.yml`** — Runs on push/PR: lint, test, build, helm lint, docker build, security scan
- **`.github/workflows/deploy.yml`** — Manual dispatch: choose environment + image tag, runs `helm upgrade`
- **`.github/workflows/release.yml`** — Tag `v*` triggered: build + push images to `ghcr.io`, create GitHub release

### Release Process

1. Merge feature branch to `main`
2. Tag: `git tag v1.x.x && git push --tags`
3. `release.yml` auto-builds images and creates GitHub release
4. Deploy to staging: trigger `deploy.yml` with `staging` + tag
5. Verify staging
6. Deploy to production: trigger `deploy.yml` with `production` + tag
7. Or let ArgoCD auto-sync from the tagged images
