# cert-manager + HTTPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cert-manager as an EC extension to issue a self-signed TLS certificate, configure Traefik to terminate HTTPS on NodePort 443, and redirect HTTP to HTTPS.

**Architecture:** cert-manager is added as an EC extension (weight 10, installed before Traefik). A ClusterIssuer and Certificate are deployed as KOTS manifests to issue a self-signed cert stored in the `traefik` namespace. A Traefik `TLSStore` default picks it up automatically for all HTTPS traffic. The app Ingress requires no TLS changes.

**Tech Stack:** cert-manager v1.17.2 (Jetstack Helm chart), Traefik v39.0.7, KOTS manifests with template functions, GitHub Actions

---

### Task 1: Add cert-manager EC extension

**Files:**
- Modify: `deploy/manifests/embedded-cluster-config.yaml`

- [ ] **Step 1: Add cert-manager to extensions.helmCharts**

The full file should look like this after the edit:

```yaml
apiVersion: embeddedcluster.replicated.com/v1beta1
kind: Config
metadata:
  name: playball-exe
spec:
  version: "3.0.0-alpha-31+k8s-1.34"
  domains:
    proxyRegistryDomain: images.emosbaugh.be
  extensions:
    helmCharts:
      - chart:
          name: cert-manager
          chartVersion: "v1.17.2"
        releaseName: cert-manager
        namespace: cert-manager
        weight: 10
        values:
          crds:
            enabled: true
      - chart:
          name: traefik
          chartVersion: "39.0.7"
        releaseName: traefik
        namespace: traefik
        values:
          service:
            type: NodePort
          ports:
            web:
              port: 8000
              expose:
                default: true
              exposedPort: 80
              nodePort: 80
              redirections:
                entryPoint:
                  to: websecure
                  scheme: https
                  permanent: true
            websecure:
              port: 8443
              expose:
                default: true
              exposedPort: 443
              nodePort: 443
```

- [ ] **Step 2: Commit**

```bash
git add deploy/manifests/embedded-cluster-config.yaml
git commit -m "feat: add cert-manager EC extension and Traefik HTTPS config"
```

---

### Task 2: Add cert-manager KOTS manifests

**Files:**
- Create: `deploy/manifests/cert-manager-issuer.yaml`
- Create: `deploy/manifests/cert-manager-certificate.yaml`
- Create: `deploy/manifests/cert-manager-tlsstore.yaml`

- [ ] **Step 1: Create ClusterIssuer**

`deploy/manifests/cert-manager-issuer.yaml`:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
```

- [ ] **Step 2: Create Certificate**

`deploy/manifests/cert-manager-certificate.yaml`:
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: traefik-default-tls
  namespace: traefik
spec:
  secretName: traefik-default-tls
  dnsNames:
    - 'repl{{ ConfigOption "hostname" }}'
  issuerRef:
    name: selfsigned
    kind: ClusterIssuer
```

- [ ] **Step 3: Create TLSStore**

`deploy/manifests/cert-manager-tlsstore.yaml`:
```yaml
apiVersion: traefik.io/v1alpha1
kind: TLSStore
metadata:
  name: default
  namespace: traefik
spec:
  defaultCertificate:
    secretName: traefik-default-tls
```

- [ ] **Step 4: Commit**

```bash
git add deploy/manifests/cert-manager-issuer.yaml \
        deploy/manifests/cert-manager-certificate.yaml \
        deploy/manifests/cert-manager-tlsstore.yaml
git commit -m "feat: add cert-manager ClusterIssuer, Certificate, and Traefik TLSStore manifests"
```

---

### Task 3: Update CI release pipeline to include cert-manager chart archive

**Files:**
- Modify: `.github/workflows/build-test.yml`

- [ ] **Step 1: Add cert-manager helm pull to Package Helm chart step**

Replace the `Package Helm chart` step run block:

```yaml
      - name: Package Helm chart
        run: |
          VERSION="${{ steps.set-version.outputs.version }}"
          sed -i "s/^  tag: .*/  tag: pr-${{ github.event.pull_request.number }}/" deploy/charts/values.yaml
          sed -i "s/chartVersion: .*/chartVersion: $VERSION/" deploy/manifests/helmchart.yaml
          helm package deploy/charts -d deploy/manifests --version "$VERSION"
          helm repo add traefik https://helm.traefik.io/traefik
          helm pull traefik/traefik --version 39.0.7 -d deploy/manifests
          helm repo add jetstack https://charts.jetstack.io
          helm pull jetstack/cert-manager --version v1.17.2 -d deploy/manifests
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build-test.yml
git commit -m "ci: add cert-manager chart archive to release pipeline"
```

---

### Task 4: Update e2e-ec3.yml — add hostname and HTTPS validation

**Files:**
- Modify: `.github/workflows/e2e-ec3.yml`

- [ ] **Step 1: Add hostname to Write config-values.yaml step**

Replace the `Write config-values.yaml` step:

```yaml
      - name: Write config-values.yaml
        env:
          CONFIG_VALUES: |
            apiVersion: kots.io/v1beta1
            kind: ConfigValues
            spec:
              values:
                postgresql_enabled:
                  value: "1"
                redis_enabled:
                  value: "1"
                hostname:
                  value: "test.playball.example.com"
        run: echo "$CONFIG_VALUES" > /tmp/config-values.yaml
```

- [ ] **Step 2: Add Validate HTTPS step after "Download and install EC v3"**

