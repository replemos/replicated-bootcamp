---
name: poll-actions-check
description: Poll a PR's GitHub Actions check until it completes. Use when waiting for any CI check to finish on a pull request.
---

Use `.claude/scripts/poll-pr-check.sh` to poll — never write an inline `for` loop, as Claude Code's parser cannot handle shell `for` constructs.

## Usage

```bash
.claude/scripts/poll-pr-check.sh <pr-number> <check-name> [max-attempts] [interval-seconds]
```

**Defaults:** max-attempts=`30`, interval=`30` seconds.

## Examples

```bash
# Poll PR 42 for the e2e check
.claude/scripts/poll-pr-check.sh 42 "e2e / e2e"

# Poll a specific check with custom timing
.claude/scripts/poll-pr-check.sh 42 "build / build" 20 60

# Poll a release or lint check
.claude/scripts/poll-pr-check.sh 42 "release / release" 40 30
```

Run this with the Bash tool. It will poll every N seconds and exit when the check reaches COMPLETED status (pass or fail).
