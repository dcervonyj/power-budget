# @power-budget/design-tokens

The single source of truth for all design tokens in the Power Budget app.
Both web (CSS custom properties) and React Native (flat JS object) outputs are generated from the TypeScript source.

## Token categories

| Category | Prefix | Example |
|---|---|---|
| Colours | `--pb-color-` | `--pb-color-surface-base` |
| Spacing | `--pb-space-` | `--pb-space-md` (12 px) |
| Radius | `--pb-radius-` | `--pb-radius-pill` (999 px) |
| Font size | `--pb-font-size-` | `--pb-font-size-lg` (18 px) |
| Font weight | `--pb-font-weight-` | `--pb-font-weight-semibold` |
| Font family | `--pb-font-family-` | `--pb-font-family-sans` |
| Line height | `--pb-line-height-` | `--pb-line-height-normal` |

## Usage — Web

```css
.my-button {
  background: var(--pb-color-accent-default);
  color: var(--pb-color-accent-on-accent);
  padding: var(--pb-space-sm) var(--pb-space-lg);
  border-radius: var(--pb-radius-md);
}
```

## Usage — React Native

```tsx
import { rnDarkTheme } from '@power-budget/design-tokens/rn';

const styles = StyleSheet.create({
  button: {
    backgroundColor: rnDarkTheme.colorAccentDefault,
    padding: rnDarkTheme.spaceSm,
    borderRadius: rnDarkTheme.radiusMd,
  },
});
```

## Adding a new token

1. Add the value to `src/tokens.ts` in the correct category.
2. Run `pnpm --filter @power-budget/design-tokens build` to regenerate.
3. Update `rn.ts` if the token should be available in RN.
4. Run `pnpm test --update` to update snapshots.

## ESLint rule

`no-hex-outside-tokens` bans raw hex colour literals outside this package.
Enable it in your ESLint config:

```js
const noHexOutsideTokens = require('./packages/design-tokens/eslint-rules/no-hex-outside-tokens');
```
