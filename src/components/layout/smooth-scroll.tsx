"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Inertial scroll polish (display layer only). Respects reduced motion via Lenis config.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      smoothWheel: true,
      touchMultiplier: 1.15,
    });

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
