---
status: accepted
date: 2026-04-26
deciders: [orchestrator-team]
consulted: [vcs-integrators]
informed: [build-agents, operators]
---

# 0009. GitHub v1 extension after Bitbucket parity

## Context

The v5/v6 plan names Bitbucket Cloud as the first VCS provider. The provider interface was deliberately shaped for Bitbucket, GitHub, and GitLab, but only Bitbucket had a concrete REST adapter. Real orchestrator use also needs GitHub as a first-class provider because many target repos and build-agent workflows already live there.

## Decision Drivers

- Finish Bitbucket parity rather than replacing it.
- Add GitHub without changing the `VcsProvider` contract in a way that blocks GitLab later.
- Keep live provider tests opt-in so CI remains deterministic.
- Reuse the same provisioning, trace-link, and webhook signature semantics across providers.

## Considered Options

1. **Bitbucket only for v1.** Matches the earliest plan, but prevents immediate real-world use where GitHub is required.
2. **Replace Bitbucket with GitHub.** Simplifies provider count, but discards planned Bitbucket parity and breaks existing tests/docs.
3. **Keep Bitbucket and add GitHub under the same interface.** Increases provider surface, but preserves the contract and broadens v1 usefulness.

## Decision Outcome

Adopt option 3.

Bitbucket Cloud remains the parity target. GitHub is added as the first real-use VCS extension under the existing `VcsProvider` contract and is selected with `VCS_PROVIDER=bitbucket|github`. GitLab stays out of this slice, but the provider interface remains broad enough for a future GitLab adapter.

GitHub support covers repository discovery, branch creation, file upsert, pull request create/update/read, provider health, and GitHub hub-style webhook signature verification through the common webhook verifier.

## Consequences

### Positive

- The orchestrator can provision against both Bitbucket Cloud and GitHub using the same workflow contract.
- Provider contract tests can be shared and live tests can stay gated by environment variables.
- Future GitLab work does not require a provider interface redesign.

### Negative

- Provider-specific REST differences remain inside adapters and need dedicated tests.
- Repository creation has provider-specific ownership semantics; GitHub org/user creation paths may require additional operator configuration in production.

### Neutral

- `workspace` remains the provider-neutral owner namespace in `VcsProvider`; for GitHub it maps to the org or user owner.

## More Information

- `src/providers/vcs/VcsProvider.ts`
- `src/providers/vcs/bitbucket/bitbucketRestProvider.ts`
- `src/providers/vcs/github/githubRestProvider.ts`
- `tests/integration/providers/vcs/`
