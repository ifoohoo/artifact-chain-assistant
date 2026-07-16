{
  "name": "{{pluginName}}",
  "version": "{{version}}",
  "description": "Artifact-chain intake, review/repair/batch/audit workflows, diagnostics, and version-lock maintenance helpers.",
  "author": {
    "name": "Artifact Graph Maintainers"
  },
  "license": "Apache-2.0",
  "keywords": ["artifact-graph", "traceability", "codex", "claude-code"],
  "skills": "./skills/",
  "hooks": {},
  "interface": {
    "displayName": "Artifact Chain Assistant",
    "shortDescription": "Artifact-chain context, review workflows, and version-lock maintenance.",
    "longDescription": "Reusable skills for artifact-graph projects, including intake routing, generic artifact review/repair/batch/audit workflows, diagnostics, and version-lock refresh guidance.",
    "developerName": "Artifact Graph Maintainers",
    "category": "Productivity",
    "capabilities": ["Write"],
    "defaultPrompt": [
      "Check where this artifact-chain task should start.",
      "Review a design-spec artifact for traceability and completeness.",
      "Run a batch review on multiple artifacts.",
      "Refresh version locks for my staged changes.",
      "Run artifact-chain doctor for this project."
    ]
  }
}
