#!/bin/bash
# Bump every package to <version>, check the changelog, make a signed release commit and tag.
# Usage: pnpm release 0.2.0   (then: git push && git push origin v0.2.0)
set -e
v="$1"
[ -n "$v" ] || { echo "usage: pnpm release <version>"; exit 2; }
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "working tree is not clean"; exit 1; }
grep -q "^## \[$v\]" CHANGELOG.md || { echo "CHANGELOG.md has no '## [$v]' section"; exit 1; }
for p in packages/core packages/cli packages/mcp; do (cd "$p" && npm pkg set version="$v"); done
npm pkg set version="$v"
pnpm lint && pnpm test
git add package.json packages/*/package.json
git commit -q -S -m "chore(release): v$v"
git tag -s "v$v" -m "di-doctor v$v"
echo "Tagged v$v. Push with: git push && git push origin v$v"
