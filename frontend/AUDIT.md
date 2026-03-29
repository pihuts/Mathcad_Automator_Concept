# Frontend UI Audit Report

**Date:** 2026-03-21
**Reference Design:** Dashboard mockup (minimax OSS URL)
**Audited Files:** `frontend/src/App.tsx`, `frontend/src/theme/mui-theme.ts`, `frontend/src/components/*.tsx`

---

## Anti-Patterns Verdict

**PASS (with reservations)** — The current implementation avoids most AI slop tells. The design token system is genuinely well-built. However, the missing dashboard is a significant regression from the reference design, and the current App.tsx is purely functional without the refined UI personality the reference shows.

**Specific AI slop tells NOT found:**
- No cyan-on-dark gradients
- No purple-to-blue gradient text
- No glassmorphism
- No hero metric cards
- No rounded "AI card" grids with icon+heading+text

**Concern:** The `Lexend` font in the header (line 967, App.tsx) is not the `Outfit` font specified in docs/ONBOARDING.md and index.css. Font inconsistency.

---

## Executive Summary

### What Happened

The reference design is a **polished dashboard UI** that was never fully implemented — or was later removed. The current UI is a functional-but-utilitarian tool with a design system in place (tokens, fonts, colors) but missing the **dashboard shell** that makes it feel complete.

### Total Issues Found

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 4 |
| Medium | 3 |
| Low | 2 |

### Most Critical Issues

1. **Missing entire dashboard home view** — no hero, no stats, no recent workflows
2. **Header styling is inverted** — light paper background vs. reference's dark jade header
3. **Wrong navigation structure** — 3 tabs instead of 5, missing Engine/Logs/Settings

### Overall Quality Score

**5.5 / 10** — The foundation (design tokens, typography, color system) is solid. The presentation layer (dashboard layout, header, navigation) is incomplete.

### Recommended Next Steps

1. Restore the dashboard home view with hero + stats + recent workflows
2. Fix header styling to match jade-dark reference
3. Expand tab navigation to match reference

---

## Detailed Findings by Severity

### CRITICAL Issues

#### 1. Missing Dashboard Home View

- **Location:** Entire `App.tsx` — no dashboard component exists
- **Severity:** Critical
- **Category:** UX / Feature Regression
- **Description:** The reference design shows a full dashboard with a hero section ("Welcome back, Peter"), stats cards, and a recent workflows section. None of this exists in the current codebase.
- **Impact:** Users land directly on the Batch Processing tab with no welcoming context, no system status overview, and no quick access to recent workflows. This is the primary "face" of the application and it's missing entirely.
- **WCAG:** N/A (feature, not accessibility)
- **Recommendation:** Create a new `DashboardView` component that renders the hero, stats cards row, and recent workflows section. Make it the default landing tab.
- **Suggested command:** `/onboard` to design the dashboard layout, `/adapt` to implement it using existing design tokens

#### 2. Header Styling Is Inverted

- **Location:** `App.tsx` lines 955-958
- **Severity:** Critical
- **Category:** Theming / Brand
- **Description:**
  ```tsx
  backgroundColor: tokens.surface.paper,  // LIGHT — wrong
  borderBottom: `1px solid ${tokens.neutral[200]}`,
  ```
  Reference has a **dark jade/teal header** with white text. Current implementation has a light paper header with dark text.
- **Impact:** The single most recognizable brand element (the header) is opposite of the reference. Breaks brand consistency and recognition.
- **WCAG:** N/A
- **Recommendation:** Change to `backgroundColor: tokens.primary[800]` or `tokens.neutral[900]` with white text for brand name.
- **Suggested command:** `/normalize` to align header with design tokens

#### 3. Wrong Navigation Structure

- **Location:** `App.tsx` lines 1064-1067
- **Severity:** Critical
- **Category:** Navigation / UX
- **Description:** Current tabs: `Batch Processing | Workflow | Optimizer`
  Reference tabs: `Workflows | Batches | Engine | Logs | Settings`
- **Impact:** Users cannot access Engine status or Logs directly. Settings is buried behind an icon button instead of being a proper tab.
- **WCAG:** 2.4.1 (Bypass Blocks) — but more fundamentally a usability issue
- **Recommendation:** Expand tabs to match reference. Consider whether Engine and Logs deserve dedicated tab views.
- **Suggested command:** `/adapt` to restructure navigation

