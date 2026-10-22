# Contributing

Thank you for helping improve this project.

## Propose a change

This repository provides a published release snapshot. Changes are made in the source workspace by maintainers, and this repository is regenerated from that source. If you encounter a bug, have a feature request, or notice a documentation issue, open an issue here. Include the observed behavior and a minimal, reproducible example. Direct edits to generated files in this repository may be overwritten in the next release. Opening an issue does not require access to the source workspace.

## Verify the distributed package

Public CI runs on Node.js `22.22.2`, within the supported range `>=22.22.2 <23`. It validates the distributed files by checking for drift in generated content and ensuring all published resources are intact. After packaging, it installs the tarball built from this checkout in a clean consumer environment and exercises the package's public entry points and resources. Verification includes CLI command execution, ESM and CJS imports, and checks of public schema resources. The assistant checks its generated resources and runs its consumer doctor against the declared compatible Graph version. Native dependencies are installed using their standard scripts.

This snapshot does not include full development sources, tests, or the dependency lockfile. Do not run `pnpm build`, `pnpm test`, or `pnpm typecheck` in this repository. These checks are performed in the source workspace. Public CI does not rebuild or repair distributed files before validation.

## License

Keep proposed changes focused. By contributing, you agree that your contribution is licensed under the Apache-2.0 license.
