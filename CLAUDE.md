# OnTrack Dashboard — Working Rules

This file is read by Claude Code automatically. It encodes non-negotiable rules for working on this codebase. **Read this before starting any task.**

---

## Rule 1 — Cross-Client Consistency (MANDATORY)

**Every feature must work the same way on every client.** No client gets a "fork" of the UI. No feature is quietly missing on one client and present on another unless that feature is genuinely not applicable to the client's business model.

### What this means in practice

1. **When adding or modifying a feature, touch every client surface.** The checklist:
   - [ ] Default overview (`src/app/[client]/page.tsx`)
   - [ ] IRG overview (`src/app/[client]/irg-overview.tsx`)
   - [ ] Laurastar overview (`src/app/[client]/laurastar-overview.tsx`)
   - [ ] Ministry overview (`src/app/[client]/ministry-overview.tsx`)
   - [ ] All shared sub-pages: `attribution/`, `campaigns/`, `creative-lab/`, `crm/`, `ecom/`, `lead-gen/`, `paid-performance/`, `reports/`, `analytics/`, `suggestions/`, `settings/`
   - [ ] Sidebar nav (`src/components/layout/sidebar.tsx`) — all 4 builders (`ministry`, `irg`, `laurastar`, `default`)

2. **Relevance gating by client type, not by hard-coded slug.** The `Client.type` field is the only allowed gate. Values: `"ecommerce"` | `"lead_gen"` | `"hybrid"`.
   - `ecom` page → show for `ecommerce` + `hybrid`, hide for `lead_gen`
   - `lead-gen` page → show for `lead_gen` + `hybrid`, hide for `ecommerce`
   - `crm` page → show for `lead_gen` + `hybrid` (deal pipeline only makes sense when there's one)
   - Everything else (attribution, campaigns, creative-lab, paid-performance, reports, analytics, suggestions, settings) → **show for every client, no exceptions**.
   - **Never** gate a feature by `clientSlug === "irg"`. If a behaviour is client-specific, store it as a field on the `Client` object (e.g. `venuesConfig`, `suppressScoreWarning`) and read from there.

3. **Custom overviews are layout only, not feature gates.** IRG / Laurastar / Ministry have bespoke overviews because their hero metrics differ. Every feature the default overview shows (Suggestion widget, KPI grid, platform split, etc.) must also appear on the custom overviews — just styled to match.

4. **Mobile parity.** If a feature has a desktop refresh button, it has a mobile refresh button. If a feature has a desktop filter dropdown, mobile gets one too (or a collapsible equivalent). No silent drops.

### Pre-commit self-check

Before claiming a feature is done, answer out loud:

- Which clients did I test this on? (Need to name at least 2 — one `ecommerce`, one `lead_gen` or `hybrid`.)
- Does the sidebar show this the same way for all clients it applies to?
- Does the data source return the right shape for every client's account setup (Meta-only, Google-only, both)?
- Does the mobile view show the same information as the desktop view?

If any answer is "I didn't check" — it's not done.

---

## Rule 2 — Data Flow Integrity

- **Windsor.ai is the single source of truth for ad platform data.** Fetches go through `/api/windsor` proxy → `src/lib/windsor.ts` → `src/lib/use-windsor.ts`. Do not add a second fetch path.
- **Client-scoped data flows through context providers only.** `ClientProvider` → `DateRangeProvider` → `AttributionProvider` → `SuggestionAlertProvider`. Never reach for the URL or `localStorage` to read the active client in a leaf component — always use `useClient()`.
- **Null-guard every context consumer.** `useClient()` returns `ClientContextValue | null`. Always `if (!client) return null;` before destructuring.
- **Cache invalidation follows the date range.** Anything that changes when the date range changes must read `useDateRange()` and react to it.

---

## Rule 3 — Build Discipline

- Never ship with `ignoreDuringBuilds` or `ignoreBuildErrors` set in `next.config.ts`. Fix real errors; don't suppress them.
- After any significant change, run `npm run build` in the project directory and confirm it passes before committing.
- If `.next/` cache behaves oddly after switching between `dev` and `build`, delete `.next/` before running `dev` again.

---

## Rule 4 — Project Root

**Canonical project root:**
`/Users/zackisaacs/Documents/OnTrack Dashboard  [LIVE]/ontrack 22-43-23-744/`

The dev server is launched via a wrapper `package.json` at `~/Library/CloudStorage/GoogleDrive-zack@onsocial.agency/My Drive/OnReport/OnReport Dash/package.json` whose `dev` script is `npm --prefix "<canonical root>" run dev`. If paths break, check that wrapper first.

---

## Rule 5 — Scope of Changes

- **Prefer editing over creating.** Don't spawn new files when an existing file covers the concern.
- **No documentation files unless asked.** No new `*.md` other than this one and the existing `README.md`.
- **Commit messages: why, not what.** Use Co-Authored-By Claude when committing on the user's behalf.