---

### HIGH-SEVERity Issues

#### 4. Missing Stats Cards Row

- **Location:** No component exists
- **Severity:** High
- **Category:** UX / Feature
- **Description:** Reference shows 3 stats cards:
  - "Active Workflows" → 3 / ↑2 this week
  - "Jobs Queued" → 12 / Next: Run #847
  - "Engine Uptime" → 3d 14h / Since last restart
  No equivalent exists in the codebase.
- **Impact:** Users have no quick glanceable system status. They must dig into individual sections to understand current system state.
- **WCAG:** N/A
- **Recommendation:** Build `StatsCard` component using existing `CompactStatusCard` as reference. Use jade status colors for consistency.
- **Suggested command:** `/adapt` to implement stats cards

#### 5. Missing Recent Workflows Section

- **Location:** No component exists
- **Severity:** High
- **Category:** UX / Feature
- **Description:** Reference shows 3 workflow cards with status badges (Running/Completed/Queued). Current UI has no equivalent. `WorkflowSummaryView` exists but is used for step details, not a dashboard card list.
- **Impact:** No quick access to recently run workflows. Users must navigate away from the dashboard to find workflow history.
- **WCAG:** N/A
- **Recommendation:** Create `RecentWorkflowsCard` component. Reference the status badge pattern from `BatchStatusPill`.
- **Suggested command:** `/adapt` to implement recent workflows cards

#### 6. Missing Search Icon in Header

- **Location:** `App.tsx` — header toolbar (lines 960-1026)
- **Severity:** High
- **Category:** UX
- **Description:** Reference header shows a search icon (magnifying glass) on the right side of the header. Not present in current implementation.
- **Impact:** No global search capability for workflows, batches, or files. Reference implies this feature should exist.
- **WCAG:** N/A
- **Recommendation:** Add search icon button to header toolbar.
- **Suggested command:** `/adapt`

#### 7. Missing User Avatar in Header

- **Location:** `App.tsx` — header toolbar (lines 960-1026)
- **Severity:** High
- **Category:** UX
- **Description:** Reference shows a user avatar (circle with initials or image) in the top-right corner. Not present in current implementation. Only a settings icon exists.
- **Impact:** No personal account context. Settings are accessible but user profile is not.
- **WCAG:** N/A
- **Recommendation:** Add avatar component with user initials or image placeholder to header.
- **Suggested command:** `/adapt`

---

### MEDIUM-SEVERITY Issues

#### 8. Font Mismatch in Header

- **Location:** `App.tsx` line 967
- **Severity:** Medium
- **Category:** Theming / Typography
- **Description:** Header brand name uses `fontFamily: 'Lexend, sans-serif'`. docs/ONBOARDING.md and index.css specify `Outfit` as the brand font. Tokens file does not define a `fontFamily` for headers.
- **Impact:** Typography inconsistency with the rest of the brand.
- **WCAG:** N/A
- **Recommendation:** Use `Outfit` throughout, defined once in tokens.
- **Suggested command:** `/normalize`

#### 9. Tab Labels Don't Match Reference

- **Location:** `App.tsx` lines 1064-1066
- **Severity:** Medium
- **Category:** UX / Navigation
- **Description:**
  - Current: "Batch Processing" → Reference: "Batches"
  - Current: "Workflow" → Reference: "Workflows"
  - Current: "Optimizer" → Reference: This tab doesn't exist in reference at all
- **Impact:** Minor confusion for users expecting the reference's tab structure.
- **WCAG:** N/A
- **Recommendation:** Rename tabs to match reference if Engine/Logs tabs are added.
- **Suggested command:** `/adapt`

#### 10. No "BATCH ACTIVE" Badge Clarity

- **Location:** `App.tsx` lines 974-983
- **Severity:** Medium
- **Category:** UX
- **Description:** The "BATCH ACTIVE" and "WORKFLOW ACTIVE" badges appear only when a batch/workflow is running. Reference doesn't show these badges — the status is conveyed via the stats cards and workflow cards instead.
- **Impact:** Redundant status display that crowds the header. Stats cards and workflow status should be the source of truth.
- **WCAG:** N/A
- **Recommendation:** Remove header badges once stats cards are implemented. They are low-value duplication.
- **Suggested command:** `/normalize`

