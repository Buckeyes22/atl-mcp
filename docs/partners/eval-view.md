# Partner Integration: eval-view

## 1. Why this partner

eval-view is the direct integration partner for v6 §31 (Testing Strategy) and §17.2 (LLM-judged 4-tier verdict). It's a mature, production-grade eval framework (Python primary, Node SDK, 56k SLOC, 67 vitest-compatible tests, CI on Node 20+22+Windows) that provides multi-provider LLM-as-judge with caching, a verdict layer, drift tracking, golden baselines with auto-save + approval workflow, auto-PR from production incidents, a model-drift canary suite, and an MCP server (`evalview mcp serve`) exposing 8 tools.

**Gap closed**: v6 §31 needs a full eval framework. Building one from scratch means implementing multi-provider LLM-as-judge, a deterministic check layer, verdict aggregation, drift detection, golden baseline management, CI integration, and a Slack notifier — each of which is a medium-sized project. eval-view delivers all of it, and its verdict layer (`SAFE_TO_SHIP` / `SHIP_WITH_QUARANTINE` / `INVESTIGATE` / `BLOCK_RELEASE`) is already adopted verbatim into v6 §17.2.

**Alternatives considered**: build in-house (rejected — 2-3 months of work); use LangSmith (rejected — v6 §35.5 unidirectional sync implies we don't want to depend on a tracker for decisions); use Braintrust (rejected — comparable feature set, less MCP-aware). eval-view is the only option surveyed with a first-class MCP server + auto-PR-from-incidents + model-drift canary.

Findings reference: `repo-extraction-findings.md` lines 543–558 (batch 2 write-up), L1270–1271 (§31 refinement), §40 F-046.

## 2. Prerequisites

- Python 3.9+ (eval-view primary runtime).
- Node.js 16+ (for the `@evalview/node-sdk` client and the pytest-alternative CLI flow).
- At least one LLM provider key (Anthropic, OpenAI, Gemini, Grok, or a local Ollama endpoint). Judge cache uses whichever is configured.
- SQLite 3.35+ (used for judge cache + golden store; no server install needed).
- `gh` CLI configured with a repo-write token, if using the `autopr` auto-PR feature.
- Slack webhook URL if using the digest notifier.
- CI system that can run `evalview check` (GitHub Actions, GitLab CI, or equivalent).

## 3. Clone and install

eval-view is vendored as a dependency via PyPI + npm, **not** git-cloned into the orchestrator repo.

```bash
# In the orchestrator repo or a CI worker
pip install "evalview==<PINNED_VERSION>"
# Node SDK (optional, for TS-side helpers)
pnpm add @evalview/node-sdk@<PINNED_VERSION>

# One-time initialization per orchestrator project
cd /path/to/orchestrator-project-under-test
evalview init
# Creates .evalview/ with config.yaml, prompts/, tests/, golden/

# Record the pinned version in v6 §40 F-046 row once chosen.
```

For deployments that want a local eval-view service rather than invoking `evalview check` in CI:

```bash
# Run the MCP server locally
evalview mcp serve --transport stdio
# or
evalview mcp serve --transport http --port 8787
```

The orchestrator's `EVAL_VIEW_API_URL` (v6 §20) points at this server when running in service mode.

## 4. Configuration

### 4.1 Environment variables

Extends v6 §20 env block.

| Var | Required | Default | Example | Notes |
|---|---|---|---|---|
| `EVAL_VIEW_ENABLED` | No | `false` | `true` | Master switch. When false, CI degrades to local-only gates. |
| `EVAL_VIEW_API_URL` | No (CLI mode) / Yes (service mode) | — | `http://localhost:8787` | Only required if orchestrator invokes a running eval-view service; CLI mode shells out to `evalview` binary. |
| `EVAL_VIEW_JUDGE_PROVIDER` | No | auto-detect | `anthropic` | Judge model provider. `auto-detect` orders: Anthropic > OpenAI > Gemini. |
| `EVAL_VIEW_JUDGE_MODEL` | No | provider default | `claude-sonnet-4-6` | Judge model. Overrides provider default. |
| `EVAL_VIEW_FAST_MODEL` | No | provider's Haiku-tier | `claude-haiku-4-5` | Used for cheap checks; saves API cost. |
| `EVAL_VIEW_CACHE_TTL_HOURS` | No | `24` | — | Judge-cache TTL. |
| `EVAL_VIEW_BUDGET` | No | — | `0.50` | Mid-execution circuit-breaker cost cap in USD. |
| `EVAL_VIEW_SLACK_WEBHOOK` | No | — | `https://hooks.slack.com/...` | Enables daily digest notifier. |

### 4.2 Config file overlays

In the orchestrator repo's `.evalview/config.yaml`:

```yaml
# Judge settings
judge:
  provider: ${EVAL_VIEW_JUDGE_PROVIDER:-auto-detect}
  model: ${EVAL_VIEW_JUDGE_MODEL}
  fastModel: ${EVAL_VIEW_FAST_MODEL}
  cacheTtlHours: ${EVAL_VIEW_CACHE_TTL_HOURS:-24}

# Weights (v6 §17 default; override per test)
weights:
  toolAccuracy: 0.30
  outputQuality: 0.50
  sequenceCorrectness: 0.20

# Drift tracking
drift:
  enabled: true
  thresholds:
    weak: 0.02          # 2% slope over history window
    medium: 0.05
    strong: 0.10

# Verdict thresholds (v6 §17.2)
verdict:
  costDeltaHardCap: 0.10     # +10% triggers INVESTIGATE
  staleQuarantineDays: 45
  forbiddenToolsHardFail: true

# Auto-PR from incidents
autopr:
  enabled: false
  ghCliPath: gh
  baseBranch: main
  pathPrefix: tests/regression/

# Slack notifier
slack:
  webhookUrl: ${EVAL_VIEW_SLACK_WEBHOOK}
  digestSchedule: "0 9 * * *"   # 9am daily
```

In the orchestrator's `config.yaml`, v6 §31 pointer only:

```yaml
evals:
  evalView:
    enabled: ${EVAL_VIEW_ENABLED}
    mode: cli                 # cli | service
    apiUrl: ${EVAL_VIEW_API_URL}
    configPath: .evalview/config.yaml
```

## 5. Integration points with the orchestrator

### 5.1 CI gate on merge (v6 §17.2, §31, §31.1)

**Trigger**: every PR. **Data in**: the PR diff plus `.evalview/tests/*.yaml` defining the eval suite for §29 prompts (`project-intake-interview`, `requirements-decomposer`, `jira-story-writer`, `confluence-page-writer`, `readiness-reviewer`, `build-agent-handoff`). **Data out**: `evalview check --format junit --output eval.xml` produces a JUnit-style report with verdict ∈ {`SAFE_TO_SHIP`, `SHIP_WITH_QUARANTINE`, `INVESTIGATE`, `BLOCK_RELEASE`}. **Failure mode**: `INVESTIGATE` or `BLOCK_RELEASE` fails the merge check; `SHIP_WITH_QUARANTINE` allows merge but adds the quarantine badge to the PR.

### 5.2 Readiness validation — verdict layer (v6 §17.2)

**Trigger**: `readiness_validate` tool. **Data in**: the 5-category test framework (UT/IT/ST/PT/E2E) outputs from the §31 suite plus v6 §17.3 weighted checks. **Data out**: eval-view computes the 4-tier verdict and returns it alongside the deterministic 6-category score (v6 §17.1). Both must permit for `READY_FOR_BUILD`.

### 5.3 Drift tracking (v6 §31.1)

**Trigger**: every `evalview check` run. **Data in**: historical check results from `.evalview/history.jsonl`. **Data out**: drift classification {`NONE`, `WEAK`, `MEDIUM`, `STRONG`} and temporal-OLS-slope value. Surfaced in the CI report and the Slack digest. **Failure mode**: `STRONG` drift without a deliberate prompt-version bump emits an `INVESTIGATE` verdict.

### 5.4 Model-drift canary (v6 §31.1)

**Trigger**: scheduled (cron; orchestrator's mgmt API exposes an endpoint to run on demand). **Data in**: zero-judge canary suite at `.evalview/canary/`. **Data out**: log + Slack digest if the configured judge model's outputs deviate from historical norms, which would indicate silent provider model updates. **Failure mode**: drift threshold breach → Slack alert + `INVESTIGATE` next merge.

### 5.5 Auto-PR from production incidents (v6 §31.1)

**Trigger**: `evalview monitor --incidents` detects a new failure in production traces. **Data out**: `evalview autopr --open-pr` creates a regression-test PR via `gh pr create` with the failing trace as a new `.evalview/tests/regression/<incident-id>.yaml`. Deterministic, no LLM. **Failure mode**: `gh` auth missing → logs error, no PR.

## 6. Glue code patterns

Informational, not normative. Implementation belongs to M11.

```ts
// src/evals/evalViewRunner.ts
import { spawn } from "node:child_process";

export interface EvalViewRunner {
  check(opts: { format: "junit" | "json"; outputPath: string }): Promise<EvalViewVerdict>;
  snapshot(opts: { approveGenerated: boolean }): Promise<void>;
  modelCheck(opts: { model: string }): Promise<ModelDriftReport>;
}

export function createEvalViewRunner(config: EvalViewConfig): EvalViewRunner {
  if (!config.enabled) return createDisabledRunner();

  return {
    async check({ format, outputPath }) {
      const proc = spawn("evalview", ["check", "--format", format, "--output", outputPath], {
        env: { ...process.env, EVALVIEW_CONFIG_PATH: config.configPath },
      });
      await waitForExit(proc);
      const report = await readEvalViewReport(outputPath);
      return report.verdict;
    },
    async snapshot({ approveGenerated }) {
      const args = ["snapshot"];
      if (approveGenerated) args.push("--approve-generated");
      await spawnAndWait("evalview", args);
    },
    async modelCheck({ model }) {
      const output = await spawnAndCapture("evalview", ["model-check", "--model", model]);
      return JSON.parse(output);
    },
  };
}

// src/workflows/validationWorkflow.ts (relevant excerpt)
async function validateReadiness(projectId: string, deps: Deps): Promise<ReadinessReport> {
  const deterministicScore = await deps.caliberScorer.score(projectId);  // v6 §17.1
  const evalViewVerdict = await deps.evalView.check({ format: "json", outputPath: tmpPath });

  const readyForBuild =
    (deterministicScore.grade === "A" || (deterministicScore.grade === "B" && obligations.includes("requireHumanReview"))) &&
    (evalViewVerdict === "SAFE_TO_SHIP" || evalViewVerdict === "SHIP_WITH_QUARANTINE");

  return { deterministicScore, evalViewVerdict, readyForBuild };
}
```

## 7. Gotchas

1. **Judge cache key derivation is conservative**: key = `hash(test_name, query, output, criteria)`. Whitespace-only changes in `output` miss the cache. This is intentional (safer than stale-cached results) but inflates cost when iterating on a prompt. Use the `--no-cache` flag during prompt-tuning runs. (eval-view docs; findings.md L~556)
2. **Quarantine staleness threshold is hardcoded at 45 days in some code paths**. Configure via `verdict.staleQuarantineDays` (§4.2 above); do not rely on changing it without grepping for the constant. (findings.md L~558)
3. **Auto-heal never applies to forbidden-tool violations, cost spikes, or score improvements.** These escalate to human review even when apparently benign (e.g., "score improvement" might be an intentional tightening; still requires review). (findings.md L~558)
4. **Health of the judge-cache SQLite is invisible unless you run `evalview doctor`.** Schedule it weekly; cache corruption silently recomputes without signaling.
5. **Model-drift canary requires a separate provider key** if you want to canary a specific model without affecting the main judge provider. Configure distinct `EVAL_VIEW_CANARY_PROVIDER` + `EVAL_VIEW_CANARY_MODEL` (not shown in §4.1 because optional).
6. **`pnpm test` in the orchestrator must not call `evalview check` directly**; run it in a separate CI step after unit/integration tests pass. eval-view calls real LLM APIs and costs money — keep the fast-feedback loop LLM-free. (Intent of v6 §31: fast tests first, evals as a distinct quality gate.)
7. **The `@evalview/node-sdk` SDK is optional.** CLI invocation via `spawn` is the recommended pattern for the orchestrator because it decouples Node versions and reduces cross-version breakage. Use the SDK only when embedding in a long-running service (the mgmt API on port 3001 is one candidate).

## 8. Validation

```bash
# 1. Judge provider reachable
evalview doctor --check-provider
# Expect: "Provider <X> reachable; judge-model latency <N>ms"

# 2. Minimal eval suite
mkdir -p .evalview/tests
cat > .evalview/tests/smoke.yaml <<'EOF'
name: smoke-test
input: "What is 2+2?"
expected:
  output: "4"
thresholds:
  min_score: 0.9
EOF
evalview check --format json --output smoke-result.json
# Expect: verdict = SAFE_TO_SHIP

# 3. Model-drift canary baseline
evalview canary baseline --model "$EVAL_VIEW_JUDGE_MODEL"
# Creates .evalview/canary/baseline-<model>.json

# 4. Run canary
evalview model-check --model "$EVAL_VIEW_JUDGE_MODEL"
# Expect: drift = NONE on first run after baseline

# 5. Orchestrator-side integration
orchestrator cli readiness validate --project-id smoke
# Expect: evalViewVerdict present in output; readyForBuild = true for a clean project
```

## 9. Operational concerns

- **Version pinning policy**: pin eval-view to a specific PyPI version. Upgrades require re-running §8 validation and re-baselining any model-drift canary. Minor version bumps are usually safe; verdict-layer semantics are stable.
- **Upgrade path**: on upgrade, (a) bump pin, (b) `evalview doctor`, (c) review any new default checks in the changelog, (d) re-approve goldens if the upgrade changed judge prompting.
- **Ownership**: orchestrator team owns `.evalview/tests/`, `.evalview/canary/`, `.evalview/golden/`, and the CI integration. eval-view maintainers own the runner itself. Joint ownership of the judge-cache schema.
- **Cost management**: set `EVAL_VIEW_BUDGET` to a per-run ceiling (USD). Run evals on every PR but use `--fast-model` for statistical passes; reserve the full judge model for `main`-merging PRs. The judge cache reduces repeat cost by ~80% in statistical mode per eval-view's docs.
- **Partner repo archived/abandoned scenario**: eval-view is an active OSS project. If it's abandoned, the orchestrator's abstraction (`EvalViewRunner` interface, §6 above) isolates the change. Alternatives to migrate to: LangSmith (loses MCP-native path), Braintrust (loses auto-PR feature), or a homegrown runner using the same verdict layer (most of v6 §17.2 is replicated outside eval-view).
- **Disaster recovery**: `.evalview/` is a regular directory — backed up with the repo. Golden baselines are git-tracked; judge cache is regenerable.
