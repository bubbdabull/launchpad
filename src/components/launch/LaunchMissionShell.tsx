import Image from "next/image";
import Link from "next/link";
import { Globe, Send } from "lucide-react";
import { IconBrandDiscord, IconBrandTelegram, IconBrandX } from "@tabler/icons-react";

import { LiveLaunchRail } from "@/components/launch/LiveLaunchRail";
import { CosmeticSignalStrip } from "@/components/gamification/cosmetic-signal-strip";
import { GlassCard } from "@/components/ui/glass-card";
import type { TokenSocialLinks } from "@/lib/launch/token-social";
import type { Collection } from "@/types/collection";

import type { ReactNode } from "react";

type CreatorProfile = { displayName: string | null; verified: boolean } | null;

function SocialRow({ links }: { links?: TokenSocialLinks | null }) {
  if (!links) return null;
  const items: { key: string; href: string; label: string; node: ReactNode }[] = [];
  if (links.website) {
    const href = links.website.startsWith("http") ? links.website : `https://${links.website}`;
    items.push({ key: "web", href, label: "Site", node: <Globe className="h-4 w-4" aria-hidden /> });
  }
  if (links.twitter) {
    const raw = links.twitter.replace(/^@/, "");
    const href = raw.startsWith("http") ? raw : `https://twitter.com/${raw}`;
    items.push({ key: "x", href, label: "X", node: <IconBrandX className="h-4 w-4" aria-hidden /> });
  }
  if (links.discord) {
    const href = links.discord.startsWith("http") ? links.discord : `https://discord.gg/${links.discord}`;
    items.push({ key: "dc", href, label: "Discord", node: <IconBrandDiscord className="h-4 w-4" aria-hidden /> });
  }
  if (links.telegram) {
    const raw = links.telegram.replace(/^@/, "");
    const href = raw.startsWith("http") ? raw : `https://t.me/${raw}`;
    items.push({ key: "tg", href, label: "Telegram", node: <IconBrandTelegram className="h-4 w-4" aria-hidden /> });
  }
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Social graph</p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <a
            key={it.key}
            href={it.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur hover:border-accent/35 hover:text-accent"
          >
            {it.node}
            {it.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function LaunchMissionShell({
  collection: c,
  creatorProfile,
  children,
}: {
  collection: Collection;
  creatorProfile: CreatorProfile;
  children: ReactNode;
}) {
  const fillPct = Math.round((c.minted / Math.max(c.supply, 1)) * 100);
  const whale = (c.holderCount ?? 0) > 400;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        <aside className="space-y-4 lg:col-span-3">
          <GlassCard glow="violet" className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Creator identity</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10">
                <Image src={c.logoUrl} alt="" fill className="object-cover" sizes="56px" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-white">
                  {creatorProfile?.displayName ?? c.creator}
                </p>
                {c.creatorWallet ? (
                  <Link
                    href={`/creator/${c.creatorWallet}`}
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-accent underline-offset-2 hover:underline"
                  >
                    {c.creatorWallet.slice(0, 4)}…{c.creatorWallet.slice(-4)}
                  </Link>
                ) : null}
                {creatorProfile?.verified ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Verified creator</p>
                ) : (
                  <p className="mt-1 text-[10px] text-muted">Unverified wallet · DYOR</p>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted line-clamp-6">{c.tagline}</p>
            <div className="mt-4 border-t border-white/10 pt-4">
              <SocialRow links={c.tokenSocialLinks} />
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Trust rail</p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-white/75">
                <li className="flex gap-2">
                  <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  Anchor lifecycle is law — UI mirrors only.
                </li>
                <li className="flex gap-2">
                  <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  Vault + token mints must match explorer PDAs.
                </li>
              </ul>
            </div>
            <div className="mt-4">
              <CosmeticSignalStrip
                earlySupporter={fillPct > 0 && fillPct < 35}
                whale={whale}
                streakDays={c.status === "live" ? 2 : undefined}
              />
            </div>
          </GlassCard>
        </aside>
        <div className="space-y-8 lg:col-span-6">{children}</div>
        <aside className="lg:col-span-3">
          <LiveLaunchRail
            name={c.name}
            minted={c.minted}
            supply={c.supply}
            status={c.status}
            volume24h={c.volume24h}
            alphaVault={c.alphaVault}
          />
        </aside>
      </div>
    </div>
  );
}