---

### LOW-SEVERITY Issues

#### 11. Hard-coded "Peter" Assumption

- **Location:** Reference design shows "Welcome back, Peter"
- **Severity:** Low
- **Category:** UX / i18n
- **Description:** The greeting hard-codes a name. If this goes to production, it should read from user context or be generalized to "Welcome back."
- **Impact:** Minor personalization issue if real users have different names.
- **WCAG:** N/A
- **Recommendation:** Make the name dynamic from user context or use a generic greeting.
- **Suggested command:** `/adapt`

#### 12. Tab Radius Is `full` (Pill Style)

- **Location:** `App.tsx` line 1045: `borderRadius: tokens.radius.full`
- **Severity:** Low
- **Category:** Theming
- **Description:** The reference shows slightly rounded but not fully pill-shaped tabs. `tokens.radius.full` makes them fully round (like buttons). This is a minor style deviation.
- **Impact:** Minor visual difference from reference.
- **WCAG:** N/A
- **Recommendation:** Reduce radius to a softer value (e.g., `tokens.radius.md` or `tokens.radius.lg`).
- **Suggested command:** `/normalize`

---

## Patterns & Systemic Issues

1. **The dashboard shell is entirely absent.** The design token system is the "skeleton" — it's solid. But the "body" (dashboard view, stats, recent workflows) was never built. All 3 critical issues trace back to this root cause.

2. **Navigation is under-built.** 3 tabs vs 5. Engine status and Logs are inaccessible via main navigation. Settings is icon-only.

3. **Status communication is fragmented.** Header badges, CompactStatusCard (for optimizer), workflow step summary — but no unified system status view.

4. **No component for card/pill status badges.** `BatchStatusPill` exists but there is no unified `WorkflowStatusBadge` or `StatsCard` component.

---

## Positive Findings

1. **Design token system is exemplary.** `mui-theme.ts` is a proper single source of truth with OKLCH-adjacent values, full light/dark mode, complete spacing/shadow/radius scales. This is how design systems should be built.

2. **Typography setup is correct.** Outfit + JetBrains Mono from Google Fonts, loaded in `index.css`, applied in theme. Exactly as specified in docs/ONBOARDING.md.

3. **Accessible skip link exists.** `App.tsx` line 1031: `<a href="#main-content" className="skip-link">` — good a11y practice.

4. **Alert components use `borderRadius: '14px'`** — a distinctive, deliberate radius that matches the brand. Not the default MUI radius.

5. **Dark mode infrastructure exists** — `ThemeContext.tsx` with full token set for dark mode. The mechanism works; the dark dashboard just needs components to render.

6. **`CompactStatusCard` is a good template** — already exists and can be cloned/modified for the stats cards. It shows the team knows how to build cards with the design system.

7. **No AI slop aesthetics detected.** The existing components avoid gradient text, glassmorphism, hero metrics, and other 2024 AI-slop patterns. This is genuinely refreshing.

---

## Recommendations by Priority

### Immediate (This Sprint)

1. **Build the Dashboard View** — Hero section + stats cards + recent workflows. This is the single highest-impact missing piece. All work here reuses existing tokens.

### Short-Term (Next Sprint)

2. **Fix header styling** — Dark jade background with white text to match reference.
3. **Expand navigation** — Add Engine and Logs as tabs. Promote Settings from icon to tab.
4. **Add search and avatar** to header.

### Medium-Term

5. **Create reusable card components** — `StatsCard`, `WorkflowStatusCard` with proper status badges.
6. **Polish dark mode** — Implement dark dashboard once shell exists.
7. **Font audit** — Remove `Lexend`, use `Outfit` everywhere.

### Long-Term

8. **Empty states for dashboard sections** — When no workflows are running/queued, dashboard should show meaningful empty states.
9. **Animation pass** — The reference shows subtle staggered reveals on load. Use `prefers-reduced-motion` media query to ensure accessibility.

---

## Suggested Commands for Fixes

| Issue | Command | Why |
|-------|---------|-----|
| Missing dashboard view | `/onboard` or `/adapt` | Creates new UI sections using existing design tokens |
| Header styling | `/normalize` | Fixes theming inconsistencies (background, font) |
| Stats cards | `/adapt` | Implements new card components |
| Recent workflows | `/adapt` | Implements new workflow card list |
| Navigation restructure | `/adapt` | Changes tab structure |
| Font mismatch | `/normalize` | Aligns font usage with design tokens |
| Dark mode polish | `/adapt` | Completes dark theme implementation |

