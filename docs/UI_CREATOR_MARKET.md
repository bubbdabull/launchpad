# Creator Market UI — architecture, routes, motion, performance

This document maps the **production-grade Solana creator economy interface**: live-first, Pass-centric, competitive — while keeping **L1 / L2 / L3** boundaries intact (`src/lib/ui/architecture-ui.ts`, `docs/PRODUCT_ARCHITECTURE.md`).

---

## 1. Component architecture

| Layer | Path | Role |
|-------|------|------|
| **Primitives** | `src/components/ui/*` | Glass cards, neon CTAs, live badges, motion section wrapper, skeletons, rarity frame, activity ticker, wallet chip, animated counters. |
| **Market shell** | `src/components/market/CreatorMarketChrome.tsx` | Home “Solana Creator Market” hero, ticker, trending / just launched / high signal / genesis flex — **display-only** numbers from server props. |
| **Launch** | `src/components/launch/LaunchMissionShell.tsx`, `LiveLaunchRail.tsx` | Three-column mission control scaffold around existing launch panels. |
| **Mint** | `src/components/mint/MintEnergyShell.tsx` | High-energy framing + “you are early” copy; does not change tx logic in `GenesisPassMintPanel`. |
| **Trade** | `src/components/trade/TradeBattlefield.tsx` | `/project/[slug]/trade` — read-only DAMM / volume context + disclaimers. |
| **Tokens + motion** | `src/lib/ui/design-tokens.ts`, `src/styles/design-system.css`, `src/lib/ui/motion-variants.ts` | Spacing, semantic colors, CSS variables, Framer presets. |
| **Gamification (non-financial)** | `src/lib/ui/gamification.ts` | Cosmetic labels only — no XP that gates money. |
| **Data** | Existing `src/lib/data/*`, API routes | Unchanged authority model: chain truth, mirrors for display. |

---

## 2. Route-by-route UI plan

| Route | Experience goal | Status |
|-------|-----------------|--------|
| `/` | Solana Creator Market: live ticker, featured spotlight, network pulse, trending / fresh / signal strips + existing discovery grid. | **Upgraded** (`CreatorMarketChrome` + `LaunchpadHome`). |
| `/launch/[slug]` | Mission control: left creator identity, center existing vault/mint/yield panels, right live rail. | **Upgraded** (`LaunchMissionShell`). |
| `/mint/[slug]` | Highest-emotion flow: rarity frame + early messaging around existing mint panel. | **Upgraded** (`MintEnergyShell`). |
| `/project/[slug]/trade` | Fast “battlefield” read-only tape + pool mirror. | **Restored** (replaces redirect-only stub). |
| `/project/[slug]` | Unified dashboard — next: reuse `GlassCard` + lazy panels for vault/DAMM/NFT stats. | Planned incremental. |
| `/dashboard` | Creator operator cockpit — next: density layout + lazy analytics. | Planned incremental. |

---

## 3. Design system structure

- **CSS variables:** `src/styles/design-system.css` (glass, neon, gradients, shimmer, vault pulse) — imported from `globals.css`.
- **Tailwind:** extended `cm` colors + `cm-float` / `cm-glow` animations in `tailwind.config.ts`.
- **TS tokens:** `src/lib/ui/design-tokens.ts` (spacing, radii, motion keys, semantic refs).

---

## 4. Motion system structure

- **Library:** `framer-motion` for hero/ticker/cards/rail.
- **Presets:** `src/lib/ui/motion-variants.ts` (`fadeUp`, `staggerChildren`, `glowPulse`).
- **Policy:** prefer `transform`/`opacity`; avoid layout thrash; respect `prefers-reduced-motion` in future pass (wrap with `useReducedMotion`).

---

## 5. Gamification layer

- **Source of truth:** `src/lib/ui/gamification.ts` — badges / rank **labels** only.
- **Rules:** never tie badges to claim eligibility, allocation, or payout math. Copy must stay cosmetic (“Early minter”, “Genesis flex”, streaks as fun labels).

---

## 6. Mobile strategy

- **Mint:** single-column stack below `sm`; thumb-sized CTAs via `NeonButton` + existing wallet modal.
- **Home:** ticker + hero stack first; grids collapse to 1–2 columns.
- **Launch:** rails reorder below main content on small screens (grid default order).
- **Next:** larger tap targets on `CollectionCard` filters (`LaunchpadHome`) + bottom nav consideration.

---

## 7. Performance strategy

- **React Query:** `QueryProvider` in `Providers.tsx` — `staleTime` 30s default for client refetches.
- **Code splitting:** keep heavy analytics in `dynamic()` imports per route (next increment).
- **Lists:** virtualize long activity feeds when wired to real indexer streams.
- **Suspense:** add `loading.tsx` per route group (`launch`, `mint`, `project`) in a follow-up.

---

## 8. Confirmations

| Statement | |
|-----------|---|
| **Frontend remains non-authoritative** | Yes — UI displays mirrors/RPC-built views; `architecture-ui.ts` documents the line; trade + rails carry explicit “display only” copy. |
| **L1 / L2 / L3 boundaries preserved** | Yes — no new payout logic; no API changes in this UI pass; `validate-protocol` still gates CI. |
| **UI upgraded toward creator-market feel** | Yes — home + launch + mint + trade surfaces use glass/neon/motion while reusing existing data paths. |
