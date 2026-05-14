# Power Budget — MVP Design Prototype

A static, dark-themed HTML/CSS prototype that walks through every screen of the
Power Budget MVP. The goal is to make the planned-vs-actual experience tangible
before any code is written, and to nail down the design tokens, components, and
copy that will feed the production implementation.

## How to view

Open `index.html` in any modern browser. No build step, no server, no
dependencies beyond Inter from Google Fonts. Every screen links to every other
screen — start on the landing page and click around. The bottom-line currency
pill, locale switcher, and plan dropdown are wired up with a few lines of
inline vanilla JS to demonstrate the interactions; everything else is plain
HTML with anchor navigation.

## Screen index

- **Auth** — `screens/auth-login.html`, `auth-signup.html`,
  `auth-magic-link.html`, `auth-2fa.html`
- **Onboarding** — `screens/onboarding-{en,uk,ru,pl}.html` (5 steps each)
- **Dashboard** — `screens/dashboard-{en,uk,ru,pl}.html` (the centerpiece —
  same May 2026 personal plan across all four locales, with locale-correct
  number/currency formatting)
- **Plans** — `screens/plans-list.html`, `plan-editor.html`
- **Transactions** — `screens/transactions.html`, `transaction-detail.html`
- **Management** — `screens/bank-connections.html`, `categories.html`,
  `settings.html`

## Design token system

All tokens live as CSS custom properties on `:root` in `styles.css`. They
fall into five groups:

- **Surfaces** (`--bg-base` … `--bg-hover`, `--border`, `--border-strong`) —
  five stacked greys for layered depth on a near-black base.
- **Text** (`--text-primary`, `--text-secondary`, `--text-muted`) — three
  levels, all of which clear WCAG AA against the surfaces they pair with.
- **Accent + status** — one indigo accent (`--accent: #7C84F5`) plus three
  status colours: `--success` green, `--warn` amber, `--danger` red. Each has
  a `*-soft` translucent variant used for badges, banners, and selected
  states. No other hues are introduced anywhere in the system.
- **Spacing** — a 4/8/12/16/24/32/48/64 scale exposed as `--sp-1` … `--sp-16`.
- **Radii + type** — `--r-sm` 6 / `--r-md` 10 / `--r-lg` 16 / `--r-pill` 999,
  and the 12/14/16/18/22/28/36 type scale exposed as `--fs-12` … `--fs-36`.

## Components catalogue

Built once in `styles.css` and reused everywhere:

- Buttons — primary, secondary, ghost, danger, plus `--sm` / `--lg` / `--icon`
  modifiers and an `.icon-btn` square variant.
- Inputs — `.input`, `.select`, `.textarea`, `.input-group` with addon,
  `.toggle`, `.checkbox`, `.radio`.
- Chips — multi-select pills with a checked state used in onboarding and
  filter bars.
- Cards — generic `.card`, plus specialised `.plan-card`, `.bank-card`,
  `.screen-card`, and `.auth-card`.
- Badges — `.badge` with `--accent`, `--success`, `--warn`, `--danger`,
  `--ghost` variants; plus mini `.dot` indicators.
- Progress bars — green &lt;70%, amber 70–100%, red &gt;100%, with an
  `progress-over` overshoot variant that surfaces the "+120 over" pill.
- Tables — `.table` inside `.table-wrap`; supports right-aligned numeric
  columns, hover state, and selected rows. Bulk-action bar is a sibling.
- Tabs — flat underline tabs used on Settings.
- Toggles, avatars, modals, dropdown menus, banners, the searchable picker
  used on transaction detail, and the conic-gradient `.ring` for plan cards.

## Accessibility

- Semantic landmarks (`<header>`, `<main>`, `<nav>`, `<section>`) on every
  screen; the sidebar is wrapped in `<nav aria-label>`.
- Text always meets WCAG AA: primary text (#E8ECF1) on the darkest surface
  (#0E1116) is 13.4:1; secondary (#9CA3B0) clears 5.2:1.
- Visible focus rings on every interactive element via a single `:focus-visible`
  rule, never relying on the browser default.
- Icon-only buttons (sort, history, menu, close) carry `aria-label`s.
- All form controls have labels; the TOTP input group is annotated with
  `aria-label="Verification code"`.
- The currency-pill button and locale switcher are real `<button>`s with
  proper `aria-haspopup` / `aria-expanded`.
- Mobile sidebar collapses to a bottom navigation between 360 and 980px so
  primary navigation stays one tap away.

## Sample data

Everything reuses one canonical dataset: a Polish-context household with PKO
and Wise connected, a May 2026 personal plan, the same eight planned expense
lines (Rent / Groceries / Transport / Eating Out [over budget] / Utilities /
Subscriptions / Health / Gifts), the same merchants (Biedronka, Lidl, Żabka,
Wise, PKO), and the same partner avatars across every screen.
