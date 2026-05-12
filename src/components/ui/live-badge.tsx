"use client";

import { motion } from "framer-motion";

type Props = { label?: string; className?: string };

export function LiveBadge({ label = "LIVE", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200 ${className}`}
    >
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
        animate={{ opacity: [1, 0.35, 1], scale: [1, 1.15, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
      {label}
    </span>
  );
}