---

## Verification Checklist

After fixes are applied, verify:

- [ ] Dashboard home view renders with hero, stats, and recent workflows
- [ ] Header has dark jade background with white/light text
- [ ] Tabs read: Workflows | Batches | Engine | Logs | Settings
- [ ] Search icon appears in header
- [ ] Avatar appears in header top-right
- [ ] Stats cards show: Active Workflows, Jobs Queued, Engine Uptime
- [ ] Workflow cards show status badges (Running/Completed/Queued)
- [ ] Dark mode renders correctly on all new components
- [ ] All colors use design tokens (no hard-coded hex values)
- [ ] `Outfit` font used consistently, not `Lexend`

---

# Theme & Color Deep Audit (Batch Design Focus)
**Scope**: `frontend/src/theme/` + component CSS/token usage
**Date**: 2026-03-21
**Focus**: Theme & Color only — examining the batch processing design against the jade brand design system

---

## Anti-Patterns Verdict (Theme & Color)

**PASS** — The design system does NOT look AI-generated. The jade-green brand palette is consistent and purposeful. No purple-to-blue gradients, no glassmorphism, no hero metric layouts, no cyan-on-dark neon. The token architecture is a genuine best practice. That said, several **systematic token breaks** undermine the system from within.

---

## Executive Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 4 |
| Medium | 6 |
| Low | 3 |
| **Total** | **17** |

### Top Issues (must fix first)

1. **`alpha` tokens not exported to CSS** — the alpha color system exists in TypeScript but is inaccessible to components via `tokens.ts`. `BatchGrid.module.css` hardcodes `rgba(4, 120, 87, 0.15)` as a workaround.
2. **`ui` token namespace missing dark-mode variants** — `--ui-link-blue`, `--ui-tech-label`, etc. are defined but never swapped for dark mode.
3. **Dark mode CSS vars never fully swap** — `darkCssVariables` redefines only surfaces/text/borders (~20% of tokens). The remaining 80% (`--color-primary-*`, `--color-neutral-*`, `--alpha-*`, `--ui-*`) remain light-mode values even when dark mode is active.
4. **`alpha.neutral` only has 4 steps** — insufficient for all overlay use cases; forces hardcoded `rgba(0,0,0,0.15)` fallbacks.

---

## Detailed Findings

### Critical Issues

#### 1. `alpha` token namespace not exported to CSS / tokens.ts
- **Location**: `src/theme/mui-theme.ts:87-112` (defined), `src/theme/mui-theme.ts:614-629` (tokens.ts export)
- **Severity**: Critical
- **Category**: Theming
- **Description**: `tokens.alpha` defines 7 opacity steps for primary (4/8/10/15/20/30/40) and 4 for neutral (4/8/10/12). CSS variables `--alpha-primary-*` and `--alpha-neutral-*` ARE generated in `cssVariables`, but the `tokens.ts` destructured export does NOT include `alpha` — components cannot import it. Additionally, `--alpha-success-*`, `--alpha-warning-*`, `--alpha-error-*` are completely absent from both the token definition and CSS vars.
- **Impact**: Components needing semi-transparent brand overlays must hardcode `rgba(4, 120, 87, 0.15)`. `BatchGrid.module.css:34` does exactly this.
- **Recommendation**: Export `alpha` from `tokens.ts`. Add missing success/warning/error alpha variants. Consider adding `--shadow-primary` CSS vars.
- **Suggested command**: `/normalize`

---

#### 2. `ui` token namespace missing dark-mode variants
- **Location**: `src/theme/mui-theme.ts:130-135` + `src/theme/mui-theme.ts:668-689`
- **Severity**: Critical
- **Category**: Theming
- **Description**: `tokens.ui` defines `techLabel`, `dataFlowBg`, `linkBlue`, `successGreen`. `darkCssVariables` does NOT redefine `--ui-*` vars. `tokens.ts` also doesn't export `ui`.
- **Impact**: `linkBlue: '#1a73e8'` renders as generic Google-blue on dark backgrounds. `techLabel` may fail contrast. Inconsistent with the jade brand.
- **WCAG**: 1.4.3 (Contrast AA)
- **Recommendation**: Export `ui` from `tokens.ts`, define dark-mode equivalents in `darkTokens.ui`, update `darkCssVariables`.
- **Suggested command**: `/normalize`

