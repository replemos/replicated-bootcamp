# HTTPS / TLS Support — Helm Chart Design

**Date:** 2026-04-06
**Scope:** `deploy/charts/` Helm chart only

---

## Overview

Add structured HTTPS support to the playball-exe Helm chart via a `tls` block in `values.yaml`. Three certificate modes are supported: automatically provisioned (cert-manager), manually provided (existing Secret or inline cert/key), and self-signed (cert-manager SelfSigned issuer). cert-manager is optionally installable as a subchart dependency.

---

## Values Structure

Replace the existing bare `ingress.tls: []` array with a top-level `tls` block:

```yaml
tls:
  enabled: false
  # mode: auto | manual | self-signed
  mode: auto

  auto:
    issuerRef:
      name: ""             # required when mode=auto (e.g. letsencrypt-prod)
      kind: ClusterIssuer  # ClusterIssuer | Issuer

  manual:
    secretName: ""   # reference a pre-existing kubernetes.io/tls Secret
    cert: ""         # OR provide cert PEM directly (chart creates the Secret)
    key: ""          # required when cert is set

# NOTE: if tls.enabled=true, set nextauth.url to https://<hostname>
certmanager:
  enabled: false
  installCRDs: true
```

The `ingress.tls` array property is removed from `values.yaml` and the schema entirely.

---

## Templates

### `templates/ingress.yaml` (updated)

- When `tls.enabled=true`, add a `tls:` stanza to the Ingress spec. Secret name is resolved via the `playball-exe.tlsSecretName` helper (see below).
- When `mode=auto`, add a cert-manager annotation to the Ingress metadata:
  - `kind: ClusterIssuer` → `cert-manager.io/cluster-issuer: <name>`
  - `kind: Issuer` → `cert-manager.io/issuer: <name>`
- When `tls.enabled=false`, no TLS stanza or annotations are added (existing behavior preserved).

### `templates/_helpers.tpl` (updated)

Add helper `playball-exe.tlsSecretName` that resolves the TLS secret name:

| mode | secretName set? | cert set? | resolved secret |
|------|----------------|-----------|-----------------|
| `auto` | — | — | `<fullname>-tls` |
| `manual` | yes | no | `tls.manual.secretName` |
| `manual` | no | yes | `<fullname>-tls` |
| `self-signed` | — | — | `<fullname>-tls` |

### `templates/tls-secret.yaml` (new)

Rendered only when `tls.enabled && tls.mode == "manual" && tls.manual.cert != ""`.

Creates a `kubernetes.io/tls` Secret named `<fullname>-tls` with `tls.crt` and `tls.key` from `tls.manual.cert` and `tls.manual.key`.

### `templates/issuer.yaml` (new)

Rendered only when `tls.enabled && tls.mode == "self-signed"`.

Creates a namespace-scoped cert-manager `Issuer`:
```yaml
apiVersion: cert-manager.io/v1
kind: Issuer
spec:
  selfSigned: {}
```

### `templates/certificate.yaml` (new)

Rendered only when `tls.enabled && tls.mode == "self-signed"`.

Creates a cert-manager `Certificate` resource:
- `issuerRef` points to the SelfSigned Issuer created above
- `secretName: <fullname>-tls` (cert-manager populates this Secret)
- `dnsNames: [ingress.hostname]`

### `Chart.yaml` (updated)

Add cert-manager as a conditional dependency:

```yaml
- name: cert-manager
  repository: https://charts.jetstack.io
  version: "v1.17.x"   # pin to latest stable at implementation time
  condition: certmanager.enabled
```

---

## Schema Validation (`values.schema.json`)

- `tls.mode`: enum `["auto", "manual", "self-signed"]`
- When `tls.enabled && tls.mode == "auto"`: `tls.auto.issuerRef.name` minLength: 1
- The `ingress.tls` array property is removed
- `certmanager` block added: `enabled` (bool), `installCRDs` (bool)
- Mutual exclusivity of `manual.secretName` vs `manual.cert`/`key` is enforced at template render time (not schema), since JSON Schema `if/then` cannot express "exactly one of" cleanly across sibling fields

---

## Error Handling

**Template-level `fail` guards:**

| Condition | Behavior |
|-----------|----------|
| `mode=auto` and `issuerRef.name` is empty | `fail` with descriptive message |
| `mode=manual` and both `secretName` and `cert` are empty | `fail` — one must be set |
| `mode=manual` and both `secretName` and `cert` are non-empty | `fail` — ambiguous, pick one |

**Warnings (non-fatal):**

- When `tls.enabled && mode ∈ {auto, self-signed} && certmanager.enabled=false`: rendered manifests include a comment noting cert-manager must be pre-installed in the cluster.
- `values.yaml` comments note that `nextauth.url` must be updated to `https://` when TLS is enabled.

**cert-manager CRDs:**
When `certmanager.enabled=true && installCRDs=false`, cert-manager CRDs must already exist in the cluster. This is standard cert-manager behavior; no special chart handling is needed.

---

## What Is Not In Scope

- HTTP → HTTPS redirect (ingress controller feature, configured outside this chart)
- ACME DNS-01 challenge configuration
- Multiple ingress hosts
- Mutual TLS (mTLS)
