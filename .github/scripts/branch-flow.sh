#!/usr/bin/env bash
# Enforces the branching model from the workspace CONTRIBUTING.md:
# task branches -> develop -> main. This repository has no staging branch
# (GitHub Pages serves a single site), so main accepts PRs only from develop.
#
# Inputs come only from the environment (BASE_REF, HEAD_REF, TASK_KEY); the
# workflow passes them via env and never interpolates them into the script, so
# branch names cannot inject shell code. TASK_KEY is the task key
# (project.json -> project_key in the workspace); while it is empty any
# upper-case key is accepted. Copied from presets/ci/_shared/ of the workspace
# template and changed for develop -> main.
set -euo pipefail

BASE_REF="${BASE_REF:-}"
HEAD_REF="${HEAD_REF:-}"
TASK_KEY="${TASK_KEY:-}"

if [ -z "$TASK_KEY" ]; then
  key_re='[A-Z][A-Z0-9]*'
  key_hint='<KEY>'
elif [[ "$TASK_KEY" =~ ^[A-Z][A-Z0-9]*$ ]]; then
  key_re="$TASK_KEY"
  key_hint="$TASK_KEY"
else
  echo "::error title=Branch flow::TASK_KEY '$TASK_KEY' is not a task key (upper-case letters and digits)."
  exit 1
fi

task_re="^(feature|fix|refactor|style|test|info)/${key_re}-[0-9]+/[a-z0-9-]+$"

fail() {
  echo "::error title=Branch flow::PR '$HEAD_REF' -> '$BASE_REF' is not allowed. $1"
  exit 1
}

case "$BASE_REF" in
  develop)
    [[ "$HEAD_REF" =~ $task_re ]] ||
      fail "Into develop only task branches: <feature|fix|refactor|style|test|info>/${key_hint}-<number>/<kebab-case-description>."
    ;;
  main)
    [ "$HEAD_REF" = "develop" ] || fail "Into main only from develop."
    ;;
  *)
    echo "Base '$BASE_REF' is not a long-lived branch; direction check skipped."
    exit 0
    ;;
esac

echo "OK: '$HEAD_REF' -> '$BASE_REF' follows the branching model."
