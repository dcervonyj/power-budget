# Power Budget — Dashboard Design Options

Ten standalone HTML mockups, each a complete visual language. Same content across all; only styling differs.

Open `index.html` in a browser to browse the gallery with scaled iframe previews.

---

## Option 01 — Editorial / Magazine

**Design vocabulary**

- Typography: Fraunces (serif, 900-weight display) + DM Sans (body)
- Palette: Warm paper `#faf7f2`, terracotta accent `#c8401e`, forest green for success, ink `#1a1008`
- Shape language: No card borders; sections divided by hairline rules and a bold 4px accent top-border
- Spacing rhythm: Very generous — magazine-style breathing room, asymmetric grid
- Signature move: Oversized Fraunces headline for plan name at ~52px, section totals in italic light weight

**Feels like:** A premium personal-finance magazine spread or a Monocle-quality annual report

**Inspirations:** Monocle magazine, Bloomberg Businessweek print layout, Stripe Press

---

## Option 02 — Bento Grid

**Design vocabulary**

- Typography: Inter (400–800), clean and geometric
- Palette: Soft lavender background `#f0eef8`, white cards, violet accent `#7c5cbf`, semantic greens/ambers
- Shape language: 20px border-radius throughout, very soft multi-layer box shadows
- Spacing rhythm: Generous gutters (16px), cards breathe independently
- Signature move: Variable-size tile grid with a large gradient net card (green-to-teal) and a dark savings card for contrast

**Feels like:** A polished iOS/iPadOS app or Apple Keynote slide deck

**Inspirations:** Apple Fitness app, Notion AI features, Raycast for Mac

---

## Option 03 — Neo-Brutalist

**Design vocabulary**

- Typography: IBM Plex Sans (700/900), uppercase section headers
- Palette: Chartreuse yellow `#f5e642` background, black `#0a0a0a`, electric pink `#ff3ea5`, cobalt blue `#1e6bff`, pure green `#00c44f`
- Shape language: Zero border-radius; 3px solid black borders everywhere; hard 4–6px solid drop-shadows (no blur)
- Spacing rhythm: Tight, blocky; visual weight comes from borders not whitespace
- Signature move: Section headers are full black bars with yellow text; every status is a solid colour block tag with black border

**Feels like:** A Figma-era startup that deliberately rejects "pretty" design — raw, confident, memorable

**Inspirations:** Gumroad (2022 rebrand), Linear issue tracker (early beta), Loewy design system

---

## Option 04 — Bloomberg Terminal / Pro Data

**Design vocabulary**

- Typography: IBM Plex Mono throughout — every number, label, and status
- Palette: Deep navy `#060d1a` background, amber `#f5a623` primary, cyan `#00d4ff` secondary, danger red, success green
- Shape language: No radius; 1px borders; tight 1px gridlines between rows; left-border accent on overrun rows
- Spacing rhythm: Ultra-dense; 4–8px vertical padding on rows; every pixel earns its place
- Signature move: Scanline CSS overlay, CRT-style panel headers in all-caps amber, budget utilization shown as a block-character bar (`■■■■■■■□□□`)

**Feels like:** A professional trading terminal or a fintech risk-management tool

**Inspirations:** Bloomberg Terminal, Datadog dashboards, Grafana dark theme

---

## Option 05 — Glassmorphism + Ambient Gradient

**Design vocabulary**

- Typography: Plus Jakarta Sans (300–800); fluid weight hierarchy
- Palette: Deep purple-indigo mesh gradient background; frosted glass cards `rgba(255,255,255,0.10)`; violet accent `#c084fc`; glowing green success; glowing red danger
- Shape language: 20px radius; `backdrop-filter: blur(20–28px)`; glass borders `rgba(255,255,255,0.18)`
- Spacing rhythm: Generous with breathing room; cards float visually above the gradient
- Signature move: Radial ambient gradient background built from 4 overlapping ellipses; neon glow `box-shadow` on progress bars; iridescent gradient logo text; circular "days remaining" orb

**Feels like:** A premium mobile finance app circa 2024 — immersive and atmospheric

**Inspirations:** Arc browser, Revolut app redesigns, iOS 16 lock screen widgets

---

## Option 06 — Linear / Minimal with Personality

**Design vocabulary**

- Typography: Inter (300–700); small but precise; italics for sub-labels
- Palette: Near-black `#0e0e12` background; single violet accent `#8b5cf6`; success green, warn amber, danger red all desaturated to fit the monochrome system
- Shape language: 8–10px radius on cards; hairline 1px borders `#26263a`; bordered row container for expenses
- Spacing rhythm: Tight but not dense; nav tabs in topbar; clear visual hierarchy through font weight alone
- Signature move: Accent-coloured 2px "line" decorators before section headings; small `•` dot markers in section titles; noise texture overlay on body; status dots with CSS glow on the active one

