import type { Collection } from "@/types/collection";
import type { PlatformStats } from "@/types/platform";

export const platformStats: PlatformStats = {
  launchesLive: 2,
  totalMinted: 1357,
  totalSupply: 7666,
  totalLaunches: 4,
};

export const collections: Collection[] = [
  {
    slug: "bonk-cadets",
    name: "Bonk Cadets",
    tagline: "Chibi shiba astronauts riding the vault raise to orbit.",
    description:
      "1,000 chibi shiba astronauts paired with $CADET. Primary sales flow through a Meteora Alpha Vault; when the vault fills and the pool graduates to DAMM v2, holders keep earning from trading fees.",
    bannerUrl: "/images/launches/bonk-cadets-banner.png",
    logoUrl: "/images/launches/bonk-cadets-logo.png",
    chain: "solana",
    creator: "8ZsK…RjMQ",
    status: "live",
    minted: 377,
    supply: 1000,
    priceLabel: "0.5 SOL",
    phase: "Public mint · Vault open",
    utilities: ["Cadet Pass", "Fee share", "Squad allowlist"],
    trendingRank: 1,
    volume24h: "182 SOL",
    tokenSymbol: "CADET",
  },
  {
    slug: "hoverbike-cats",
    name: "Hoverbike Cats",
    tagline: "5,555 neon-Tokyo cyberpunk cats + $ZOOM.",
    description:
      "Cyberpunk anime cats that mint alongside $ZOOM through a Meteora Alpha Vault. Squad ranking, fee-share, and a clean handoff to DAMM v2 when the raise completes.",
    bannerUrl: "/images/launches/hoverbike-cats-banner.png",
    logoUrl: "/images/launches/hoverbike-cats-logo.png",
    chain: "solana",
    creator: "GhpQ…NmTR",
    status: "live",
    minted: 980,
    supply: 5555,
    priceLabel: "1.2 SOL",
    phase: "Phase II · Vault open",
    utilities: ["PFP Pass", "Squad staking", "Fee share"],
    trendingRank: 2,
    volume24h: "612 SOL",
    tokenSymbol: "ZOOM",
  },
  {
    slug: "pixel-pepe-posse",
    name: "Pixel Pepe Posse",
    tagline: "16-bit frog crew, $PIXEL launches with mint.",
    description:
      "1,111 chunky pixel-art frogs in bucket hats, sunglasses, and gold chains. The paired $PIXEL token raises through a Meteora Alpha Vault tied to each mint. Holders get a token airdrop when the vault completes and the pool moves to DAMM v2.",
    bannerUrl: "/images/launches/pixel-pepe-posse-banner.png",
    logoUrl: "/images/launches/pixel-pepe-posse-logo.png",
    chain: "solana",
    creator: "HLsv…yTNa",
    status: "upcoming",
    minted: 0,
    supply: 1111,
    priceLabel: "0.25 SOL",
    phase: "Allowlist",
    utilities: ["Posse Pass", "Graduation airdrop", "Trait reveal"],
    trendingRank: 3,
    volume24h: "—",
    tokenSymbol: "PIXEL",
  },
  {
    slug: "ghost-slice",
    name: "Ghost Slice",
    tagline: "Founders only · $GHOST on DAMM v2.",
    description:
      "The Ghost Slice founders' set — only 10 passes ever minted. $GHOST already trades on DAMM v2; holders keep earning trading fees as the pool keeps cooking.",
    bannerUrl: "/images/launches/ghost-slice-banner.png",
    logoUrl: "/images/launches/ghost-slice-logo.png",
    chain: "solana",
    creator: "B4n8…pqXr",
    status: "sold_out",
    minted: 10,
    supply: 10,
    priceLabel: "10 SOL",
    phase: "Graduated",
    utilities: ["Founder Pass", "Fee share", "DAMM v2 LP"],
    tokenSymbol: "GHOST",
    dammPool: "GHoSTdamm1111111111111111111111111111111111",
  },
];

export function getCollection(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}

export function getFeatured(): Collection {
  return collections.find((c) => c.slug === "hoverbike-cats") ?? collections[0];
}
