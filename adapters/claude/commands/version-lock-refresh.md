---
description: Refresh staged artifact-chain version locks
---

Run this command from the project root, then review and stage the lock file if it changes:

```bash
artifact-graph version-lock refresh --changed-only --staged --format markdown
```
