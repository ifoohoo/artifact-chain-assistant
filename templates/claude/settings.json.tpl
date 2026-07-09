{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'if [ ! -f artifact-graph.config.yaml ] && [ ! -f artifacts/traceability-version-lock.json ]; then exit 0; fi; if [ -x ./node_modules/.bin/artifact-graph ]; then exec ./node_modules/.bin/artifact-graph version-lock audit --strict-missing-lock; fi; if command -v artifact-graph >/dev/null 2>&1; then exec artifact-graph version-lock audit --strict-missing-lock; fi; if [ -n \"${ARTIFACT_GRAPH_LEGACY_CLI:-}\" ] && [ -f \"$ARTIFACT_GRAPH_LEGACY_CLI\" ]; then exec node \"$ARTIFACT_GRAPH_LEGACY_CLI\" version-lock audit --strict-missing-lock; fi; echo \"artifact-chain-assistant: artifact-graph CLI not found; install it in the project or PATH\" >&2; exit 127'"
          }
        ]
      }
    ]
  }
}
