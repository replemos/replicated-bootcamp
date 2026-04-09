# TLS Certificate Modes Design

**Date:** 2026-04-09
**Status:** Approved

## Overview

Extend the existing cert-manager HTTPS setup to give operators a choice of three TLS certificate modes: self-signed (automatic, current behavior), Let's Encrypt (automatic, requires internet), and manual upload (operator-provided PEM cert and key).

## Current State

- cert-manager is installed as a cluster extension in `embedded-cluster-config.yaml`
- Traefik is the ingress controller with HTTP→HTTPS redirect already configured
- A `selfsigned` ClusterIssuer and a `Certificate` resource issue a self-signed cert into the `traefik-default-tls` Secret
- A `TLSStore` configures Traefik to use `traefik-default-tls` as the default certificate
- The KOTS config has a `hostname` item in the `ingress` group; no TLS mode selection exists

## Design

### Approach

Approach 1 — single `tls_mode` select with templated issuerRef in the shared Certificate resource and a `kots.io/exclude` annotation to skip it in manual mode. A separate Secret manifest is applied only in manual mode. Chosen for minimal new files and consistency with existing `repl{{...}}` templating patterns.

### KOTS Config (`kots-config.yaml`)

Four new items added to the existing `ingress` group:

| Item | Type | Default | Visible when |
|---|---|---|---|
| `tls_mode` | `select_one` | `self_signed` | always |
| `acme_email` | `text` | — | `tls_mode == lets_encrypt` |
| `tls_cert` | `file` | — | `tls_mode == manual` |
| `tls_key` | `file` | — | `tls_mode == manual` |

`tls_mode` options: `self_signed` (Automatic - Self-Signed), `lets_encrypt` (Automatic - Let's Encrypt), `manual` (Manual Upload).

Default of `self_signed` preserves current behavior for existing installs.

The existing `hostname` item's `help_text` is updated to note it is required when using Let's Encrypt.

### cert-manager Manifests

**`cert-manager-issuer.yaml`** — add a second `ClusterIssuer` for Let's Encrypt in the same file, excluded unless `tls_mode == lets_encrypt`:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
  annotations:
    kots.io/exclude: 'repl{{ not (ConfigOptionEquals "tls_mode" "lets_encrypt") }}'
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: 'repl{{ ConfigOption "acme_email" }}'
    privateKeySecretRef:
      name: letsencrypt-account-key
    solvers:
      - http01:
          ingress:
            class: traefik
```

**`cert-manager-certificate.yaml`** — add `kots.io/exclude` to skip in manual mode; template `issuerRef.name` to select the correct issuer:

```yaml
annotations:
  kots.io/exclude: 'repl{{ ConfigOptionEquals "tls_mode" "manual" }}'
...
issuerRef:
  name: 'repl{{ if ConfigOptionEquals "tls_mode" "lets_encrypt" }}letsencrypt{{ else }}selfsigned{{ end }}'
  kind: ClusterIssuer
```

**New `cert-manager-tls-secret.yaml`** — applied only in manual mode; creates the `traefik-default-tls` Secret from uploaded PEM files:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: traefik-default-tls
  namespace: traefik
  annotations:
    kots.io/exclude: 'repl{{ not (ConfigOptionEquals "tls_mode" "manual") }}'
type: kubernetes.io/tls
data:
  tls.crt: 'repl{{ ConfigOption "tls_cert" }}'
  tls.key: 'repl{{ ConfigOption "tls_key" }}'
```

**`cert-manager-tlsstore.yaml`** — no changes. It always references `traefik-default-tls`, which all three modes provide.

### Data Flow

```
tls_mode=self_signed  → selfsigned ClusterIssuer → Certificate → traefik-default-tls Secret → TLSStore
tls_mode=lets_encrypt → letsencrypt ClusterIssuer → Certificate → traefik-default-tls Secret → TLSStore
tls_mode=manual       → (no Certificate)          → tls-secret manifest → traefik-default-tls Secret → TLSStore
```

### Files Changed

| File | Change |
|---|---|
| `deploy/manifests/kots-config.yaml` | Add `tls_mode`, `acme_email`, `tls_cert`, `tls_key` to ingress group; update `hostname` help_text |
| `deploy/manifests/cert-manager-issuer.yaml` | Add `letsencrypt` ClusterIssuer with exclude annotation |
| `deploy/manifests/cert-manager-certificate.yaml` | Add `kots.io/exclude` annotation; template `issuerRef.name` |
| `deploy/manifests/cert-manager-tls-secret.yaml` | New file — Secret from uploaded PEM files, manual mode only |

No changes to `cert-manager-tlsstore.yaml`, `helmchart.yaml`, `values.yaml`, or `values.schema.json`.
