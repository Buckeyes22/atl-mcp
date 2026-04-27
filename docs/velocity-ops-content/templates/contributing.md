# Contributing Guide

---

## 1. Workflow

### For Team Members

1. **Claim work** — Pick a spec from the backlog or get assigned one
2. **Create a branch** — `feature/{SPEC-ID}-{description}` or `fix/{SPEC-ID}-{description}` (see git-branching.md for full conventions)
3. **Implement** — Follow the development protocol and the spec's technical approach
4. **Verify** — Run typecheck, lint, test, build. All must pass.
5. **Open a pull request** — PR must reference the spec ID and meet Definition of Done
6. **Address review** — Resolve all review comments. Do not merge with open threads.
7. **Merge** — Squash merge to main after approval

### For AI Agents

- One branch per task. One worktree per agent when running in parallel.
- Branch naming: `ai/[agent-id]/[task-slug]`
- Follow the same verification gates as human contributors
- Cite stack references and context sources in review responses
- Document shared file changes needed — do not modify shared files directly
- Respect file protection metadata (`.important_files.json`, `.donttouch_files.json`, `.redacted_files.json`)
- Consult `.ai/troubleshooting.md` before debugging known error patterns
- Set `export AGENT=1` before running commands — enables structured error output

---

## 2. Commit Conventions

> **Canonical source:** See CLAUDE.md Section 8 for full commit format, types, and PR conventions.

### Types

| Type | When |
|------|------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `docs` | Documentation changes |
| `chore` | Build process, tooling, dependency updates |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |

---

## 3. Pull Request Requirements

### Before Opening

- [ ] All acceptance criteria from the spec have passing tests
- [ ] `typecheck` passes with zero errors
- [ ] `lint` passes with zero warnings
- [ ] `test` passes — all green
- [ ] `build` succeeds
- [ ] No TODO/FIXME/STUB comments in new code
- [ ] No `any` types in new code
- [ ] PR description references the spec ID

### PR Description Template

```
## Spec

[SPEC-{DOMAIN}-{FEAT}-{NN}]: [Title]

## Changes

- [What changed and why]

## Test Coverage

- [ ] Unit tests
- [ ] Integration tests
- [ ] Security tests (if applicable)
- [ ] Performance tests (if applicable)
- [ ] E2E tests (if applicable)

## Review Notes

[Anything reviewers should pay attention to]
```

### Review Criteria

Reviewers check:
1. Acceptance criteria are met (not just "code looks reasonable")
2. Tests verify behavior, not implementation
3. Layer separation is maintained
4. Stack references were consulted
5. No scope creep beyond the spec

---

## 4. Dependency Management

> See CLAUDE.md Section 11 for dependency request protocol in multi-agent workflows.

### Adding Dependencies

New dependencies require justification:

| Field | Value |
|-------|-------|
| Package | [name@version] |
| Purpose | [Why it's needed] |
| Alternatives considered | [What else was evaluated] |
| License | [License type — must be compatible] |
| Bundle size impact | [Approximate size added] |
| Maintenance status | [Active / Maintained / Unmaintained] |

### Prohibited

- Do not install dependencies without documenting the justification
- Do not add dependencies that duplicate existing functionality
- Do not add dependencies with incompatible licenses
- Do not add dependencies that are unmaintained (no commits in 12+ months without a stability justification)

---

## 5. Code of Conduct

- Be constructive in code reviews — critique code, not people
- Ask questions when requirements are unclear — do not guess
- Document decisions so future contributors have context
- Keep commits atomic — one logical change per commit
