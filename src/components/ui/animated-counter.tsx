"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  className?: string;
  format?: (n: number) => string;
};

export function AnimatedCounter({ value, className = "", format }: Props) {
  const [n, setN] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const start = fromRef.current;
    const c = animate(start, value, {
      duration: 0.85,
      ease: "easeOut",
      onUpdate: (latest) => setN(latest as number),
      onComplete: () => {
        fromRef.current = value;
      },
    });
    return () => c.stop();
  }, [value]);

  const text = format ? format(Math.round(n)) : Math.round(n).toLocaleString();
  return <span className={className}>{text}</span>;
}
