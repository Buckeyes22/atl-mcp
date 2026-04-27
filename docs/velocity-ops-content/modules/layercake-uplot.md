---
description: "LayerCake + uPlot patterns: reactive chart boundaries, data shaping, and high-performance rendering rules"
globs: ["src/**/*.svelte", "src/lib/charts/**/*.ts", "src/components/charts/**/*.svelte", "src/components/charts/**/*.tsx"]
alwaysApply: false
---

# LayerCake + uPlot — Stack Module

**Targets:** LayerCake, uPlot
**Appended to base CLAUDE.md when high-performance charts are in use.**

---

## Chart Architecture

1. Treat chart input shaping as a pure data layer. Do not intermingle aggregation, business rules, and rendering details inside the chart component.
2. Keep chart configuration objects typed and centralized so scale, axis, tooltip, and series rules are reviewable.
3. Use LayerCake for declarative composition and uPlot where performance-sensitive rendering matters. Be explicit about which concern each library owns.

## Performance Rules

4. uPlot is chosen for performance. Respect that choice:
   - avoid unnecessary chart destruction/recreation
   - update series data incrementally where possible
   - avoid pushing every upstream reactive change through the full chart lifecycle
5. Precompute expensive aggregations outside the render path.

## Responsiveness and Layout

6. Treat sizing and resize behavior as first-class requirements. A chart that only works at one viewport is incomplete.
7. Keep axes, legends, and tooltip density readable under mobile and small-tablet layouts.

## Data Contracts

8. Name chart series and units explicitly. Avoid “series1/series2” style placeholders in durable code.
9. Keep time-series data aligned and normalized before it reaches the chart adapter.
10. Separate “missing data” from zero values. Do not silently coerce null gaps into zeros unless the spec requires it.

## Testing Guidance

11. Unit-test chart data transforms, scale-domain decisions, and series configuration as pure logic.
12. Snapshot-heavy chart tests are weak by themselves. Prefer assertions on configuration and transformed series data.
13. For interactive charts, test the interaction contract: selected range, hovered datum lookup, filter application, or callback payloads.
