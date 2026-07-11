{
  "name": "{{pluginName}}",
  "interface": {
    "displayName": "Artifact Chain Assistant"
  },
  "plugins": [
    {
      "name": "{{pluginName}}",
      "source": {
        "source": "local",
        "path": "./adapters/codex"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
