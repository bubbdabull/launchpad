"use client";

import { motion } from "framer-motion";

import { fadeUp } from "@/lib/ui/motion-variants";

import type { ReactNode } from "react";

export function MotionSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.section {...fadeUp} className={className}>
      {children}
    </motion.section>
  );
}
