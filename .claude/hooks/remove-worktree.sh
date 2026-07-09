#!/bin/bash
# WorktreeRemove hook: create-worktree.sh が .worktrees/ に作った worktree を削除する
set -euo pipefail

input=$(cat)
repo_path=$(jq -r '.repo_path' <<<"$input")
worktree_path=$(jq -r '.worktree_path' <<<"$input")

branch=$(git -C "$worktree_path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)

git -C "$repo_path" worktree remove "$worktree_path" 2>/dev/null ||
  git -C "$repo_path" worktree remove --force "$worktree_path"

# ブランチはマージ済みの場合のみ削除（未マージのコミットは残す）
if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
  git -C "$repo_path" branch -d "$branch" 2>/dev/null || true
fi
