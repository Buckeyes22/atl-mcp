---
description: "Firebase patterns: Auth, Firestore, Storage, and Cloud Functions boundary rules"
globs: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.svelte", "firebase.json", "firestore.rules", "functions/**/*.ts", "functions/**/*.js"]
alwaysApply: false
---

# Firebase — Platform Module

**Targets:** Firebase Auth, Firestore, Storage, Cloud Functions
**Appended to base CLAUDE.md when Firebase is in use.**

---

## Boundary Rules

1. Separate client SDK usage from privileged admin/backend usage.
2. Treat Firebase security rules as first-class policy artifacts, not an afterthought.
3. Keep Firestore document shape and indexing strategy explicit. Schemaless does not mean structureless.

## Auth and Data Access

4. Authentication state is not authorization by itself. Model role and access decisions explicitly.
5. Do not trust client-provided claims or role flags unless they are derived from reviewed server/admin flows.

## Firestore and Functions

6. Keep document size, fan-out, and hot-document risks in mind when modeling collections.
7. Cloud Functions should remain thin adapters around reviewed domain logic, just like other backend handlers.

## Testing

8. Test security-rule assumptions, auth boundary behavior, and critical document transitions.
