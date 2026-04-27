---
description: "MapLibre GL JS patterns: client-only initialization, style/source layering, and map performance boundaries"
globs: ["src/**/*.svelte", "src/**/*.tsx", "src/**/*.ts", "src/lib/maps/**/*.ts", "src/components/maps/**/*.tsx", "src/components/maps/**/*.svelte"]
alwaysApply: false
---

# MapLibre GL JS — Stack Module

**Targets:** MapLibre GL JS 4.x
**Appended to base CLAUDE.md when interactive maps are in use.**

---

## 0. Setup

- Map rendering is browser-only. Never initialize a map during SSR.
- Isolate MapLibre setup in dedicated map components or hooks/helpers.

## SSR and Client Boundaries

1. Guard all map initialization behind a browser-only lifecycle boundary (`onMount`, client component mount, or equivalent).
2. Do not import or instantiate MapLibre in modules that run during SSR unless the import is dynamically gated.

## Data and Layering

3. Treat styles, sources, and layers as explicit configuration, not inline sprawl inside page components.
4. Keep source IDs and layer IDs stable and deterministic. Dynamic IDs make updates and cleanup fragile.
5. Separate business data transformation from rendering code. Convert raw backend payloads into GeoJSON or typed view models before touching the map instance.

## Performance Rules

6. Avoid re-creating the map instance on every state change. Update sources/layers incrementally.
7. Debounce expensive viewport-driven queries or filter recomputations.
8. Be explicit about large datasets: clustering, tiling, viewport filtering, or server-side aggregation must be chosen intentionally once data volume grows.

## Tokens, Providers, and Assets

9. Keep provider URLs, API keys, and style endpoints in configuration. Never hardcode secrets or brittle environment-specific URLs in map components.
10. Distinguish public tile/style keys from private backend credentials. Public keys still belong in reviewed config, not scattered literals.

## Testing Guidance

11. Unit-test data shaping and layer configuration as pure functions.
12. Do not rely only on full DOM rendering tests for geospatial correctness. The critical assertions are usually:
    - transformed GeoJSON shape
    - selected layer/source config
    - viewport/query decisions
13. Keep imperative map adapter logic thin so it can be smoke-tested without turning every test into a browser integration test.
