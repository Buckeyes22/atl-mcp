# Husky hooks

This directory holds atl-mcp's git-hook orchestration. Lifted from
`velocity-ops-engine/.husky/` per
[`docs/velocity-ops-port-plan.md`](../docs/velocity-ops-port-plan.md) Phase 0.3.

## What runs on `pre-commit`

In order:

1. **`npm run lint:no-stdout`** — F-031 invariant; no `console.*` in `src/`.
2. **`npm run lint:anti-stub`** — F-002 invariant; scans for stub markers (`not implemented`, `TODO`, `placeholder return`, etc.).
3. **`npm run typecheck`** — TypeScript strict-mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
4. **`npm run lint:semgrep`** — runs `semgrep/stub-detection.yml` against staged source files. Warn-skip if `semgrep` isn't on PATH.
5. **Large-file gate** — blocks any staged file over 1 MiB.

## Activating these hooks

The repo is not yet a git repository (per the conversation that landed
this scaffold). When it becomes one:

```sh
git init
npm install --save-dev husky
npx husky init
# Replace the husky-generated .husky/pre-commit with the one already in this dir.
chmod +x .husky/pre-commit
```

Then any `git commit` runs the gate above.

## Adding more checks

Each check is a one-liner in `pre-commit`. Order them so cheap checks
(syntax / typecheck) run before expensive ones (semgrep). Anything that
can't fail-fast on a single file should not be in `pre-commit` — promote
it to CI instead.
