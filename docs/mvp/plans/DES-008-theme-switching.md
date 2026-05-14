# DES-008 — Light / Dark Theme Switching (Implementation Plan)

## 1. Task summary

- **ID**: DES-008
- **Title**: Light / Dark Theme Switching — toggle, persistence, no-FOUC
- **Area**: Design
- **Effort**: S (~1d)
- **Blocked by**: DES-001 (tokens + CSS variables), DES-002 (ThemeToggle component)
- **Blocks**: WEB-005 (Auth screens — needs toggle in layout), MOB-005 (mobile auth — needs ThemeProvider)

**Context.** The Arctic design system (`docs/mvp/design-arctic/`) proves out light/dark theming in the static
HTML prototypes. Both themes are first-class MVP features (see DES-001). This task wires the runtime
switching mechanism into the actual React web app and React Native mobile app.

The switching pattern is already validated in the prototypes and is deliberately minimal:
- **Web**: `data-theme="dark"|"light"` attribute on `<html>`; CSS custom properties do the rest.
- **Mobile**: `ThemeProvider` context swaps the active `RnTheme` object; components call `useTheme()`.
- **Persistence**: `localStorage` on web; `AsyncStorage` on mobile.
- **Default**: system preference (`prefers-color-scheme`) if no saved preference exists.
- **No flash (FOUC)**: inline `<script>` in `index.html` reads `localStorage` and sets `data-theme` before
  the first paint.

---

## 2. Scope

**In scope**

- Web `useTheme()` hook — returns current `Theme` object and a `setTheme(name)` function.
- Web `ThemeToggle` button component — single-file, uses `useTheme()`, renders sun/moon icon.
- Web no-FOUC inline script in `packages/web/index.html`.
- Web `ThemeProvider` React context wrapper (wraps `<App />` in `packages/web/src/main.tsx`).
- Mobile `ThemeProvider` context (`packages/mobile/src/presentation/ThemeProvider.tsx`) — wraps the root
  navigator; reads `AsyncStorage` for saved preference; falls back to `Appearance.getColorScheme()`.
- Mobile `useTheme()` hook — returns active `RnTheme`.
- Mobile `ThemeToggle` component (tap to toggle, used in Settings screen).
- System preference detection: `prefers-color-scheme` (web) / `Appearance` (RN).

**Out of scope**

- Design token values and CSS variable generation — that is DES-001.
- Component library wiring (beyond the `ThemeToggle` component itself) — every component adopts the tokens
  via `var(--pb-…)` or `useTheme()` as part of its own task.
- Per-screen or per-component dark/light overrides (forced-dark sections etc.) — not needed for MVP.

---

## 3. Files to create / modify

```
packages/web/
├── index.html                                   # Add no-FOUC inline script to <head>
├── src/
│   ├── presentation/
│   │   ├── ThemeProvider.tsx                    # Create — React context, localStorage
│   │   └── components/ui/
│   │       └── ThemeToggle.tsx                  # Create — icon button, calls setTheme()
│   ├── hooks/
│   │   └── useTheme.ts                          # Create — consume ThemeContext
│   └── main.tsx                                 # Modify — wrap <App /> in <ThemeProvider>

packages/mobile/
├── src/
│   ├── presentation/
│   │   ├── ThemeProvider.tsx                    # Create — context, AsyncStorage
│   │   └── components/ui/
│   │       └── ThemeToggle.tsx                  # Create — toggles active theme
│   └── hooks/
│       └── useTheme.ts                          # Create — consume ThemeContext
│   App.tsx (or root navigator)                  # Modify — wrap root in <ThemeProvider>
```

---

## 4. Key interfaces & contracts

### 4.1 `ThemeContext` shape (shared concept, separate implementations)

```ts
interface ThemeContextValue {
  theme: "dark" | "light";
  setTheme: (name: "dark" | "light") => void;
  toggleTheme: () => void;
}
```

### 4.2 Web `ThemeProvider`

```tsx
// packages/web/src/presentation/ThemeProvider.tsx
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    // localStorage already read by inline script; read it here for React state sync.
    return (localStorage.getItem("pb-theme") as "dark" | "light") ?? "dark";
  });

  const setTheme = useCallback((name: "dark" | "light") => {
    document.documentElement.setAttribute("data-theme", name);
    localStorage.setItem("pb-theme", name);
    setThemeState(name);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### 4.3 Web no-FOUC inline script (`index.html`)

```html
<!-- Place immediately after <meta charset> in <head>, before any CSS -->
<script>
  (function () {
    var saved = localStorage.getItem("pb-theme");
    var preferred = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
    document.documentElement.setAttribute("data-theme", saved ?? preferred);
  })();