---

#### 3. Dark mode CSS vars only cover ~20% of the token system
- **Location**: `src/theme/mui-theme.ts:668-689` (`darkCssVariables`)
- **Severity**: Critical
- **Category**: Theming
- **Description**: `darkCssVariables` redefines only surfaces (canvas/paper/elevated/overlay), text (primary/secondary/muted), borders, and status light backgrounds. Every other CSS variable (`--color-primary-*`, `--color-accent-*`, `--color-neutral-*`, `--alpha-*`, `--ui-*`) stays light-mode even with `[data-theme="dark"]` active.
- **Impact**: When dark mode activates, `--color-primary-700` stays `#047857` while background turns `#0f172a`. Severe contrast failures across all CSS-based (non-MUI) components. The `[data-theme="dark"]` attribute IS applied by `ThemeContext`, but CSS var injection only covers a fraction of the system.
- **WCAG**: 1.4.3 (Contrast AA), 1.4.11 (Non-text Contrast)
- **Recommendation**: Populate `darkCssVariables` to redefine all semantic and primary CSS vars. Alternatively, switch CSS-based components to use MUI theme tokens which are correctly handled by `ThemeContext.tsx`.
- **Suggested command**: `/normalize`

---

#### 4. `alpha.neutral` only 4 steps — insufficient
- **Location**: `src/theme/mui-theme.ts:106-112`
- **Severity**: Critical
- **Category**: Theming
- **Description**: `tokens.alpha.neutral` has 4 levels (4/8/10/12). `alpha.primary` has 7 (4/8/10/15/20/30/40). Components needing neutral 15% or 20% overlay must hardcode `rgba(0,0,0,0.15)`.
- **Impact**: Hardcoded fallbacks, inconsistent overlay system.
- **Recommendation**: Extend to 7 steps matching primary. In dark mode, use white-based rgba (e.g., `rgba(255,255,255,0.15)`).
- **Suggested command**: `/normalize`

---

### High-Severity Issues

#### 5. `industrial.module.css:74` references non-existent `--color-warning`
- **Location**: `src/styles/industrial.module.css:74`
- **Severity**: High
- **Category**: Theming
- **Description**: `.conditionalCard` uses `border: 1px solid var(--color-warning)` — no such CSS variable exists. Should be `--color-warning-main`.
- **Impact**: Broken/undefined border color.
- **Recommendation**: Fix to `var(--color-warning-main)`.
- **Suggested command**: `/normalize`

---

#### 6. `success`/`info` alpha tokens missing from CSS variables
- **Location**: `src/theme/mui-theme.ts:97-105` (defined) + `src/theme/mui-theme.ts:342-360` (partially exported)
- **Severity**: High
- **Category**: Theming
- **Description**: `tokens.alpha.info` is fully defined but only primary and neutral are in CSS vars. No `--alpha-success-*`, `--alpha-warning-*`, `--alpha-error-*` exist anywhere.
- **Impact**: No CSS variable path for status-colored overlays; components hardcode `rgba(22, 163, 74, 0.1)`.
- **Recommendation**: Add all semantic alpha variants to `cssVariables` and `darkCssVariables`.
- **Suggested command**: `/normalize`

---

#### 7. Status dark-mode surfaces hardcoded inline instead of derived from tokens
- **Location**: `src/theme/mui-theme.ts:656-661` + `src/theme/mui-theme.ts:684-687`
- **Severity**: High
- **Category**: Theming
- **Description**: Dark-mode status light backgrounds (`'#1a2d1a'`, `'#3d2a0a'`, `'#3d0a0a'`, `'#2a0a3d'`) are hardcoded as raw hex strings in `darkCssVariables` rather than referencing `darkTokens.status.*`.
- **Impact**: DRY violation — if status colors update, dark mode must be manually updated in two places.
- **Recommendation**: Reference `darkTokens.status.*` in `darkCssVariables` string.
- **Suggested command**: `/normalize`

---

