# Troubleshooting Guide

## Grafana — Stuck in Init:0/1

**Symptoms:** `kubectl get pods` shows `grafana-0 Init:0/1`

**Cause:** Vault agent init container cannot authenticate — namespace mismatch.

**Fix:**
```bash
# Check init logs
kubectl logs grafana-0 -n observability -c vault-agent-init

# Update Vault role
vault write auth/kubernetes/role/grafana \
  bound_service_account_names=grafana \
  bound_service_account_namespaces=app,observability \
  policies=grafana-policy \
  ttl=1h

# Restart
kubectl rollout restart statefulset grafana -n observability
```

---

## Prometheus — Out-of-Order Samples

**Symptoms:** `out of order sample` errors in Prometheus logs

**Cause:** Multiple Alloy instances scraping same targets → duplicate timestamps

**Fix:**
```bash
# Remove duplicate scrape config from old namespace
kubectl edit configmap alloy-config -n <old-namespace>
# Remove the conflicting prometheus.scrape block

# Restart Alloy to clear WAL
kubectl rollout restart daemonset alloy -n observability
```

---

## Faro SDK — 503 on /collect

**Symptoms:** Browser DevTools shows `503 Service Unavailable` on `/collect`

**Cause:** Alloy ingress missing or ALB misconfigured

**Fix:**
```bash
# Verify ingress
kubectl get ingress alloy-faro-ingress -n observability

# Check ALB has address
kubectl get ingress alloy-faro-ingress -n observability -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Verify service has endpoints
kubectl get endpoints alloy -n observability

# Verify Alloy pods are running
kubectl get pods -n observability -l app=alloy
```

---

## EFS PVC — FailedMount

**Symptoms:** Pod stuck in `ContainerCreating`, events show `FailedMount`

**Cause:** EFS mount targets missing or IAM permissions denied

**Fix:**
```bash
# Check events
kubectl describe pod <pod-name> -n observability | tail -30

# Verify EFS mount targets
aws efs describe-mount-targets --file-system-id <fs-id>

# Check IAM role has efs:ClientMount permission
aws iam get-role-policy --role-name <efs-csi-role> --policy-name <policy>
```

---

## ConfigMap Not Found

**Symptoms:** Pod crash with `configmap "alloy-config" not found`

**Cause:** `configMap.create` set to `false` or removed from values.yaml

**Fix:**
```bash
# Check if ConfigMap exists
kubectl get configmap alloy-config -n observability

# If missing, ensure values.yaml has:
# configMap:
#   enabled: true
#   create: true
#   name: alloy-config

# Redeploy
helm upgrade --install alloy grafana/alloy -n observability -f values-dev.yaml
```

---

## ALB — No Address Assigned

**Symptoms:** `kubectl get ingress` shows empty ADDRESS column

**Cause:** AWS Load Balancer Controller not processing the ingress

**Fix:**
```bash
# Check ALB controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller --tail=50

# Verify IngressClass
kubectl get ingressclass

# Check annotation format
kubectl get ingress <name> -n observability -o yaml | grep -A5 annotations
```