Insert this step between `Download and install EC v3` and `Collect support bundle`:

```yaml
      - name: Validate HTTPS
        env:
          LICENSE_ID: ${{ steps.create-customer.outputs.license-id }}
        run: |
          VM_ID="${{ steps.create-vm.outputs.vm-id }}"
          SSH_ENDPOINT=$(replicated vm ssh-endpoint "$VM_ID" \
            --username ci \
            --token ${{ secrets.REPLICATED_API_TOKEN }})
          SSH_HOST=$(echo "$SSH_ENDPOINT" | sed 's|[a-z]*://[^@]*@||' | cut -d: -f1)
          SSH_PORT=$(echo "$SSH_ENDPOINT" | cut -d: -f3)
          ssh -i .ssh/id_ed25519 \
            -p "$SSH_PORT" \
            -o StrictHostKeyChecking=no \
            -o UserKnownHostsFile=/dev/null \
            "ci@$SSH_HOST" \
            'HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" \
               -H "Host: test.playball.example.com" http://10.0.0.11:80/) && \
             ([ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "308" ]) || \
               { echo "Expected HTTP redirect, got $HTTP_STATUS"; exit 1; } && \
             HTTPS_STATUS=$(curl -sko /dev/null -w "%{http_code}" \
               -H "Host: test.playball.example.com" https://10.0.0.11:443/) && \
             [ "$HTTPS_STATUS" = "200" ] || \
               { echo "Expected HTTPS 200, got $HTTPS_STATUS"; exit 1; } && \
             echo "HTTPS validation passed"'
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e-ec3.yml
git commit -m "ci: add hostname to config-values and HTTPS validation step in e2e-ec3"
```

---

### Task 5: Create release and deploy to test VM

**Files:** none — release + manual test

- [ ] **Step 1: Pull cert-manager chart and create release**

```bash
helm pull traefik/traefik --version 39.0.7 -d deploy/manifests
helm repo add jetstack https://charts.jetstack.io
helm pull jetstack/cert-manager --version v1.17.2 -d deploy/manifests
helm package deploy/charts -d deploy/manifests --version "0.1.0"

replicated release create \
  --yaml-dir deploy/manifests \
  --version "0.1.0-ec3-test-https" \
  --promote Unstable \
  --token $REPLICATED_API_TOKEN \
  --app playball-exe

rm deploy/manifests/*.tgz
```

- [ ] **Step 2: Upgrade existing test VM**

Replace `<vm-id>` with `cafe3747`, download from the correct directory, and run upgrade:

```bash
SSH_ENDPOINT=$(replicated vm ssh-endpoint cafe3747 --username ethan --token $REPLICATED_API_TOKEN)
SSH_HOST=$(echo "$SSH_ENDPOINT" | sed 's|[a-z]*://[^@]*@||' | cut -d: -f1)
SSH_PORT=$(echo "$SSH_ENDPOINT" | cut -d: -f3)

ssh -i .ssh/id_ed25519 \
  -p "$SSH_PORT" \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  "ethan@${SSH_HOST}" \
  "curl -f 'https://replicated.app/embedded/playball-exe/unstable/0.1.0-ec3-test-https' \
    -H 'Authorization: 3C6XSFWjKlYDo5jyh831YMgudpF' \
    -o playball-exe-https.tgz && \
  mkdir -p playball-exe-https && tar xzf playball-exe-https.tgz -C playball-exe-https && \
  cd playball-exe-https && sudo ./playball-exe upgrade \
    --license license.yaml \
    --headless --yes \
    --installer-password 'playball123' \
    --config-values /tmp/config-values.yaml"
```

- [ ] **Step 3: Verify HTTPS and redirect from inside VM**

```bash
ssh -i .ssh/id_ed25519 \
  -p "$SSH_PORT" \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  "ethan@${SSH_HOST}" \
  'HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" \
     -H "Host: wonderful-matsumoto.ingress.replicatedcluster.com" http://10.0.0.11:80/) && \
   echo "HTTP status: $HTTP_STATUS" && \
   HTTPS_STATUS=$(curl -sko /dev/null -w "%{http_code}" \
     -H "Host: wonderful-matsumoto.ingress.replicatedcluster.com" https://10.0.0.11:443/) && \
   echo "HTTPS status: $HTTPS_STATUS"'
```

Expected output:
```
HTTP status: 301
HTTPS status: 200
```

- [ ] **Step 4: Expose port 443 via CMX**

```bash
replicated vm port expose cafe3747 --port 443 --protocol https --token $REPLICATED_API_TOKEN
```

Note the new HTTPS CMX URL. Visit it in a browser — accept the self-signed cert warning to confirm the app loads.

- [ ] **Step 5: Update docs/testing-ec3.md to mention port 443 expose**

After the existing "Access the App" section, add:

```markdown
## Access the App via HTTPS

Traefik also listens on port 443 with a self-signed certificate. Expose it:

```bash
replicated vm port expose <vm-id> --port 443 --protocol https --token $REPLICATED_API_TOKEN
```

The app is accessible at the HTTPS URL. Your browser will show a certificate warning for the self-signed cert — proceed past it. HTTP traffic on port 80 redirects automatically to HTTPS.
```

- [ ] **Step 6: Commit docs update**

```bash
git add docs/testing-ec3.md
git commit -m "docs: add HTTPS port expose step to testing-ec3 guide"
```