#### 8. `ThemeContext.tsx` box-shadow overrides use hardcoded rgba
- **Location**: `src/theme/ThemeContext.tsx:146, 152, 157, 171, 174, 190`
- **Severity**: High
- **Category**: Theming
- **Description**: MUI Button and Chip `boxShadow` overrides use `rgba(4, 120, 87, 0.2)` etc. hardcoded instead of referencing `tokens.alpha.primary[20]`.
- **Impact**: If primary brand color changes, button shadows become stale. Hardcoded values can drift from the alpha palette.
- **Recommendation**: Use `tokens.alpha.primary[20]` etc. directly in the theme, or create CSS vars `--shadow-primary-*`.
- **Suggested command**: `/normalize`

---

### Medium-Severity Issues

#### 9. `neutral` palette lacks structured keys (inconsistent with semantic colors)
- **Location**: `src/theme/mui-theme.ts:115-127`
- **Severity**: Medium
- **Category**: Theming
- **Description**: Semantic colors have `border`/`hoverLight`/`hoverBorder` sub-keys; `neutral` has only numeric scale. Components needing neutral borders must use `--color-border` which maps to `neutral[200]`.
- **Recommendation**: Add `border: neutral[200]`, `hoverLight: neutral[100]`, `hoverBorder: neutral[300]` to `tokens.neutral` for API consistency.
- **Suggested command**: `/normalize`

---

#### 10. `primary` palette lacks structured keys (inconsistent with semantic colors)
- **Location**: `src/theme/mui-theme.ts:19-30`
- **Severity**: Medium
- **Category**: Theming
- **Description**: `primary` is a plain numeric scale. `success`/`warning`/`error` have structured keys. `pillColors` in `tokens.ts` uses numeric indices for primary.
- **Recommendation**: Add `{ light, main, dark, border }` structured keys to `tokens.primary` for API consistency.
- **Suggested command**: `/normalize`

---

#### 11. Skeleton shimmer not dark-mode-aware
- **Location**: `src/index.css:362-367`
- **Severity**: Medium
- **Category**: Theming
- **Description**: Skeleton uses `var(--color-neutral-100)` / `var(--color-neutral-200)` — good token references. But since dark-mode CSS vars don't swap neutral scale, skeleton stays light-toned in dark mode (nearly invisible).
- **Impact**: Skeleton loaders broken in dark mode.
- **Recommendation**: Will auto-fix once Issue #3 (dark-mode CSS var swap) is resolved.
- **Suggested command**: `/normalize`

---

#### 12. AG-Grid dark-mode header uses `--color-primary` on dark background
- **Location**: `src/components/BatchGrid.module.css:28-38`
- **Severity**: Medium
- **Category**: Theming
- **Description**: Dark mode overrides `--ag-header-foreground-color: var(--color-primary-400)` which resolves to `#22c55e` on `#0f172a` background (~4.5:1, borderline). Also uses hardcoded `rgba(4, 120, 87, 0.15)` instead of `--alpha-primary-15`.
- **WCAG**: 1.4.3 (Contrast AA)
- **Recommendation**: Use jade-200 or jade-300 for dark-mode header text. Use `--alpha-primary-15` CSS var.
- **Suggested command**: `/normalize`

---

#### 13. `surface.overlay` not applied via CSS in MUI Dialogs
- **Location**: `src/theme/mui-theme.ts:142` (defined), `src/theme/ThemeContext.tsx` (not applied)
- **Severity**: Medium
- **Category**: Theming
- **Description**: `darkTokens.surface.overlay` is defined as `rgba(0,0,0,0.7)` but MUI Dialog backdrops don't reference this CSS var — they use MUI's hardcoded overlay. The `darkCssVariables` correctly maps `--surface-overlay` but MUI Dialogs don't consume it.
- **Impact**: Dialog backdrops use `rgba(0,0,0,0.5)` even in dark mode, appearing too light relative to the dark canvas.
- **Recommendation**: Verify MUI Dialog uses `--surface-overlay` CSS var for backdrop, or override via `MuiDialog.styleOverrides`.
- **Suggested command**: `/normalize`

---

