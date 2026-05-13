# Namespace Migration Guide

## Overview

This document details the complete process of migrating an observability stack from a shared application namespace to a dedicated `observability` namespace in Kubernetes.

## Why Migrate?

| Concern | Shared Namespace | Dedicated Namespace |
|---------|-----------------|-------------------|
| **Blast Radius** | App deploy can break monitoring | Isolated — no cross-impact |
| **RBAC** | Overly broad permissions | Scoped to observability resources |
| **Resource Quotas** | Competes with app resources | Independent scaling |
| **Lifecycle** | Tied to app release cycle | Independent upgrades |
| **Network Policy** | Complex mixed rules | Clean egress/ingress rules |

## Migration Phases

### Phase 1: Namespace Setup
```bash
kubectl create namespace observability
```

### Phase 2: Deploy Stack
Deploy Prometheus, Loki, Tempo, and Grafana to the new namespace using Helm.

### Phase 3: Migrate Alloy Collector
- Change from StatefulSet (single pod) to DaemonSet (per-node)
- Update all endpoint URLs from `*.app.svc` to `*.observability.svc`
- Create new PVC in observability namespace

### Phase 4: Update Vault Bindings
HashiCorp Vault roles are namespace-bound. Update `bound_service_account_namespaces` to include `observability`.

### Phase 5: Network Policies
Apply microsegmentation policies:
- Default deny external egress
- Allow internal RDS access for Grafana
- Allow kubelet scraping for Alloy

### Phase 6: Fix Duplicate Metrics
Remove duplicate scrape configs from old namespace to prevent `out-of-order` errors in Prometheus.

### Phase 7: Dedicated ALB
Create a separate ALB for telemetry ingress. Do NOT share with the application ALB.

### Phase 8: DNS & Certificates
- Request wildcard SSL certificate via ACM
- Create Route53 CNAME pointing to new ALB
- Update Faro SDK collector URL

## Rollback Plan

Each phase can be independently rolled back:
1. Re-deploy Helm charts to original namespace
2. Revert Vault role bindings
3. Remove new NetworkPolicies
4. Delete new PVCs and namespace
