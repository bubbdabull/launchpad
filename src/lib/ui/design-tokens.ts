/**
 * Design tokens — spacing, radii, motion, semantic colors for “creator market” UI.
 * Pair with `src/styles/design-system.css` + Tailwind theme extensions.
 */

export const space = {
  px: 1,
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  "2xl": 24,
  full: 9999,
} as const;

export const typography = {
  fontSans: "var(--font-body, ui-sans-serif, system-ui)",
  fontMono: "var(--font-mono, ui-monospace)",
  fontDisplay: "var(--font-heading, ui-sans-serif, system-ui)",
  fontPremium: "var(--font-premium, ui-sans-serif, system-ui)",
  sizes: {
    xs: ["0.75rem", { lineHeight: "1rem" }] as const,
    sm: ["0.875rem", { lineHeight: "1.25rem" }] as const,
    base: ["1rem", { lineHeight: "1.5rem" }] as const,
    lg: ["1.125rem", { lineHeight: "1.75rem" }] as const,
    xl: ["1.25rem", { lineHeight: "1.75rem" }] as const,
    "2xl": ["1.5rem", { lineHeight: "2rem" }] as const,
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }] as const,
  },
} as const;

export const semantic = {
  neon: "var(--cm-neon)",
  mint: "var(--cm-mint)",
  violet: "var(--cm-violet)",
  danger: "var(--cm-danger)",
  warning: "var(--cm-warning)",
  glassBorder: "var(--cm-glass-border)",
} as const;

export const motion = {
  fast: "var(--cm-motion-fast)",
  base: "var(--cm-motion-base)",
  slow: "var(--cm-motion-slow)",
} as const;

export const z = {
  base: 0,
  header: 40,
  modal: 100,
  ticker: 30,
} as const;

export const card = {
  padding: space[4],
  radius: radii["2xl"],
  border: "1px solid rgb(255 255 255 / 0.08)",
  bg: "rgb(10 10 12 / 0.85)",
} as const;

export const button = {
  radius: radii.md,
  paddingX: space[4],
  paddingY: space[2],
  gap: space[2],
} as const;
