#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GH_TOKEN:-}" ]; then
  echo "ERROR: GH_TOKEN environment variable not set. Export a GitHub Personal Access Token with repo scope." >&2
  exit 1
fi

# Use HTTPS with embedded token (no source repo linkage). Token not written to any file.
REPO_URL="https://${GH_TOKEN}@github.com/nunyalabs/equipghana.git"
BRANCH="main"
BUILD_DIR="dist"

# 1. Build fresh assets
npm run build

# 2. Create a temporary work directory
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

cp -R "$BUILD_DIR"/* "$TMP_DIR"/
cd "$TMP_DIR"

git init -q
# Configure a minimal identity (optional override)
if ! git config user.name >/dev/null; then
  git config user.name "equip-deployer"
fi
if ! git config user.email >/dev/null; then
  git config user.email "deploy@local"
fi

git add .
COMMIT_MSG="Deploy $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Shallow orphan push
(git commit -m "$COMMIT_MSG" >/dev/null)

git branch -M "$BRANCH"

git remote add origin "$REPO_URL"
# Force push because this branch is deployment artefacts only
if git push -f origin "$BRANCH"; then
  echo "Deployment successful to main branch (dist contents only)."
  echo "Configure GitHub Pages: Settings → Pages → Branch: main / root."
  echo "Once enabled: https://nunyalabs.github.io/equipghana/"
else
  echo "Deployment failed." >&2
  exit 1
fi
