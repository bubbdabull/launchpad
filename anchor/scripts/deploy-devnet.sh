#!/usr/bin/env bash
set -euo pipefail

# Deploy `launch-controller` to Solana devnet.
# Prerequisites:
#   1) Agave / Solana CLI 3.x (ships rustc ~1.89 for SBF — needed for current dependency graph).
#      curl: https://docs.anza.xyz/cli/install
#   2) Anchor CLI 0.31.x matching anchor-lang (or any 0.30+ for `anchor build` only).
#   3) Wallet matching Anchor.toml [provider.wallet] with devnet SOL.
#
# We use `solana program deploy` instead of `anchor deploy` because Anchor CLI 0.30.x
# passes `--buffer` in a form Solana CLI 3.x rejects ("Input must be a JSON array").
# After `avm use 0.31.1` (or matching anchor-cli), `anchor deploy --provider.cluster devnet` is fine too.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.local/share/solana/install/active_release/bin:${HOME}/.cargo/bin:${PATH}"

DEVNET_WALLET="${HOME}/.config/solana/devnet-funded.json"

cd "$ROOT"
anchor build
solana program deploy target/deploy/launch_controller.so \
  --program-id target/deploy/launch_controller-keypair.json \
  -u devnet \
  -k "${DEVNET_WALLET}"

echo "Done. Program id is in declare_id! (lib.rs), Anchor.toml, and src/lib/launch-controller/constants.ts."
