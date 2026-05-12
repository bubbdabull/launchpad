"use client";

import Link from "next/link";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
};

const styles: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-ink shadow-[0_0_24px_rgba(34,245,158,0.22)]",
  ghost:
    "rounded-full border border-white/15 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/[0.07]",
  danger:
    "rounded-full border border-red-400/40 bg-red-500/10 px-6 py-2.5 text-sm font-bold text-red-200 hover:bg-red-500/15",
};

export function NeonButton({ children, href, onClick, variant = "primary", className = "" }: Props) {
  const cls = `${styles[variant]} ${className} inline-flex items-center justify-center transition active:scale-[0.98] hover:brightness-110`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
