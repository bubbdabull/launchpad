import Link from "next/link";

import {
  IconGrid,
  IconLayout,
  IconRocket,
  IconShare,
  IconUser,
} from "@/components/site/nav-icons";

const tiles = [
  {
    href: "/create",
    label: "New launch",
    sub: "Token + Genesis Pass",
    Icon: IconRocket,
    accent: "from-emerald-500/20 to-transparent",
  },
  {
    href: "/#launches",
    label: "Browse",
    sub: "All live launches",
    Icon: IconGrid,
    accent: "from-violet-500/20 to-transparent",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    sub: "Metrics & deploy",
    Icon: IconLayout,
    accent: "from-amber-500/15 to-transparent",
  },
  {
    href: "/referrals",
    label: "Referrals",
    sub: "Share & earn",
    Icon: IconShare,
    accent: "from-sky-500/15 to-transparent",
  },
  {
    href: "/account",
    label: "Account",
    sub: "Wallet & profile",
    Icon: IconUser,
    accent: "from-accent/25 to-transparent",
  },
] as const;

export function CreatorHubNav() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${t.accent} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-accent/35 hover:bg-white/[0.03]`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-accent transition group-hover:border-accent/30 group-hover:text-white">
              <t.Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold tracking-tight text-white">{t.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{t.sub}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
