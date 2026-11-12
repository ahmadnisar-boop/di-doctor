#!/bin/bash
# Release flow (main is protected: changes land through a pull request, tags are pushed after the merge).
#
#   pnpm release 0.2.0        -> bumps versions, checks CHANGELOG, opens a signed release PR
#   pnpm release 0.2.0 --tag  -> after the PR is merged: tags the merged commit on main and pushes the tag,
#                                which triggers .github/workflows/release.yml
set -e
v="$1"; mode="$2"
[ -n "$v" ] || { echo "usage: pnpm release <version> [--tag]"; exit 2; }
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "working tree is not clean"; exit 1; }

if [ "$mode" = "--tag" ]; then
  git fetch -q origin main
  git checkout -q main && git merge -q --ff-only origin/main
  got=$(node -p "require('./packages/cli/package.json').version")
  [ "$got" = "$v" ] || { echo "main is at version $got, not $v. Merge the release PR first."; exit 1; }
  git tag -s "v$v" -m "di-doctor v$v"
  git push origin "v$v"
  echo "Tag v$v pushed. The Release workflow will publish it: https://github.com/ahmadnisar-boop/di-doctor/actions"
  exit 0
fi

grep -q "^## \[$v\]" CHANGELOG.md || { echo "CHANGELOG.md has no '## [$v]' section"; exit 1; }
git fetch -q origin main
git checkout -q -b "release/v$v" origin/main
for p in packages/core packages/cli packages/mcp; do (cd "$p" && npm pkg set version="$v"); done
npm pkg set version="$v"
pnpm lint && pnpm test
git add package.json packages/*/package.json
git commit -q -S -m "chore(release): v$v"
git push -u origin "release/v$v"
gh pr create --base main --head "release/v$v" --title "chore(release): v$v" \
  --body "Version bump to $v. After CI passes and this is merged, run: \`pnpm release $v --tag\`."
echo "Release PR opened. After it is merged: pnpm release $v --tag"
