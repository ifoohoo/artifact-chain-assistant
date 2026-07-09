{
  "name": "{{pluginName}}",
  "version": "{{version}}",
  "description": "Artifact-chain intake, diagnostics, and version-lock maintenance helpers.",
  "author": {
    "name": "Artifact Graph Maintainers"
  },
  "license": "Apache-2.0",
  "keywords": ["artifact-graph", "traceability", "codex", "claude-code"],
  "skills": "./skills/",
  "interface": {
    "displayName": "Artifact Chain Assistant",
    "shortDescription": "Keep artifact-chain context and version locks fresh.",
    "longDescription": "Reusable skills and commands for artifact-graph projects, including intake routing, diagnostics, and version-lock refresh guidance.",
    "developerName": "Artifact Graph Maintainers",
    "category": "Productivity",
    "capabilities": ["Write"],
    "defaultPrompt": [
      "Check where this artifact-chain task should start.",
      "Refresh version locks for my staged changes.",
      "Run artifact-chain doctor for this project."
    ]
  }
}
