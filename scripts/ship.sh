#!/usr/bin/env bash
# Ship current work through the PR flow (GitHub-free branch-protection stand-in):
#   scripts/ship.sh "feat: my message"          # commit staged+unstaged, push branch, open PR, watch CI, squash-merge
#   scripts/ship.sh                             # branch already has commits -> PR + merge only
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MSG="${1:-}"
CUR=$(git symbolic-ref --quiet --short HEAD || echo detached)

if [ "$CUR" = "main" ]; then
  echo "On main — creating a work branch first (protection stand-in refuses direct main pushes)."
  SLUG=$(echo "${MSG:-chore}" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9 -' | cut -c1-30 | tr ' ' '-' | sed 's/-\+/-/g;s/^-*//;s/-*$//')
  BRANCH="ship/$(date +%s)-${SLUG:-changes}"
  git switch -c "$BRANCH"
  CUR="$BRANCH"
fi

if [ -n "$MSG" ] && ! git diff --quiet HEAD 2>/dev/null; then
  git add -A
  git commit -m "$MSG"
fi

git push -u origin "$CUR"

PR=$(gh pr view --json number --jq '.number' 2>/dev/null || true)
if [ -z "${PR:-}" ] || [ "$PR" = "null" ]; then
  gh pr create --base main --head "$CUR" --fill 2>/dev/null || gh pr create --base main --head "$CUR" --title "${MSG:-ship: $CUR}" --body "Automated ship via scripts/ship.sh"
  PR=$(gh pr view --json number --jq '.number')
fi
echo "→ PR #$PR open; waiting for checks to register…"
for _ in $(seq 1 30); do
  if [ -n "$(gh pr checks "$PR" 2>/dev/null || true)" ]; then break; fi
  sleep 10
done
gh pr checks "$PR" --watch --interval 30
gh pr merge "$PR" --squash --delete-branch
git switch main && git pull --ff-only
echo "✔ shipped: $(git log --oneline -1)"