#### 14. Status light backgrounds not tinted toward jade brand
- **Location**: `src/theme/mui-theme.ts:47-84`
- **Severity**: Medium
- **Category**: Theming
- **Description**: `success.light: '#dcfce7'` is a generic mint. Per the color reference: "tint your neutrals toward your brand hue." Status backgrounds could have a subtle jade base.
- **Impact**: Brand consistency — status colors feel slightly generic rather than branded.
- **Recommendation**: Add subtle jade tint to status light backgrounds. Keep status hues (green/amber/red) but add a jade undertone.
- **Suggested command**: `/colorize`

---

### Low-Severity Issues

#### 15. `styles/variables.css` is deprecated but still imported
- **Location**: `src/styles/variables.css:1-48` + `src/main.tsx:7`
- **Severity**: Low
- **Impact**: Dead code, maintenance confusion.
- **Recommendation**: Remove import from `main.tsx` once migration is complete.
- **Suggested command**: `/normalize`

---

#### 16. `index.css:396` hardcoded dark overlay
- **Location**: `src/index.css:396-398`
- **Severity**: Low
- **Description**: `[data-theme="dark"] .loading-overlay { background: rgba(15, 23, 42, 0.8); }` uses hardcoded slate instead of `var(--surface-overlay)`.
- **Recommendation**: Change to `var(--surface-overlay)`.
- **Suggested command**: `/normalize`

---

#### 17. `App.css` is empty
- **Location**: `src/App.css`
- **Severity**: Low
- **Impact**: Dead file, no styles defined.
- **Recommendation**: Delete `App.css` and remove its import from `App.tsx`.
- **Suggested command**: `/normalize`

---

## Patterns & Systemic Issues

1. **Dark-mode CSS variable coverage is ~20%** — 80% of CSS custom properties are never swapped for dark mode. MUI components (via `ThemeContext`) render correctly. CSS modules and raw CSS using custom properties will display broken colors in dark mode.

2. **`alpha` token system is half-implemented** — Defined in TypeScript, partially exported to CSS, never exported from `tokens.ts`, no dark-mode variants, missing success/warning/error variants.

3. **`ui` token namespace is orphaned** — Defined in `tokens.ui`, exported to CSS vars, but not exported from `tokens.ts` and has no dark-mode support.

4. **MUI components are fine; CSS/custom components are broken** — The `ThemeContext.tsx` creates a correct MUI dark palette. The breakage is entirely in CSS modules and raw CSS that rely on CSS custom properties.

---

## Positive Findings (Theme & Color)

1. **Single-source-of-truth token architecture** — `mui-theme.ts` is the canonical definition. Everything (MUI theme, CSS vars, component imports) derives from it. Correct pattern.

2. **Jade brand palette is distinctive** — `#047857` jade-green used purposefully across buttons, chips, status indicators. Cohesive brand, not generic.

3. **Neutral scale uses tinted values** — `#f8fafc` to `#0f172a` has subtle cool-blue tint, not pure gray. Matches professional, precise brand personality.

4. **`pillColors` helper** — Structured `pillColors` object with `bg`/`text`/`border` per variant is an excellent pattern.

5. **`getStatusColor` / `getStatusBgColor` helpers** — Status mapping centralized in `tokens.ts`.

6. **`ThemeContext` handles system preference correctly** — Listens to `matchMedia`, persists to localStorage, computes `resolvedMode` correctly.

7. **No AI-slop aesthetic** — No purple gradients, no glassmorphism, no hero metrics. Design reads as engineered.

8. **Reduced motion and high contrast support** — Proper `@media (prefers-reduced-motion: reduce)` and `@media (prefers-contrast: high)` blocks in `index.css`.

---

## Recommendations by Priority

### Immediate (Critical)
1. Complete dark-mode CSS variable swap — redefine all `--color-primary-*`, `--color-accent-*`, `--color-neutral-*`, `--color-success-*`, etc. in `darkCssVariables`
2. Export `alpha` from `tokens.ts`
3. Add `--alpha-success-*`, `--alpha-warning-*`, `--alpha-error-*` to CSS vars
4. Add dark-mode `--ui-*` token variants

### Short-term (High)
5. Fix `industrial.module.css:74` broken `var(--color-warning)` reference
6. Update `ThemeContext.tsx` MUI overrides to use `tokens.alpha.primary.*` instead of hardcoded rgba
7. Use `--alpha-primary-15` in `BatchGrid.module.css` dark mode
8. Fix `darkTokens.neutral[800]` — currently `#f1f5f9` (near-white) which is wrong for dark mode

