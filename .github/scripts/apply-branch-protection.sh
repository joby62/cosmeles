#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   OWNER=joby62 REPO=cosmeles ./.github/scripts/apply-branch-protection.sh
#
# Prerequisites:
#   1) gh auth login
#   2) repo admin permission

: "${OWNER:?OWNER is required, e.g. OWNER=joby62}"
: "${REPO:?REPO is required, e.g. REPO=cosmeles}"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${OWNER}/${REPO}/branches/main/protection" \
  --input .github/branch-protection/main.protection.json

echo "Applied branch protection for ${OWNER}/${REPO}:main"
