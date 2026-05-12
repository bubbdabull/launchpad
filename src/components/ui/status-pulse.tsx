"use client";

import { motion } from "framer-motion";

type Tone = "neutral" | "success" | "warning" | "danger";

const toneMap: Record<Tone, string> = {
  neutral: "bg-white/40",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
};

export function StatusPulse({ tone = "neutral" }: { tone?: Tone }) {
  return (
    <motion.span
      className={`relative flex h-2 w-2 rounded-full ${toneMap[tone]}`}
      animate={{ opacity: [1, 0.5, 1] }}
      transition={{ duration: 1.4, repeat: Infinity }}
    />
  );
}
