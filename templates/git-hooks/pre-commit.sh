#!/bin/sh
set -u

artifact_graph() {
  if [ -x ./node_modules/.bin/artifact-graph ]; then
    ./node_modules/.bin/artifact-graph "$@"
    return $?
  fi
  if command -v artifact-graph >/dev/null 2>&1; then
    artifact-graph "$@"
    return $?
  fi
  if [ -n "${ARTIFACT_GRAPH_LEGACY_CLI:-}" ] && [ -f "$ARTIFACT_GRAPH_LEGACY_CLI" ]; then
    node "$ARTIFACT_GRAPH_LEGACY_CLI" "$@"
    return $?
  fi
  echo "artifact-chain-assistant: artifact-graph CLI not found; install it in the project or PATH." >&2
  return 127
}

# Detect if config or spec boundary files are staged
staged_files=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
config_staged=0
for f in $staged_files; do
  case "$f" in
    artifact-graph.config.yaml|*/artifact-graph.config.yaml)
      config_staged=1
      break
      ;;
  esac
done

if [ "$config_staged" -eq 1 ]; then
  artifact_graph version-lock refresh --all --format markdown || exit $?
else
  artifact_graph version-lock refresh --changed-only --staged --format markdown || exit $?
fi

if ! git diff --quiet -- artifacts/traceability-version-lock.json; then
  echo "artifact-chain-assistant: 版本锁刷新成功，但更新后的锁文件尚未进入本次提交。" >&2
  echo "这不是校验失败，只需把新锁纳入提交：" >&2
  echo "  1. 审查锁变更:  git diff artifacts/traceability-version-lock.json" >&2
  echo "  2. 暂存锁文件:  git add artifacts/traceability-version-lock.json" >&2
  echo "  3. 重新提交:    git commit" >&2
  exit 1
fi
