# @power-budget/core

Shared pure-TypeScript package consumed by `packages/backend`, `packages/web`, and `packages/mobile`.

## What lives here

- **Domain types** — entity interfaces, value objects, branded IDs (filled in by BE-003, BE-004)
- **Pure logic functions** — `computePlanActuals`, `computeLeftover`, `convertMoney`, etc. (filled in by BE-006–BE-009)
- **Locale-aware formatters** — `formatMoney`, `formatDate` (BE-010)

## What NEVER lives here

Per ARCHITECTURE.md §4, this package is **dependency-free at runtime**. The following are banned:

| Banned import | Reason |
|---|---|
| `react`, `react-dom`, `react-native` | Core is framework-agnostic |
| `@nestjs/*` | Core has no framework dependencies |
| `drizzle-orm` | Core has no DB access |
| `axios`, `express`, `fastify` | Core has no I/O |
| `fs`, `path`, `os`, `crypto`, `http`, `https`, `stream`, `buffer` | No Node built-ins |
| `node:*` | No Node-specific APIs |
| `@power-budget/backend`, `@power-budget/web`, `@power-budget/mobile` | Dependency flows inward only |

ESLint enforces this list. `pnpm -F @power-budget/core lint:bans` verifies the ban is working.

## Adding code to core

- New domain types → `src/domain/<area>/index.ts`
- New pure logic functions → `src/logic/index.ts`
- Re-export from the parent barrel (`src/domain/index.ts` or `src/index.ts`) as needed

## Consuming from another package

```bash
pnpm add @power-budget/core@workspace:* -F @power-budget/backend
```

Then `import { ... } from '@power-budget/core'` in your TypeScript.

## Commands

```bash
pnpm -F @power-budget/core build       # emit dist/ (ESM + CJS + .d.ts)
pnpm -F @power-budget/core typecheck   # tsc --noEmit (strict mode)
pnpm -F @power-budget/core lint        # eslint src/
pnpm -F @power-budget/core lint:bans   # verify banned-imports rule is working
pnpm -F @power-budget/core test        # vitest run
```
