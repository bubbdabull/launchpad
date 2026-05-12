// Deprecated. The featured-launch hero is now `LaunchHero` and the home page
// rail lives in `LaunchpadHome`. The platform is Solana-only, so the old
// `c.chain === "evm"` branch is dead code. This file is kept as a thin
// re-export so any stale imports compile.

export { LaunchHero as FeaturedCollection } from "./LaunchHero";
