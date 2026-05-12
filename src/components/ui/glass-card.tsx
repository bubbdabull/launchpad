"use client";

import { motion, useReducedMotion } from "framer-motion";

import { fadeUp } from "@/lib/ui/motion-variants";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  glow?: "none" | "neon" | "mint" | "violet";
  hoverLift?: boolean;
};

const glowRing: Record<NonNullable<Props["glow"]>, string> = {
  none: "",
  neon: "shadow-[0_0_48px_rgba(34,245,158,0.16)] ring-1 ring-accent/15",
  mint: "shadow-[0_0_44px_rgba(74,222,128,0.14)] ring-1 ring-accent2/15",
  violet: "shadow-[0_0_52px_rgba(167,139,250,0.2)] ring-1 ring-violet-400/20",
};

export function GlassCard({ children, className = "", glow = "none", hoverLift }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      {...fadeUp}
      whileHover={hoverLift && !reduceMotion ? { y: -3 } : undefined}
      className={`cm-glass rounded-2xl p-5 sm:p-6 ${glowRing[glow]} ${className}`}
    >
      {children}
    </motion.div>
  );
}