</script>
```

The script runs synchronously before any CSS is parsed, preventing a flash of the wrong theme on cold
load. It is also the only place system preference is detected — the React `ThemeProvider` initialises from
`localStorage` (which the script has already written on first visit if system preference was used).

### 4.4 Mobile `ThemeProvider`

```tsx
// packages/mobile/src/presentation/ThemeProvider.tsx
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rnDarkTheme, rnLightTheme } from "@power-budget/design-tokens";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<"dark" | "light">("dark");

  useEffect(() => {
    AsyncStorage.getItem("pb-theme").then((saved) => {
      if (saved === "dark" || saved === "light") {
        setThemeNameState(saved);
      } else {
        const sys = Appearance.getColorScheme() ?? "dark";
        setThemeNameState(sys === "light" ? "light" : "dark");
      }
    });
  }, []);

  const setTheme = useCallback(async (name: "dark" | "light") => {
    await AsyncStorage.setItem("pb-theme", name);
    setThemeNameState(name);
  }, []);

  const rnTheme = themeName === "light" ? rnLightTheme : rnDarkTheme;

  return (
    <ThemeContext.Provider value={{ theme: themeName, rnTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### 4.5 `useTheme()` hook (web)

```ts
// packages/web/src/hooks/useTheme.ts
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
```

### 4.6 `ThemeToggle` component (web)

```tsx
// packages/web/src/presentation/components/ui/ThemeToggle.tsx
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="btn btn--ghost btn--icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
```

---

## 5. Step-by-step build order

Each micro-step is ≤20 minutes.

1. **Add no-FOUC inline script** to `packages/web/index.html` (§4.3). This is the only change with no
   React dependencies — ship it first so the web app never flashes the wrong theme.
2. **Create `ThemeContext`** in `packages/web/src/presentation/ThemeProvider.tsx` — define the context,
   the provider, and export `ThemeContext` separately so `useTheme` can import it.
3. **Create `useTheme.ts`** web hook — one-liner wrapper around `useContext(ThemeContext)` with a
   null-guard error.
4. **Wire `ThemeProvider`** in `packages/web/src/main.tsx` — wrap `<App />`.
5. **Create `ThemeToggle.tsx`** web component — sun/moon icon button, calls `toggleTheme()`.
6. **Write web unit tests** — (a) `ThemeProvider` initialises from `localStorage`; (b) `toggleTheme()`
   updates `data-theme` attribute; (c) `setTheme("light")` persists to `localStorage`.
7. **Create mobile `ThemeContext` + `ThemeProvider`** in
   `packages/mobile/src/presentation/ThemeProvider.tsx` — reads `AsyncStorage`, falls back to
   `Appearance.getColorScheme()`, exposes `rnTheme` object.
8. **Create `useTheme.ts`** mobile hook — returns `{ theme, rnTheme, setTheme, toggleTheme }`.
9. **Wire `ThemeProvider`** in `App.tsx` / root navigator.
10. **Create mobile `ThemeToggle`** component — renders in Settings screen sidebar footer.
11. **Write mobile unit tests** — (a) provider loads saved preference from `AsyncStorage`; (b) falls back
    to system preference when no saved value; (c) `setTheme` writes to `AsyncStorage`.
12. **Manual smoke test**: open web app, toggle theme, reload — verify theme persists. On mobile: toggle
    in Settings, background/foreground app — verify theme persists.

---

## 6. Test plan

### 6.1 Unit tests (Vitest / Jest)

| Test | Asserts |
|---|---|
| `ThemeProvider.web.test.tsx` | Initialises `theme` from `localStorage`; `toggleTheme()` updates attribute + storage. |
| `ThemeProvider.web.test.tsx` | Falls back to `prefers-color-scheme` when `localStorage` is empty. |
| `ThemeProvider.mobile.test.tsx` | Reads `AsyncStorage` on mount; uses `Appearance` as fallback. |
| `ThemeProvider.mobile.test.tsx` | `setTheme("light")` swaps `rnTheme` to `rnLightTheme` and persists. |
| `useTheme.test.ts` (both) | Throws when used outside `ThemeProvider`. |
| `ThemeToggle.web.test.tsx` | Renders sun icon in dark mode; moon icon in light mode; calls `toggleTheme` on click. |

### 6.2 Visual smoke

- Web dev server: toggle between dark/light — all screens in `design-arctic/` should match the app.
- Mobile: toggle in Settings — all colors update without restart.

---

## 7. Acceptance criteria

- [ ] **No flash.** Reloading the web app with a saved `pb-theme` preference shows no white/dark flash before the page renders.
- [ ] **Persistence — web.** Selecting a theme survives a hard reload (`Cmd+Shift+R`).
- [ ] **Persistence — mobile.** Selecting a theme survives app backgrounding + foregrounding.
- [ ] **System preference default.** Fresh load with no saved preference: dark OS → dark theme; light OS → light theme.
- [ ] **Toggle works.** `ThemeToggle` button is present in sidebar footer on every web screen; in Settings on mobile. Tapping it switches the active theme immediately.
- [ ] **Arctic palette.** Light theme matches `design-arctic/` light screens; dark theme matches dark screens.
- [ ] **No hardcoded colors.** Components consume `var(--pb-…)` (web) or `useTheme().color.x` (mobile) — no inline hex.
- [ ] **Unit tests pass.** All tests in §6.1 pass in CI.

---

## 8. Open questions / decisions

1. **`prefers-color-scheme` update while app is open.** Should the app respond live to OS dark/light
   changes? Recommendation: no for MVP — too niche; user can toggle manually. Add a `Appearance.addChangeListener` in v2 if requested.
2. **Mobile AsyncStorage timing.** On first render (before `AsyncStorage` resolves), which theme shows?
   Recommendation: default to `dark` in the initial `useState`, then switch after the async read — the
   switch happens fast enough that it is not noticeable (both screens are dark-biased). Alternative: splash
   screen stays visible until the preference is loaded. Defer the splash-screen approach to v2 if the swap
   is visually jarring.
3. **Forced-theme sections.** Some UI surfaces (e.g. a modal with a custom hero image) may need to lock
   to dark regardless of user preference. Recommendation: defer to the component author to nest a local
   `data-theme="dark"` wrapper; `ThemeProvider` does not need to support this in MVP.