**Feels like:** Linear, Vercel, or Planetscale — developer-tool aesthetic applied to consumer finance

**Inspirations:** Linear (issue tracker), Vercel dashboard, Raycast extensions

---

## Option 07 — Soft Claymorphism / Notion-Warm

**Design vocabulary**

- Typography: Fraunces (serif, headings) + Nunito (800-weight body) — friendly and rounded
- Palette: Warm parchment `#f5f0e8` background, off-white cards, terracotta accent `#e8863a`, forest green, warm amber
- Shape language: 20px radius; neumorphic/claymorphic shadows (`6px 6px 14px rgba(100,70,30,0.12), -2px -2px 8px rgba(255,255,255,0.7)`); inset shadows on progress tracks
- Spacing rhythm: Relaxed, cosy; individual row items have 10px icon backgrounds that feel like physical tiles
- Signature move: Pillowy floating cards with light/shadow depth; emoji icons in rounded coloured tiles; gradient days-blob in terracotta; dark chocolate net card for contrast

**Feels like:** Notion, Things 3, or a friendly personal-finance journal app

**Inspirations:** Things 3, Notion, Bear app

---

## Option 08 — Swiss / International Grid

**Design vocabulary**

- Typography: Inter as Helvetica substitute; strictly weight-based hierarchy (300 for large numbers, 700 for labels); no serif
- Palette: Pure white background, black ink `#111110`, red `#d92b2b` (danger only), forest green (success), amber (warning), blue (progress)
- Shape language: No border-radius (0px everywhere); hairline 1px rules; 2px top border on section headers; no shadows
- Spacing rhythm: Strict grid; column alignment as the primary visual tool; numbers right-aligned
- Signature move: Section headers are 2px black rules with 9px uppercase letter-spaced labels; large 300-weight number display (`font-size: 52px; font-weight: 300`) for the net result; stat row of 4 equal columns at the bottom, separated only by 1px rules

**Feels like:** A Müller-Brockmann poster, or the UX of a serious institutional finance product

**Inspirations:** Swiss International Typographic Style, Stripe invoices, Edward Tufte data visualisation

---

## Option 09 — Cyberpunk / Synthwave

**Design vocabulary**

- Typography: VT323 (pixel/terminal font) for headings and numbers; Space Grotesk for body and tags
- Palette: Near-void purple-black `#0d0017` background; neon cyan `#00f5ff` and hot-pink `#ff2d7a` as dual accents; matrix green `#39ff90` for success; danger red with glow
- Shape language: 0px radius; 1px neon-coloured borders; CSS `box-shadow` glow on borders and numbers
- Spacing rhythm: Medium density; section headers are left-bordered accent strips; grid-line background on body
- Signature move: CSS glitch animation on the logo (chromatic-aberration shift in cyan and pink); CRT scanline overlay (`::before` pseudo-element); animated pulse on the live indicator; neon `text-shadow` on all key numbers; `filter: drop-shadow` on SVG sparkline

**Feels like:** A sci-fi hacking tool or a game HUD — aggressively futuristic

**Inspirations:** Cyberpunk 2077 UI, Hackers (1995) aesthetic, synthwave album art

---

## Option 10 — Activity Rings

**Design vocabulary**

- Typography: Inter (300–800); large 800-weight numbers; minimal text
- Palette: Near-black `#0a0a0f` background; six distinct ring colours per expense category (coral, orange, yellow, green, red, sky blue); purple for income rings; teal for savings
- Shape language: 16–18px radius on cards; rings use `stroke-dasharray`/`stroke-dashoffset` SVG technique; concentric layout
- Spacing rhythm: The ring canvas dominates left column; right legend is the data table
- Signature move: Six concentric SVG rings (one per expense category) as the hero data-visualisation element — outside ring = rent (largest budget), inside ring = subscriptions (smallest); over-budget ring glows red with `filter: drop-shadow`; income and savings each get their own smaller ring displays; days-remaining also shown as a ring

**Feels like:** Apple Fitness / Activity app, or a health & wellness tracker repurposed for money

**Inspirations:** Apple Fitness rings, Robinhood portfolio view, Duolingo streak rings

---

## Colour semantics (shared across all options)

| State          | Meaning                                         |
| -------------- | ----------------------------------------------- |
| Green          | Fully received / within budget / complete       |
| Amber / Orange | Approaching limit (80–99%) / partially received |
| Red            | Over budget / zero received (danger)            |
| Blue / Violet  | Neutral progress / accent / in-progress         |
| Muted / Grey   | Pending / not started                           |
