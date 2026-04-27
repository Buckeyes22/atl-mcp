---
description: "Prettier code formatter: config, ESLint integration, pre-commit formatting"
globs: [".prettierrc", ".prettierrc.*", ".prettierignore"]
alwaysApply: false
---

# Prettier — Stack Module

**Targets:** TypeScript projects using Prettier for code formatting.

---

## L1 — Install

```bash
pnpm add -D prettier eslint-config-prettier
```

---

## L2 — Configure

### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

> `prettier-plugin-tailwindcss` auto-sorts Tailwind classes. Install separately: `pnpm add -D prettier-plugin-tailwindcss`.

### `.prettierignore`

```
dist/
build/
coverage/
.next/
node_modules/
pnpm-lock.yaml
*.generated.ts
*.zod.ts
```

### `package.json` scripts

```json
{
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

### VS Code settings (`.vscode/settings.json`)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

---

## L3 — Verify

```bash
pnpm prettier --check .
```

Expected: "All matched files use Prettier code style!" or a list of files needing formatting.

---

## L4 — Conventions

1. Prettier handles all formatting. Do not configure ESLint formatting rules — they conflict. `eslint-config-prettier` disables them.
2. Never commit unformatted code. The pre-commit hook (`lint-staged`) runs Prettier automatically.
3. Do not override Prettier config per-file with `// prettier-ignore` unless absolutely necessary. Document why.
4. Tailwind class sorting: `prettier-plugin-tailwindcss` must be the LAST plugin in the plugins array.

---

## L5 — Integration

### With ESLint

`eslint-config-prettier` must be the LAST entry in `eslint.config.mjs`. Reference `quality/eslint-rules.md`.

```typescript
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // ... other configs ...

  // Prettier must be last — disables formatting rules
  prettier,
);
```

### With Husky/lint-staged

`"*.{ts,tsx,js,mjs,json,md}": "prettier --write"` in lint-staged config. Reference `quality/pre-commit-hooks.md`.

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings=0 --fix",
      "prettier --write"
    ],
    "*.{js,mjs,cjs,jsx}": [
      "eslint --max-warnings=0 --fix",
      "prettier --write"
    ],
    "*.{json,md,yaml,yml,css,scss}": [
      "prettier --write"
    ]
  }
}
```

### With Tailwind

`prettier-plugin-tailwindcss` sorts classes in `className` props. It reads `tailwind.config.*` automatically to resolve custom utilities.

---

## L6 — Troubleshooting

| Error | Cause | Solution |
|-------|-------|---------|
| ESLint and Prettier conflict | ESLint has formatting rules active | Verify `eslint-config-prettier` is last in config |
| "Ignored unknown option" | Config key not recognized | Check Prettier version — some options added in later versions |
| "No files matching the pattern" | `.prettierignore` excluding too much | Check ignore patterns match intended files |
| Tailwind classes not sorting | Plugin not installed or not in plugins array | `pnpm add -D prettier-plugin-tailwindcss` and add to `.prettierrc` plugins |

---

## Cross-References

- `quality/eslint-rules.md` — ESLint config with `eslint-config-prettier` integration
- `quality/pre-commit-hooks.md` — Husky/lint-staged setup running Prettier on staged files
- `modules/tailwind-shadcn.md` — Tailwind CSS configuration and class sorting
