<p align="center">
  <img src="docs/images/banner.png" alt="Enterprise Observability Platform" width="800"/>
</p>

<h1 align="center">🔭 Enterprise Observability Platform</h1>

<p align="center">
  <strong>Production-grade Kubernetes observability stack with full-stack telemetry, distributed tracing, and real-time monitoring</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Kubernetes-1.28+-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Kubernetes"/>
  <img src="https://img.shields.io/badge/Grafana-10.x-F46800?style=for-the-badge&logo=grafana&logoColor=white" alt="Grafana"/>
  <img src="https://img.shields.io/badge/Prometheus-2.x-E6522C?style=for-the-badge&logo=prometheus&logoColor=white" alt="Prometheus"/>
  <img src="https://img.shields.io/badge/AWS-GovCloud-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS"/>
  <img src="https://img.shields.io/badge/Helm-3.x-0F1689?style=for-the-badge&logo=helm&logoColor=white" alt="Helm"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Grafana_Alloy-DaemonSet-F46800?style=flat-square&logo=grafana" alt="Alloy"/>
  <img src="https://img.shields.io/badge/Loki-Log_Aggregation-F46800?style=flat-square&logo=grafana" alt="Loki"/>
  <img src="https://img.shields.io/badge/Tempo-Distributed_Tracing-F46800?style=flat-square&logo=grafana" alt="Tempo"/>
  <img src="https://img.shields.io/badge/Faro-Frontend_RUM-F46800?style=flat-square&logo=grafana" alt="Faro"/>
  <img src="https://img.shields.io/badge/HashiCorp_Vault-Secret_Mgmt-000000?style=flat-square&logo=vault" alt="Vault"/>
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Infrastructure Components](#-infrastructure-components)
- [Deployment Guide](#-deployment-guide)
- [Namespace Migration](#-namespace-migration-strategy)
- [Frontend Telemetry (Faro SDK)](#-frontend-telemetry-faro-sdk)
- [Network Security](#-network-security)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Monitoring & Dashboards](#-monitoring--dashboards)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

A **production-grade, enterprise observability platform** deployed on AWS EKS (GovCloud) that provides unified monitoring, logging, tracing, and Real User Monitoring (RUM) for a mission-critical Angular application serving government operations.

### Key Achievements
- 🏗️ **Architected and executed a zero-downtime namespace migration** from a shared application namespace to a dedicated `observability` namespace
- 📊 **Implemented full-stack telemetry** — frontend (Faro SDK) → collector (Alloy) → storage (Loki/Prometheus/Tempo) → visualization (Grafana)
- 🔒 **Secured observability traffic** with dedicated ALB, wildcard SSL certificates, and Kubernetes NetworkPolicies
- 🔐 **Integrated HashiCorp Vault** for secrets management with namespace-aware Kubernetes auth
- 📈 **Built custom Grafana dashboards** for Web Vitals, application performance, and infrastructure health
- ⚡ **Migrated Alloy from StatefulSet to DaemonSet** for per-node telemetry collection and improved reliability

---

## 🏛️ Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Browser"
        A[Angular Application<br/>Faro SDK Instrumented]
    end

    subgraph "AWS Cloud - EKS Cluster"
        subgraph "Ingress Layer"
            ALB1[Application ALB<br/>Main Application]
            ALB2[Observability ALB<br/>Telemetry Dedicated]
        end

        subgraph "Application Namespace"
            APP[Angular App Pods]
            API[API Services]
            RDS[(Amazon RDS<br/>PostgreSQL)]
        end

        subgraph "Observability Namespace"
            ALLOY[Grafana Alloy<br/>DaemonSet]
            GRAFANA[Grafana<br/>Dashboards]
            PROM[Prometheus<br/>Metrics Store]
            LOKI[Loki<br/>Log Aggregation]
            TEMPO[Tempo<br/>Trace Store]
        end

        subgraph "Security"
            VAULT[HashiCorp Vault<br/>Secret Management]
            NP[Network Policies<br/>Egress Control]
        end

        subgraph "Storage"
            EFS[(Amazon EFS<br/>Persistent Storage)]
        end
    end

    subgraph "AWS Services"
        R53[Route53 DNS]
        ACM[ACM Certificates]
    end

    A -->|"HTTPS /app"| ALB1
    A -->|"HTTPS /collect"| ALB2
    ALB1 --> APP
    ALB2 --> ALLOY
    APP --> API
    API --> RDS
    ALLOY -->|"Logs"| LOKI
    ALLOY -->|"Metrics"| PROM
    ALLOY -->|"Traces"| TEMPO
    GRAFANA --> LOKI
    GRAFANA --> PROM
    GRAFANA --> TEMPO
    GRAFANA -.->|"Init: Fetch Secrets"| VAULT
    ALLOY --> EFS
    R53 --> ALB1
    R53 --> ALB2
    ACM -.->|"TLS Termination"| ALB1
    ACM -.->|"TLS Termination"| ALB2
    NP -.->|"Egress Rules"| ALLOY
    NP -.->|"Egress Rules"| GRAFANA
```

### Data Flow Architecture

```mermaid
flowchart LR
    subgraph "Frontend"
        F[Angular App<br/>Faro SDK] -->|"Web Vitals<br/>Console Logs<br/>HTTP Events<br/>JS Errors"| C["/collect endpoint<br/>Port 12347"]
    end

    subgraph "Collection"
        C --> ALLOY[Grafana Alloy<br/>DaemonSet]
        K[Kubernetes<br/>cAdvisor :10250] -->|"Node Metrics"| ALLOY
        N[Node Exporter<br/>:9100] -->|"System Metrics"| ALLOY
    end

    subgraph "Storage"
        ALLOY -->|"Logs via<br/>Loki Push API"| LOKI[Grafana Loki]
        ALLOY -->|"Metrics via<br/>Remote Write"| PROM[Prometheus]
        ALLOY -->|"Traces via<br/>OTLP :4318"| TEMPO[Grafana Tempo]
    end

    subgraph "Visualization"
        LOKI --> G[Grafana]
        PROM --> G
        TEMPO --> G
        G --> D[Web Vitals Dashboard]
        G --> E[Infrastructure Dashboard]
        G --> H[Application Logs Dashboard]
    end
```

### Network Architecture

```mermaid
graph TB
    subgraph "DNS Resolution"
        DNS[Route53] -->|"app.example.com"| ALB1
        DNS -->|"alloy.example.com"| ALB2
    end

    subgraph "Load Balancers"
        ALB1[Main ALB<br/>Cert: app.example.com]
        ALB2[Observability ALB<br/>Cert: *.example.com wildcard]
    end

    subgraph "EKS Cluster"
        subgraph "app namespace"
            ALB1 -->|"/* path"| SVC1[App Service<br/>ClusterIP]
            SVC1 --> POD1[App Pods]
        end

        subgraph "observability namespace"
            ALB2 -->|"/collect"| SVC2[Alloy Service<br/>Port 12347]
            ALB2 -->|"/alloy"| SVC3[Alloy Service<br/>Port 4318]
            SVC2 --> ALLOY[Alloy DaemonSet]
            SVC3 --> ALLOY
        end
    end

    style ALB1 fill:#ff9900,color:#000
    style ALB2 fill:#ff9900,color:#000
    style DNS fill:#8c4fff,color:#fff
```

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Container Orchestration** | Amazon EKS (Kubernetes 1.28+) | Managed Kubernetes on AWS GovCloud |
| **Telemetry Collector** | Grafana Alloy (DaemonSet) | Unified metrics, logs, and trace collection |
| **Metrics** | Prometheus | Time-series metrics storage and alerting |
| **Logging** | Grafana Loki | Horizontally-scalable log aggregation |
| **Tracing** | Grafana Tempo | Distributed tracing backend |
| **Dashboards** | Grafana 10.x | Unified visualization and alerting |
| **Frontend RUM** | Grafana Faro SDK | Real User Monitoring, Web Vitals, error tracking |
| **Secrets** | HashiCorp Vault | Dynamic secret management with K8s auth |
| **Ingress** | AWS ALB Ingress Controller | L7 load balancing with TLS termination |
| **Storage** | Amazon EFS | Shared persistent storage (ReadWriteMany) |
| **DNS** | Amazon Route53 | DNS management and health checking |
| **Certificates** | AWS ACM | SSL/TLS certificate management |
| **CI/CD** | GitLab CI | Automated deployment pipelines |
| **Package Manager** | Helm 3 | Kubernetes application management |
| **Network Security** | Kubernetes NetworkPolicies | Microsegmentation and egress control |
| **Frontend** | Angular 16+ | Enterprise SPA with Faro instrumentation |

---

## 📁 Project Structure

```
enterprise-observability-platform/
├── README.md
├── helm/
│   ├── alloy/
│   │   ├── values-dev.yaml          # Alloy DaemonSet config (dev)
│   │   ├── values-test.yaml         # Alloy DaemonSet config (test)
│   │   └── alloy-config.alloy       # Alloy pipeline configuration
│   ├── grafana/
│   │   └── values-dev.yaml          # Grafana deployment values
│   ├── prometheus/
│   │   └── values-dev.yaml          # Prometheus deployment values
│   ├── loki/
│   │   └── values-dev.yaml          # Loki deployment values
│   └── tempo/
│       └── values-dev.yaml          # Tempo deployment values
├── kubernetes/
│   ├── ingress/
│   │   ├── alloy-faro-ingress.yaml  # Dedicated ALB for Faro telemetry
│   │   └── grafana-ingress.yaml     # Grafana dashboard access
│   ├── storage/
│   │   ├── pvc-dev.yaml             # EFS PersistentVolumeClaim (dev)
│   │   └── pvc-test.yaml            # EFS PersistentVolumeClaim (test)
│   ├── network-policies/
│   │   ├── deny-external-egress.yaml
│   │   └── allow-internal-rds.yaml
│   ├── rbac/
│   │   ├── alloy-clusterrole.yaml
│   │   └── prometheus-clusterrole.yaml
│   └── vault/
│       └── vault-auth-config.yaml   # Vault K8s auth role bindings
├── faro-sdk/
│   ├── faro-init.ts                 # Faro SDK initialization
│   └── environment.config.ts        # Environment-specific endpoints
├── ci-cd/
│   └── .gitlab-ci.yml               # GitLab CI pipeline
├── dashboards/
│   └── web-vitals-dashboard.json    # Grafana Web Vitals dashboard
└── docs/
    ├── migration-guide.md           # Namespace migration documentation
    ├── troubleshooting.md           # Common issues and fixes
    └── images/
        └── banner.png
```

---

## 🧩 Infrastructure Components

### Grafana Alloy — Telemetry Collector

Deployed as a **DaemonSet** (one pod per node) for comprehensive telemetry collection:

```yaml
# Key service ports
ports:
  - name: alloy-ui       # Port 12345 — Debug UI dashboard
  - name: otlp-grpc      # Port 4317  — OpenTelemetry gRPC receiver
  - name: otlp-http      # Port 4318  — OpenTelemetry HTTP receiver
  - name: faro-receiver   # Port 12347 — Faro SDK /collect endpoint
  - name: metrics         # Port 9090  — Self-monitoring metrics
```

**Why DaemonSet over StatefulSet?**
- One collector per node ensures no blind spots
- Automatic scaling as nodes are added/removed
- Local kubelet metric scraping without cross-node traffic
- Simplified WAL management (no shared state)

### Persistent Storage Architecture

```mermaid
graph LR
    subgraph "Kubernetes"
        PVC[PersistentVolumeClaim<br/>home-observability-dev]
        PV[PersistentVolume<br/>pvc-3fc50bbc-...]
    end

    subgraph "AWS"
        EFS[Amazon EFS<br/>Filesystem]
        MT1[Mount Target<br/>Subnet AZ-1]
        MT2[Mount Target<br/>Subnet AZ-2]
    end

    PVC -->|"Bound"| PV
    PV -->|"CSI Driver"| EFS
    EFS --> MT1
    EFS --> MT2
```

### HashiCorp Vault Integration

```mermaid
sequenceDiagram
    participant Pod as Grafana Pod
    participant Init as vault-agent-init
    participant Vault as HashiCorp Vault
    participant K8s as Kubernetes API

    Pod->>Init: Start init container
    Init->>K8s: Get ServiceAccount token
    K8s-->>Init: JWT token
    Init->>Vault: Auth with K8s JWT
    Note over Vault: Verify SA name & namespace<br/>against role binding
    Vault-->>Init: Vault token
    Init->>Vault: Fetch secrets
    Vault-->>Init: DB credentials, API keys
    Init->>Pod: Mount secrets as files
    Pod->>Pod: Start main container
```

---

## 🚀 Deployment Guide

### Prerequisites

- AWS EKS cluster (1.28+) with AWS Load Balancer Controller
- Helm 3.x installed
- `kubectl` configured for target cluster
- HashiCorp Vault accessible from cluster
- AWS EFS CSI Driver installed
- AWS ACM certificate (wildcard recommended)

### Step 1: Create Namespace

```bash
kubectl create namespace observability
```

### Step 2: Create Persistent Storage

```bash
kubectl apply -f kubernetes/storage/pvc-dev.yaml
# Verify
kubectl get pvc -n observability
```

### Step 3: Deploy Observability Stack

```bash
# Deploy Prometheus
helm upgrade --install prometheus prometheus-community/prometheus \
  -n observability -f helm/prometheus/values-dev.yaml

# Deploy Loki
helm upgrade --install loki grafana/loki \
  -n observability -f helm/loki/values-dev.yaml

# Deploy Tempo
helm upgrade --install tempo grafana/tempo \
  -n observability -f helm/tempo/values-dev.yaml

# Deploy Grafana
helm upgrade --install grafana grafana/grafana \
  -n observability -f helm/grafana/values-dev.yaml

# Deploy Alloy
helm upgrade --install alloy grafana/alloy \
  -n observability -f helm/alloy/values-dev.yaml
```

### Step 4: Configure Ingress & DNS

```bash
# Create Alloy telemetry ingress
kubectl apply -f kubernetes/ingress/alloy-faro-ingress.yaml

# Get ALB hostname for Route53
kubectl get ingress alloy-faro-ingress -n observability \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Step 5: Apply Network Policies

```bash
kubectl apply -f kubernetes/network-policies/
```

---

## 🔄 Namespace Migration Strategy

Successfully executed a **zero-downtime migration** of the entire observability stack from a shared application namespace to a dedicated namespace.

### Migration Phases

```mermaid
gantt
    title Observability Namespace Migration Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Namespace Creation & Core Deploy    :done, p1, 2026-03-27, 3d
    section Phase 2
    Alloy DaemonSet Migration           :done, p2, 2026-03-30, 5d
    section Phase 3
    PVC & Storage Migration             :done, p3, 2026-04-05, 3d
    section Phase 4
    Vault Binding Updates               :done, p4, 2026-04-08, 2d
    section Phase 5
    Network Policy Implementation       :done, p5, 2026-04-10, 4d
    section Phase 6
    Prometheus Dedup Fix                :done, p6, 2026-04-15, 2d
    section Phase 7
    Dedicated ALB & DNS Setup           :active, p7, 2026-05-01, 14d
    section Phase 8
    Test Environment Rollout            :active, p8, 2026-05-07, 14d
```

### Key Challenges Solved

| Challenge | Root Cause | Solution |
|-----------|-----------|----------|
| Grafana stuck in `Init:0/1` | Vault auth role bound to old namespace only | Updated Vault role: `bound_service_account_namespaces=app,observability` |
| Prometheus `out-of-order` errors | Duplicate cAdvisor scrapes from old + new Alloy | Removed duplicate scrape config, restarted DaemonSet to clear WAL |
| Faro SDK `503` on `/collect` | Old Alloy ingress deleted with Helm uninstall | Created dedicated ALB in observability namespace |
| ALB group.name caused outage | Merging ingress groups triggered ALB reconciliation | Abandoned group merge; deployed separate dedicated ALB |
| EFS mount failures in test | Missing mount targets + IAM role permissions | Created EFS mount targets in correct subnets, updated IRSA |
| Cross-namespace routing impossible | ALB ip-mode only routes to same-namespace services | Dedicated ALB per namespace (same pattern as Grafana) |

---

## 📱 Frontend Telemetry (Faro SDK)

### Integration Architecture

```mermaid
flowchart TB
    subgraph "Browser (End User)"
        APP[Angular Application]
        FARO[Faro SDK]
        APP --> FARO
        FARO -->|Capture| WV[Web Vitals<br/>LCP, FID, CLS, TTFB, FCP]
        FARO -->|Capture| CL[Console Logs]
        FARO -->|Capture| ERR[JavaScript Errors]
        FARO -->|Capture| HTTP[HTTP Request Events]
        FARO -->|Capture| TRACE[User Session Traces]
    end

    FARO -->|"POST /collect<br/>HTTPS"| ALB[Observability ALB]
    ALB --> ALLOY[Grafana Alloy<br/>faro.receiver :12347]
    ALLOY -->|Logs| LOKI[Loki]
    ALLOY -->|Metrics| PROM[Prometheus]
    ALLOY -->|Traces| TEMPO[Tempo]

    LOKI --> GF[Grafana Dashboard]
    PROM --> GF
    TEMPO --> GF
```

### SDK Initialization

```typescript
import { initializeFaro } from '@grafana/faro-web-sdk';
import { getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

initializeFaro({
  url: environment.faroCollectorUrl,  // https://alloy.example.com/collect
  app: {
    name: 'enterprise-app',
    version: '1.0.0',
    environment: environment.name
  },
  instrumentations: [
    ...getWebInstrumentations({
      captureConsole: true,
      captureConsoleDisabledLevels: []
    }),
    new TracingInstrumentation()
  ]
});
```

---

## 🔒 Network Security

### Network Policy Strategy

```mermaid
graph TB
    subgraph "observability namespace"
        ALLOY[Alloy DaemonSet]
        GRAFANA[Grafana]
        PROM[Prometheus]
        LOKI[Loki]
        TEMPO[Tempo]
    end

    subgraph "Allowed Egress"
        RDS[(RDS PostgreSQL<br/>10.0.0.0/8)]
        VAULT[HashiCorp Vault]
        DNS[CoreDNS<br/>kube-system]
        K8SAPI[Kubernetes API<br/>Control Plane]
    end

    subgraph "Blocked"
        INTERNET[❌ Public Internet]
        OTHER[❌ Other Namespaces]
    end

    ALLOY -->|"✅ Allowed"| PROM
    ALLOY -->|"✅ Allowed"| LOKI
    ALLOY -->|"✅ Allowed"| TEMPO
    GRAFANA -->|"✅ Allowed"| RDS
    GRAFANA -->|"✅ Allowed"| VAULT
    ALLOY -->|"✅ Allowed"| DNS
    ALLOY -->|"✅ Allowed"| K8SAPI
    GRAFANA -.->|"❌ Denied"| INTERNET
    ALLOY -.->|"❌ Denied"| INTERNET
```

---

## 🔄 CI/CD Pipeline

### Deployment Flow

```mermaid
flowchart LR
    DEV[Developer Push] --> GL[GitLab CI]
    GL --> LINT[Helm Lint]
    LINT --> DIFF[Helm Diff]
    DIFF -->|"Review"| DEPLOY_DEV[Deploy Dev]
    DEPLOY_DEV --> VERIFY[Health Check]
    VERIFY -->|"Pass"| DEPLOY_TEST[Deploy Test]
    DEPLOY_TEST --> SMOKE[Smoke Test]
    SMOKE -->|"Approve"| DEPLOY_PROD[Deploy Prod]
```

---

## 📊 Monitoring & Dashboards

### Web Vitals Dashboard
Real-time frontend performance monitoring capturing Core Web Vitals:

| Metric | Description | Target |
|--------|-------------|--------|
| **LCP** | Largest Contentful Paint | < 2.5s |
| **FID** | First Input Delay | < 100ms |
| **CLS** | Cumulative Layout Shift | < 0.1 |
| **TTFB** | Time to First Byte | < 800ms |
| **FCP** | First Contentful Paint | < 1.8s |

### Infrastructure Monitoring
- Node-level metrics (CPU, memory, disk, network)
- Pod resource utilization and limits
- Kubernetes state metrics (deployments, replicas, PVCs)
- Alloy collector health and throughput

---

## 🔧 Troubleshooting

### Common Issues

<details>
<summary><b>Grafana stuck in Init:0/1</b></summary>

**Cause:** Vault auth role not updated for new namespace.

```bash
# Check init container logs
kubectl logs grafana-0 -n observability -c vault-agent-init

# Fix: Update Vault role
vault write auth/kubernetes/role/grafana \
  bound_service_account_names=grafana \
  bound_service_account_namespaces=app,observability \
  policies=grafana-policy \
  ttl=1h

# Restart
kubectl rollout restart statefulset grafana -n observability
```
</details>

<details>
<summary><b>Prometheus out-of-order sample errors</b></summary>

**Cause:** Duplicate scrape configs writing to same Prometheus instance.

```bash
# Restart Alloy to clear stale WAL
kubectl rollout restart daemonset alloy -n observability
kubectl rollout status daemonset alloy -n observability
```
</details>

<details>
<summary><b>Faro SDK returning 503 on /collect</b></summary>

**Cause:** Alloy ingress missing or misconfigured.

```bash
# Verify ingress exists
kubectl get ingress alloy-faro-ingress -n observability

# Verify ALB has address
kubectl get ingress alloy-faro-ingress -n observability \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Verify Alloy service has endpoints
kubectl get endpoints alloy -n observability
```
</details>

<details>
<summary><b>EFS PVC mount failures</b></summary>

**Cause:** Missing EFS mount targets or IAM permissions.

```bash
# Check PVC status
kubectl get pvc -n observability

# Check pod events
kubectl describe pod <pod-name> -n observability | tail -20

# Verify EFS mount targets exist in VPC subnets
aws efs describe-mount-targets --file-system-id <fs-id>
```
</details>

---

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ❤️ for enterprise-grade observability</sub>
</p>