### Medium-term
9. Add `border`/`hoverLight`/`hoverBorder` to `tokens.neutral`
10. Add structured keys to `tokens.primary`
11. Auto-fix skeleton shimmer (will resolve from Issue #1)
12. Tint status light backgrounds toward jade brand

### Long-term
13. Delete dead `App.css` and deprecated `variables.css` imports
14. Audit all CSS modules for remaining hardcoded `rgba(4, 120, 87, ...)` patterns
15. Add `--shadow-primary-*` CSS vars

---

## Suggested Commands for Fixes

| Issue # | Command | Rationale |
|---|---|---|
| 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 | `/normalize` | All theme token system fixes — normalize will align CSS vars, exports, and dark-mode coverage to match the single-source-of-truth pattern |
| 14 | `/colorize` | Brand-consistency tinting of status light backgrounds requires intentional color choices |

---

*Theme & Color audit appended — 2026-03-21*

---

# Batch Processing UI Audit (2026-03-21)

**Scope:** `BatchSettingsPanel`, `BatchPreviewModal`, `BatchResultsTable`, `BatchGrid.module.css`
**Focus:** Theme implementation for batch processing components

---

## Anti-Patterns Verdict

**PASS** - The batch processing UI does not exhibit AI slop characteristics. Uses project's established Jade Ribbon theme with consistent tokens, proper typography (Outfit + JetBrains Mono), and restrained decorative elements. No gradient text, glassmorphism, hero metrics, or generic card grids.

---

## Issues Fixed (2026-03-21)

### Critical Fixed
| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | Incomplete dark mode tokens (missing primary, accent, status) | `mui-theme.ts:635-689` | ✅ FIXED |
| 2 | Hardcoded RGBA button shadows | `mui-theme.ts:487-524` | ✅ FIXED |
| 3 | Heading hierarchy violation (`h6 component=span`) | `BatchPreviewModal.tsx:118` | ✅ FIXED |

### High Fixed
| # | Issue | File | Status |
|---|-------|------|--------|
| 4 | Generic `'monospace'` font | `BatchPreviewModal.tsx:197,212` | ✅ FIXED |
| 5 | Missing aria-label on close button | `BatchSettingsPanel.tsx:95-104` | ✅ FIXED |

### Medium Fixed
| # | Issue | File | Status |
|---|-------|------|--------|
| 6 | Missing aria-live for dynamic status | `BatchResultsTable.tsx:143-147` | ✅ FIXED |
| 7 | Hardcoded Drawer width (320px) | `BatchSettingsPanel.tsx:69` | ✅ FIXED |
| 8 | Hardcoded grid height (400px) | `BatchResultsTable.tsx:159` | ✅ FIXED |
| 9 | Generic `ag-theme-alpine` class | `BatchResultsTable.tsx:159` | ✅ FIXED |
| 10 | Hardcoded `borderRadius: 3` | `BatchPreviewModal.tsx:112` | ✅ FIXED |

### Low Fixed
| # | Issue | File | Status |
|---|-------|------|--------|
| 11 | Missing React.memo wrapper | `BatchResultsTable.tsx:15` | ✅ FIXED |
| 12 | Small touch target on Export CSV | `BatchResultsTable.tsx:151` | ✅ FIXED |

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/theme/mui-theme.ts` | Complete dark mode tokens, CSS variable shadows |
| `frontend/src/components/BatchPreviewModal.tsx` | Heading fix, border radius, JetBrains Mono |
| `frontend/src/components/BatchResultsTable.tsx` | React.memo, aria-live, touch targets, custom theme |
| `frontend/src/components/BatchSettingsPanel.tsx` | Responsive width, aria-label |
| `frontend/src/index.css` | Custom AG Grid theme support |

---

## Pending Recommendations

### Short-term (Next Sprint)
1. Verify dark mode renders correctly in browser
2. Test keyboard navigation through batch workflow
3. Validate touch target sizes on actual device

### Medium-term
4. Add skeleton loading states for batch results
5. Add keyboard shortcuts for common batch actions
6. Implement batch progress streaming for large batches

### Long-term
7. Add batch operation undo/redo capability
8. Implement batch scheduling feature
9. Add batch templates for common parameter studies
