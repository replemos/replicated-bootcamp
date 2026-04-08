# EC v3 Testing Design

**Date:** 2026-04-08

## Overview

Two deliverables:
1. `docs/testing-ec3.md` — manual testing guide for EC v3 installs on CMX VMs
2. `.github/workflows/e2e-ec3.yml` — CI e2e workflow that verifies a headless EC v3 install succeeds

The success criteria for the CI test is a clean install exit (non-zero exit code = failure). HTTP verification is out of scope for this version.

---

## `docs/testing-ec3.md`

Follows the same structure as `docs/testing-with-cmx.md`.

### Sections

1. **Prerequisites** — `replicated` CLI, `REPLICATED_API_TOKEN`, SSH key at `.ssh/id_ed25519`

2. **Create a release** — Package chart + create release with `--yaml-dir deploy/manifests`

3. **Create a customer** — `replicated customer create` with `--embedded-cluster-download` flag; note the license ID from output

4. **Create a VM** — `replicated vm create --distribution ubuntu --version 24.04 --ttl 2h --ssh-public-key .ssh/id_ed25519.pub`; poll until `running`

5. **Create config-values.yaml** — Write a minimal ConfigValues file locally:
   ```yaml
   apiVersion: kots.io/v1beta1
   kind: ConfigValues
   spec:
     values:
       postgresql_enabled:
         value: "1"
       redis_enabled:
         value: "1"
   ```

6. **SCP config-values.yaml to VM** — Use `replicated vm scp-endpoint` to get SCP endpoint, then `scp` the file

7. **SSH into VM** — Use `replicated vm ssh-endpoint` to get SSH endpoint

8. **On VM: download and install**
   ```bash
   curl -f "https://replicated.app/embedded/playball-exe/<channel-slug>/<version>" \
     -H "Authorization: <license-id>" -o playball-exe.tgz
   tar xzf playball-exe.tgz
   sudo ./playball-exe install \
     --license license.yaml \
     --headless \
     --yes \
     --installer-password <password> \
     --config-values /tmp/config-values.yaml
   ```
   The installer tgz contains `license.yaml` alongside the binary.

9. **Access Admin Console** — `replicated vm port expose <vm-id> --port 30080 --protocol http,https`; open the returned URL

10. **Clean up** — `replicated vm rm <vm-id>`

---

## `.github/workflows/e2e-ec3.yml`

### Trigger

`workflow_call` with inputs matching `e2e.yml` (`image-tag`, `pr-number`), plus `workflow_dispatch` for manual runs.

### Job: `e2e-ec3`

`timeout-minutes: 30` (EC install takes significantly longer than a Helm install).

**Steps:**

1. Checkout
2. Package chart + create release (`yaml-dir: deploy/manifests`) — same as `e2e.yml`
3. Create customer with `--embedded-cluster-download` flag; capture `license-id` output
4. Generate SSH keypair — `ssh-keygen -t ed25519 -f .ssh/id_ed25519 -N "" -C "ci@cmx"`
5. Generate installer password — `openssl rand -hex 16`, store in `$INSTALLER_PASSWORD`
6. Create CMX VM (ubuntu 24.04, ttl 1h, `--ssh-public-key .ssh/id_ed25519.pub`); capture `vm-id`
7. Write `config-values.yaml` inline (bundled postgres + redis)
8. SCP `config-values.yaml` to VM
9. SSH into VM and run:
   - `curl` installer tgz (using license ID as auth)
   - `tar xzf`
   - `sudo ./playball-exe install --license license.yaml --headless --yes --installer-password <pw> --config-values /tmp/config-values.yaml`
10. Cleanup (`if: always()`): archive customer, archive channel, delete VM

### `build-test.yml` update

Add `e2e-ec3` job calling `.github/workflows/e2e-ec3.yml`, alongside the existing `e2e` job:
```yaml
e2e-ec3:
  needs: [build, lint]
  uses: ./.github/workflows/e2e-ec3.yml
  with:
    image-tag: pr-${{ github.event.pull_request.number }}
    pr-number: ${{ github.event.pull_request.number }}
  secrets: inherit
```

### SSH/SCP helpers

Reuse the same pattern from `cmx-create-vm` skill — parse `scp-endpoint` and `ssh-endpoint` to extract host, port, and username from the `ssh://user@host:port` URI.

---

## Out of Scope

- HTTP verification / registration test (first version: clean install exit only)
- Multi-node / HA installs
- Air-gap installs
- External PostgreSQL / Redis config in CI
