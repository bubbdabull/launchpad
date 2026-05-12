/** Framer Motion presets — consistent “alive” micro-interactions. */

export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

export const staggerChildren = (stagger = 0.06) => ({
  animate: { transition: { staggerChildren: stagger } },
});

export const scaleTap = { whileTap: { scale: 0.97 }, whileHover: { scale: 1.02 } };

export const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(200,255,0,0.15)",
      "0 0 28px 2px rgba(200,255,0,0.22)",
      "0 0 0 0 rgba(200,255,0,0.15)",
    ],
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const },
  },
};
