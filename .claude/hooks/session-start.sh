#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "${CLAUDE_PROJECT_DIR:-.}"

# 空の master ブランチにいる場合、origin/main に切り替える
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
HAS_COMMITS=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" = "master" ] && [ -z "$HAS_COMMITS" ]; then
  git fetch origin main
  git checkout -b main --track origin/main
fi

# npm 依存関係のインストール
if [ -f "web/package.json" ]; then
  cd web
  npm install
  cd ..
fi
