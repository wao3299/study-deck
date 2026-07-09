#!/bin/bash
# WorktreeCreate hook: worktree をデフォルトの .claude/worktrees/ ではなく .worktrees/ に作成する
set -euo pipefail

input=$(cat)
repo_path=$(jq -r '.repo_path' <<<"$input")
base_ref=$(jq -r '.base_ref // empty' <<<"$input")
worktree_name=$(jq -r '.worktree_name' <<<"$input")

worktree_path="$repo_path/.worktrees/$worktree_name"
mkdir -p "$(dirname "$worktree_path")"

# git の出力は stderr へ逃がし、stdout には worktree の絶対パスだけを返す（hook の契約）
if [ -n "$base_ref" ]; then
  git -C "$repo_path" worktree add -b "$worktree_name" "$worktree_path" "$base_ref" 1>&2
else
  git -C "$repo_path" worktree add -b "$worktree_name" "$worktree_path" 1>&2
fi

echo "$worktree_path"
