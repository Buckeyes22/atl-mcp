---
description: "Structured decision reasoning with 150+ mental models, orientation detection, and assumption challenging for high-stakes development decisions"
globs: [".ai/decisions.md", "*.adr.md"]
alwaysApply: false
---

# Thinking Partner — Decision Reasoning Module

**Targets:** Any project where architectural decisions, scope choices, risk assessments, or complex tradeoffs require structured reasoning before code is written.

---

## When to Use

This module activates during framework decision points that benefit from structured reasoning:

- **Confidence gate (70-89%)** — alternatives need rigorous tradeoff analysis
- **Brainstorming approaches** — choosing between 2-3 design options
- **ADR authoring** — architectural decisions with long-term consequences
- **Scope decisions** — YAGNI boundaries, what to include vs cut
- **Risk assessment** — security, data migration, deployment strategy
- **Post-incident analysis** — why something failed, root cause determination

## Model Selection Quick Reference

| Decision Type | Start With |
|--------------|-----------|
| Build vs buy | First Principles, Opportunity Cost, Switching Costs |
| Architecture choice | Chesterton's Fence, Second-Order Thinking, Reversibility Test |
| Feature scope | Via Negativa, Satisficing vs Maximizing, Pareto Principle |
| Security posture | Pre-Mortem, Red Team, Margin of Safety, Asymmetric Risk |
| Deploy strategy | Reversibility Test, Barbell Strategy, Canary/Blue-Green |
| Dependency choice | Lindy Effect, Switching Costs, Principal-Agent Problem |
| Performance tradeoff | Amdahl's Law, Pareto, Local vs Global Optima |

## Orientation Detection for AI Agents

Watch for these states in AI reasoning — they indicate the AI has stopped truth-seeking:

| State | AI Signal | Intervention |
|-------|----------|-------------|
| GT1 (conclusion-preserving) | AI picked an approach and is defending it despite evidence | "What would have to be true for the other approach to win?" |
| GT4 (completion-seeking) | AI rushing to resolution without proportionate analysis | "Before we settle, let me push on this from one angle" |
| GT5 (monitor co-option) | Elaborate analysis that always confirms the same conclusion | "What prediction does this approach make that we could verify?" |

## Integration Points

### With Brainstorming Skill
When brainstorming proposes 2-3 approaches, apply:
1. **Inversion** on each approach: "How would this fail?"
2. **Second-Order Thinking**: "What happens after the first effect?"
3. **Opportunity Cost**: "What does choosing A mean giving up from B?"

### With Confidence Gate
When confidence is 70-89%:
1. **Bayesian Updating**: "What evidence would shift this to 90%?"
2. **Asymmetric Risk**: "Is the downside capped and upside uncapped?"
3. **Reversibility Test**: "Can we undo this if we're wrong?"

### With Post-Incident Flow
When tracing backward from a production bug:
1. **5 Whys**: Iterative root cause drilling
2. **Counterfactual Thinking**: "What if this one variable had been different?"
3. **Survivorship Bias**: "Are we only looking at what broke, not what almost broke?"

## Installation

The thinking-partner skill is available as a Claude Code plugin:

```bash
npx skills add mattnowdev/thinking-partner
```

Or copy the skill directory manually:
```bash
cp -r thinking-partner/skills/thinking-partner ~/.claude/skills/thinking-partner
```

## Reference

- Agent definition: `agents/thinking-partner.md`
- Source: [mattnowdev/thinking-partner](https://github.com/mattnowdev/thinking-partner)
