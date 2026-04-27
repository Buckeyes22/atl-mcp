---
description: "Flutter patterns: widget boundaries, state ownership, platform channels, and mobile release discipline"
globs: ["lib/**/*.dart", "test/**/*.dart", "pubspec.yaml"]
alwaysApply: false
---

# Flutter — Stack Module

**Targets:** Flutter, Dart
**Appended to base CLAUDE.md when Flutter is in use.**

---

## App Architecture

1. Keep presentation, state management, and service boundaries explicit.
2. Widgets should render and delegate; business logic belongs in reviewed state or domain layers.
3. Choose one state-management approach intentionally per project area instead of mixing patterns casually.

## Platform and Network Boundaries

4. Treat platform channels and native integrations as infrastructure boundaries with typed adapters.
5. Keep API contracts, offline behavior, and auth state transitions explicit.

## UI and UX

6. Make loading, empty, error, and success states visible in the widget tree.
7. Respect mobile constraints: slow networks, app backgrounding, small screens, and interrupted flows are normal conditions.

## Testing

8. Unit-test domain/state logic separately from widget tests.
9. Widget tests should assert user-visible behavior and key state transitions, not private implementation details.
