# Partner Integration: thinking-partner

## 1. Why this partner

**Category: C (spec / docs source).** thinking-partner is a standalone reasoning skill (community prompt framework). It contributes:

- **F-119**: GT0–GT5 orientation detection + 7 cognitive operation pairs + 150+ mental models → §29.3

**Gap closed**: v6 §29.3 mandates orientation-detection probes (GT0–GT5) in three review prompts (`requirements-decomposer`, `architecture-review`, `readiness-reviewer`). Without a vocabulary for cognitive orientation states, prompt designers cannot encode mechanism-specific responses. thinking-partner provides the GT0–GT5 model + 7 cognitive operation pairs + reference mental-models catalog.

Findings reference: `repo-extraction-findings.md` lines 907–924, §40 F-119.

## 2. Prerequisites

N/A — spec/docs reference; no installation.

## 3. Source provenance

`thinking-partner` reference (community prompt framework). Pin commit SHA in v6 §40 F-119 row. **No install required**; framework absorbed into v6 §29.3 prompt templates.

## 4. Configuration

N/A — spec/docs reference.

## 5. Adoption points in v6

- **F-119** → **§29.3** (three review prompts — `requirements-decomposer`, `architecture-review`, `readiness-reviewer` — include silent GT0–GT5 orientation-detection probes; mechanism-specific responses encoded in prompt-template branches; diagnosis is never labeled aloud)

## 6. Pattern excerpts

**GT0–GT5 orientation levels** (one-liner each):
- **GT0**: No orientation awareness (inertial)
- **GT1**: Conclusion-preservation (identity fusion — evidence bends to defend conclusion)
- **GT2**: Authority-preservation (fused to role, not conclusion)
- **GT3**: Threat-reduction (physiological state drives discomfort-seeking resolution)
- **GT4**: Completion-seeking (output over accuracy)
- **GT5**: Monitor co-option (defense system locked; counter-evidence triggers more defense)

**7 cognitive operation pairs** (skill is in oscillation, not choosing one pole):
- Decouple / Re-couple
- Differentiate / Integrate
- Match / (no pair — singleton)
- Monitor / Interrupt
- Hold / Resolve
- Compress / Expand

**150+ mental models across 17 disciplines** (categories): general thinking, decision-making, problem-solving, systems, physics, biology, economics, statistics, psychology, communication, creativity, learning, time/resource, game theory, negotiation, resilience, ethics. Source: `model-catalog.md`.

## 7. Gotchas

1. **GT-level mis-classification risk**: GT5 (sticky / locked defense) cannot be addressed via argument; requires external scaffolding only. Arguing content feeds the defense. Prompt branches must detect GT5 silently and shift to scaffold mode, not engage. (findings.md L920; F-119)
2. **7 operation pairs are not exhaustive**: the oscillation skill is the model, not an exhaustive taxonomy. Prompt designers must understand intent (oscillate-between, don't pick one) rather than treat the list as a checklist. (findings.md L916; F-119)
3. **150+ mental models means selection is heuristic**: each discipline pair is curated, not enumerated. Prompt designers must select 2-3 models per session relevant to the task. Auto-injecting all 150+ models is impractical and wastes context tokens. (findings.md L917; F-119)
4. **Prompt template version drift**: 6-step workflow (Understand → Detect → Select → Apply → Challenge → Synthesize) is guidance, not contract. Implementations vary by prompt author; document choices in prompt-template comments. (findings.md L918; F-119)

## 8. Validation

```bash
# 1. Verify §29.3 cites GT0-GT5
grep -nE "GT0|GT1|GT2|GT3|GT4|GT5|orientation.detection" agent-context-orchestrator-mcp-plan-v6.md

# 2. Verify §29.3 references 7 cognitive operation pairs
grep -nE "decouple|differentiate|monitor.*interrupt|compress.*expand" agent-context-orchestrator-mcp-plan-v6.md

# 3. Verify three review prompts include silent probes (no user-facing labels)
grep -E "GT[0-5]|orientation" src/prompts/requirements-decomposer.md \
                            src/prompts/architecture-review.md \
                            src/prompts/readiness-reviewer.md
# Expect: probes present; no user-facing labels of orientation state

# 4. Mental-models catalog reference
grep -n "150.*mental.*model\|model-catalog" agent-context-orchestrator-mcp-plan-v6.md
```

## 9. Operational concerns

- **Spec/docs stability**: thinking-partner is community-maintained; stability not guaranteed. Pin SHA in v6 §40 F-119; re-review per orchestrator minor version.
- **In-tree absorption**: GT0-GT5 framework in `prompts/cognitive/orientation-detection.md`; review prompts at `src/prompts/{requirements-decomposer,architecture-review,readiness-reviewer}.md`.
- **Forward-compatibility**: GT0–GT5 abstract model is stable; mental-models catalog evolves. New models added via deliberate prompt update, not auto-injection.
- **Conformance review per orchestrator minor version**: confirm §29.3 still references GT0–GT5 + 7 pairs + 150+ models reference; refresh prompt branches if upstream framework adds GT6 or new pairs.
- **Promotion**: not applicable — prompt framework, not runtime code.
