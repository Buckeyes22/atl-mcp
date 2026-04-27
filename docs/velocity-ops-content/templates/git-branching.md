# Git Branching Strategy

Status: [Draft | Active]
Last updated: YYYY-MM-DD

---

## 1. Branch Model

```
main (production)
 ├── feature/{SPEC-ID}-{short-description}
 ├── fix/{SPEC-ID}-{short-description}
 ├── docs/{description}
 ├── chore/{description}
 └── ai/{agent-id}/{task-slug}
```

---

## 2. Branch Naming Conventions

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feature/` | New functionality tied to a spec | `feature/AUTH-001-password-validation` |
| `fix/` | Bug fixes (include spec ID if applicable) | `fix/AUTH-001-password-hash-timing` |
| `docs/` | Documentation-only changes | `docs/update-api-standards` |
| `chore/` | Tooling, config, dependency updates | `chore/upgrade-vitest-2` |
| `ai/` | AI agent work (multi-agent coordination) | `ai/implementer/auth-refresh-token` |

---

## 3. Rules

### Feature Branches

- **One branch per spec/task.** No bundling multiple specs into one branch.
- Branch from `main`, merge back to `main` via pull request.
- `git diff main...HEAD` should show ONLY changes related to the spec.

### Commit Messages

Reference spec ID in every commit:

```
<type>(<scope>): <subject>

<body — what changed and why, not how>

<footer — breaking changes, issue refs>
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`

**Rules:**
- Subject: imperative mood, ≤72 chars, no period at end.
- Body: explain the why. The diff explains the what.
- Breaking changes: `BREAKING CHANGE:` footer.
- Example: `feat(AUTH-001): add password length validation`

### PR Requirements

- All quality gates must pass (lint, typecheck, test, build)
- Tests committed in same PR as feature code
- Use PR template (includes AI attribution section if applicable)
- Squash merge to keep `main` history clean

---

## 4. Workflow

### Human Developer

1. Create feature branch: `git checkout -b feature/{SPEC-ID}-{description}`
2. Implement in small commits within the branch.
3. Before PR: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
4. Push and create PR with spec reference.
5. After merge, delete feature branch.

### AI Agent

1. Create feature branch: `git checkout -b ai/{agent-id}/{task-slug}`
2. Implement in small, atomic commits.
3. Before PR: run full quality gate suite.
4. Push and create PR with spec reference.
5. After merge, delete feature branch.

### Multi-Agent Coordination

- Branch naming: `ai/[agent-id]/[task-slug]`
- Wave-based execution: Wave 1 (independent) → Wave 2 (depends on Wave 1) → Wave 3 (integration)
- Merge order: Wave 1 first. Wave 2 rebases on updated main.
- Owned files: agents only modify files listed in their task specification.
- Shared files: document needed changes in `.ai/shared-changes.md`; do not modify directly.

---

## 5. Context Management

- Use `/clear` between specs to reset AI agent context.
- Start fresh sessions for each feature branch.
- Never let a single session span multiple features.
- Use `pnpm save-baseline` at the start of each session for diff comparison.

---

## 6. PR Template

```markdown
## Summary
[Brief description of what changed and why]

## Spec Reference
[Link to spec or task file]

## Changes
- [Change 1]
- [Change 2]

## AI Attribution (if applicable)
- [ ] This PR includes AI-generated code
- Agent: [Claude Code / Other]
- Task reference: [path to task file]

## Verification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] `git diff main...HEAD` shows ONLY changes related to the spec
- [ ] No new `any` types
- [ ] No scope creep beyond task specification
```
