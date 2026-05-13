# Enterprise Observability Platform

Production Kubernetes observability stack I built and deployed on AWS EKS (GovCloud). Handles metrics, logs, traces, and frontend Real User Monitoring for a government enterprise Angular app.

## What this does

Full-stack telemetry pipeline:
- **Frontend** — Grafana Faro SDK captures Web Vitals (LCP, FID, CLS), JS errors, console logs, and distributed traces from the Angular app
- **Collection** — Grafana Alloy runs as a DaemonSet (one per node), collects from Faro, cAdvisor, and node-exporter
- **Storage** — Prometheus (metrics), Loki (logs), Tempo (traces)
- **Visualization** — Grafana with custom dashboards and Vault-managed secrets

## Architecture

```
                          ┌─────────────────────────────────┐
                          │         Angular App             │
                          │    (Faro SDK instrumented)       │
                          └──────┬──────────────┬───────────┘
                                 │              │
                         app traffic      telemetry
                                 │              │
                    ┌────────────▼──┐    ┌──────▼──────────┐
                    │   Main ALB    │    │ Observability ALB│
                    │  (app only)   │    │ (telemetry only) │
                    └────────┬──────┘    └──────┬──────────┘
                             │                  │
              ┌──────────────▼──┐    ┌──────────▼──────────┐
              │  app namespace   │    │ observability ns     │
              │                  │    │                      │
              │  Angular pods    │    │  Alloy (DaemonSet)   │
              │  API services    │    │      │  │  │         │
              │                  │    │      ▼  ▼  ▼         │
              └──────────────────┘    │  Prom Loki Tempo     │
                                      │      │  │  │         │
                                      │      ▼  ▼  ▼         │
                                      │    Grafana            │
                                      └──────────────────────┘
```

I keep app traffic and telemetry traffic on **separate ALBs** on purpose — a bad observability deploy should never take down the production app. Learned that the hard way when a `group.name` annotation merge nuked DNS routing for about 20 minutes.

## Stack

| Component | What | Why this one |
|-----------|------|-------------|
| Grafana Alloy | Telemetry collector (DaemonSet) | Replaces the old StatefulSet — per-node coverage, no blind spots |
| Prometheus | Metrics | Standard. Remote-write from Alloy |
| Loki | Logs | Pairs with Grafana, cheaper than ELK |
| Tempo | Traces | Native Grafana integration, links traces↔logs |
| Faro SDK | Frontend RUM | Built into Grafana ecosystem, captures Web Vitals |
| HashiCorp Vault | Secrets | K8s auth with namespace-bound SA — bit me during migration |
| AWS ALB | Ingress | Separate ALBs per namespace via ALB Ingress Controller |
| EFS | Storage | ReadWriteMany for DaemonSet WAL across nodes |

## Project layout

```
├── helm/
│   ├── alloy/            # DaemonSet values + .alloy pipeline config
│   ├── grafana/           # Includes Vault init container setup
│   ├── prometheus/
│   ├── loki/
│   └── tempo/
├── kubernetes/
│   ├── ingress/           # ALB configs (alloy + grafana, separate ALBs)
│   ├── storage/           # EFS PVCs per environment
│   ├── network-policies/  # Default deny + RDS/Vault exceptions
│   ├── rbac/              # ClusterRoles for metric scraping
│   └── vault/             # K8s auth role binding docs
├── faro-sdk/              # TypeScript SDK init + env config
├── ci-cd/                 # GitLab CI pipeline
├── dashboards/            # Grafana dashboard JSON
└── docs/
    ├── migration-guide.md
    └── troubleshooting.md
```

## Namespace migration

Moved the entire observability stack from a shared `app` namespace to its own `observability` namespace. This was the bulk of the real work.

**Things that broke and how I fixed them:**

1. **Grafana stuck in `Init:0/1`** — Vault's K8s auth role was bound to the old namespace. Had to update `bound_service_account_namespaces` to include both namespaces
2. **Prometheus rejecting metrics** — Two Alloy instances (old + new) were scraping the same cAdvisor targets → duplicate timestamps → `out-of-order sample` errors. Removed the duplicate scrape config and restarted to clear the WAL
3. **Faro SDK returning 503** — The old Alloy ingress got deleted with `helm uninstall`. Created a dedicated ALB in the new namespace
4. **Tried to share ALBs with `group.name`** — This triggered an ALB reconciliation that messed up the existing app routing. Rolled back immediately, now using separate ALBs
5. **EFS mount failures in test** — Missing mount targets in the test cluster's subnets + IAM role didn't have `sts:AssumeRoleWithWebIdentity`

See [docs/migration-guide.md](docs/migration-guide.md) for the full runbook.

## Key design decisions

**DaemonSet over StatefulSet for Alloy** — StatefulSet means one collector pod for the whole cluster. Miss a node, miss its metrics. DaemonSet puts one pod per node, scrapes local kubelet, no cross-node traffic.

**Separate ALBs per namespace** — AWS ALB can only route to services in the same namespace as the Ingress (when using `target-type: ip`). Cross-namespace routing doesn't work. ExternalName services don't work either because ALB needs real pod IPs for health checks.

**Wildcard SSL cert** — Initially tried using the app's specific cert for the `alloy.` subdomain. Didn't work because it wasn't wildcard. Now requesting a `*.example.com` wildcard cert through ACM to cover all observability subdomains.

**PVC naming convention** — `home-observability-{env}` (e.g., `home-observability-dev`). Pipeline sets `HOME_PV` variable, Helm substitutes into `claimName`. The PVC must exist in the cluster before the pipeline runs — Helm can't create PVCs.

## Deploying

```bash
# create namespace
kubectl create namespace observability

# storage first (one-time per cluster)
kubectl apply -f kubernetes/storage/pvc-dev.yaml

# deploy the stack
helm upgrade --install prometheus prometheus-community/prometheus -n observability -f helm/prometheus/values-dev.yaml
helm upgrade --install loki grafana/loki -n observability -f helm/loki/values-dev.yaml
helm upgrade --install tempo grafana/tempo -n observability -f helm/tempo/values-dev.yaml
helm upgrade --install grafana grafana/grafana -n observability -f helm/grafana/values-dev.yaml
helm upgrade --install alloy grafana/alloy -n observability -f helm/alloy/values-dev.yaml

# ingress
kubectl apply -f kubernetes/ingress/
kubectl apply -f kubernetes/network-policies/

# verify
kubectl get pods -n observability
kubectl get ingress -n observability
```

## Troubleshooting

Common stuff I ran into — see [docs/troubleshooting.md](docs/troubleshooting.md) for details:
- Grafana init container failing (Vault namespace binding)
- Prometheus out-of-order samples (duplicate scrape configs)
- Faro 503s (missing ingress after helm uninstall)
- EFS mount failures (missing mount targets / IAM)
- ConfigMap not found (values.yaml `configMap.create: true` got removed)

## License

MIT
