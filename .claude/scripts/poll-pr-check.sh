#!/bin/bash
# Usage: poll-pr-check.sh <pr-number> <check-name> [max-attempts] [interval-seconds]
# Example: poll-pr-check.sh 19 "e2e / e2e"
# Example: poll-pr-check.sh 19 "build / build" 30 30

PR=${1:?Usage: poll-pr-check.sh <pr-number> <check-name> [max-attempts] [interval-seconds]}
CHECK_NAME=${2:?Usage: poll-pr-check.sh <pr-number> <check-name> [max-attempts] [interval-seconds]}
MAX=${3:-30}
INTERVAL=${4:-30}

for i in $(seq 1 "$MAX"); do
  sleep "$INTERVAL"
  result=$(gh pr view "$PR" --json statusCheckRollup -q '.statusCheckRollup[] | {name, conclusion, status}')
  echo "--- $(date) [attempt $i/$MAX] ---"
  echo "$result"
  if echo "$result" | grep "\"$CHECK_NAME\"" | grep -q 'COMPLETED'; then
    echo "Check '$CHECK_NAME' completed."
    break
  fi
done
