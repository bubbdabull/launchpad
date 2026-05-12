# Privy email + embedded-wallet integration

> Status: **wired (auth + fiat onramp).** Mint signing through the Privy
> embedded wallet is handled automatically via the Wallet Standard registry —
> no custom wallet-adapter shim required.

## Why bother

Roughly 90% of consumer-app target users do not have a Solana wallet,
do not want to install Phantom, and bounce on the first "Connect wallet"
prompt. Privy lets them:

1. Sign up with email / Google / Apple / Twitter
2. Get a **Solana embedded wallet** provisioned automatically (custodial
   by default, with user-initiated export to self-custody at any time)
3. Pay with Apple Pay / Card via Privy's fiat onramp partners (MoonPay,
   Coinbase Onramp, etc.)

For the launchpad this means: a creator can post their launch on
TikTok and a non-crypto user can mint with a credit card — no wallet
download, no seed phrase, no "what's a Phantom".

## Architecture: dual-mode auth

We did **not** rip out wallet-adapter. Crypto-natives still get
Phantom/Solflare. The Privy flow plugs in *next to* it.

Both paths converge at our existing SIWS verifier — once a Solana wallet
is connected (whether external or embedded), our session cookie is the
same.

```
                ┌────────────────────────┐
   Phantom ───▶ │                        │
   Backpack ──▶ │  wallet-adapter        │ ──┐
   Solflare ──▶ │  (web3.js wallet API)  │   │
                └────────────────────────┘   │   ┌─────────────────┐
                          ▲                  ├──▶│  SIWS verifier  │ ──▶ session
                          │ Wallet Standard  │   └─────────────────┘
                          │ registration     │
                ┌────────────────────────┐   │
   Email ─────▶ │                        │   │
   Google ────▶ │  Privy embedded wallet │ ──┘
   Apple ─────▶ │                        │
                └────────────────────────┘
```

`@privy-io/react-auth/solana` registers each Privy embedded wallet as a
**Wallet Standard** wallet on the page. `WalletProvider` from
`@solana/wallet-adapter-react` auto-discovers Standard Wallets, which means
Privy's wallet appears in `useWallet().wallets` automatically. Once the user
authenticates with Privy, our `PrivyWalletBridge` component selects the
matching adapter entry and calls `connect()` on it. From there, every place
in the app that uses `useWallet()` (mint, deploy, claim, profile, etc.) sees
the embedded wallet exactly like a Phantom connection — no fork in the code.

## Files in this integration

| File | Purpose |
|---|---|
| `src/components/Providers.tsx` | Wraps `<PrivyProvider>` around the existing wallet-adapter tree when `NEXT_PUBLIC_PRIVY_ENABLED=true` |
| `src/components/auth/PrivyWalletBridge.tsx` | Watches Privy auth state and connects the embedded wallet through wallet-adapter so transaction-signing components can keep using `useWallet().signTransaction` unchanged |
| `src/components/auth/WalletAuthButton.tsx` | `PrivyAuthButton` in production (login + auto-SIWS + sign-out), `WalletAdapterFallbackButton` in dev when Privy is disabled. Switches at module level |
| `src/components/auth/PrivyFundWalletButton.tsx` | "Add SOL with card" CTA that opens Privy's fiat onramp; renders nothing for non-Privy users |
| `src/lib/auth/use-siws-sign-in.ts` | Shared SIWS hook. Uses Privy's `useSignMessage` directly when authenticated through Privy (no bridge dependency); falls back to wallet-adapter's `signMessage` otherwise |
| `src/lib/auth/privy-siws-signer.ts` | Thin Privy-only wrapper exporting `usePrivySiwsSigner()`. Returns `null` when Privy is disabled so the SIWS hook stays valid in dev mode (no PrivyProvider needed) |
| `src/components/account/AccountPanel.tsx` | Logged-in profile view shown at `/account`. Address, SOL balance, email, fund-with-card, export private key, sign-out |
| `src/app/account/page.tsx` | Server-guarded route that redirects to `/` when there's no SIWS session |
| `src/components/mint/GenesisPassMintPanel.tsx` | Surfaces the fund-wallet CTA next to the mint button |

## Configuration

`.env.local`:

```
NEXT_PUBLIC_PRIVY_ENABLED=true
NEXT_PUBLIC_PRIVY_APP_ID=<from privy dashboard>
PRIVY_APP_SECRET=<from privy dashboard, server-side only>
PRIVY_VERIFICATION_KEY=         # optional; leave blank to use JWKS
```

`PrivyProvider` config in `Providers.tsx`:

```ts
loginMethods: ["email", "google", "apple", "twitter", "wallet"],
appearance: {
  theme: "dark",
  accentColor: "#9be7c4",
  walletChainType: "solana-only",
},
embeddedWallets: {
  solana: { createOnLogin: "users-without-wallets" },
},
```

`solana.rpcs` is intentionally **not** configured. Privy only needs RPC
clients when *its own* embedded-wallet UIs (the modal-based
`signTransaction`) make on-chain calls. We always go through our
wallet-adapter `useConnection()` for sends, so Privy's Wallet Standard
implementation just signs the bytes and hands them back to us.

## Authentication flow (production: Privy enabled)

Privy is the **sole** identity provider. There is no SIWS message
signing in production — Privy's identity token *is* the auth.

1. User clicks "Sign in" → `useLogin().login()` → Privy modal opens
2. User completes Privy login (email OTP, Google OAuth, etc.)
3. If they don't already have a Solana wallet, Privy provisions an embedded
   one (`createOnLogin: "users-without-wallets"`). Privy SDK writes the
   `privy-token`, `privy-id-token`, and `privy-refresh-token` cookies
   (HTTP-only, set by Privy's API)
4. `<PrivySessionSync>` watches `usePrivy().authenticated`. As soon as
   it flips true, the component fetches the access token and POSTs it to
   `/api/auth/privy/login` with `Authorization: Bearer <token>`
5. The login route verifies the token via `PrivyClient.verifyAuthToken`,
   loads the Privy user, picks the first Solana wallet address, and writes
   our `lp_wallet_session` cookie (same HMAC-signed format as before — the
   only thing that changed is who authorizes the write)
6. Sync component calls `router.refresh()`; server components re-render
   with the new session. Header collapses to "Account · ABcd…XyZw"

Sign-out is the inverse:
- Client calls `/api/auth/privy/logout` (clears `lp_wallet_session`) and
  then `usePrivy().logout()` (clears Privy's cookies)
- `router.refresh()` triggers a re-render with no session

## Why not just read `privy-id-token` on every request?

We considered using the Privy idToken cookie as the only auth signal —
parse on each request, no second cookie. Two reasons we kept our cookie:
1. **Performance.** Every server component / server action would need
   to verify the JWT and parse the idToken. With our cookie, it's an
   HMAC check — nanoseconds.
2. **Stability.** The idToken is **truncated** when the user has many
   linked accounts (Privy enforces a cookie size limit). The truncated
   token might not contain the wallet address. The login API does
   `getUserById` once at sign-in, where the rate-limit cost is
   acceptable, then we cache the address in our cookie.

`PrivyWalletBridge` still runs in the tree — not for login, but so
transaction-signing components (`MintPanel`, `DeployOnChainPanel`,
and other swap / mint panels) keep working through
`useWallet().signTransaction` without per-component refactors.

## Authentication flow (dev: Privy disabled)

Set `NEXT_PUBLIC_PRIVY_ENABLED=false` to run the legacy SIWS flow with
Phantom/Solflare directly. `WalletAdapterFallbackButton` opens
wallet-adapter's modal, the user signs a SIWS message, and the existing
`/api/auth/siws/{nonce,verify,logout}` endpoints set the same
`lp_wallet_session` cookie. This keeps dev iteration possible without a
Privy app.

## Funding flow

`<PrivyFundWalletButton />` calls `useFundWallet().fundWallet({ address, options })`
which opens Privy's funding modal. Available payment methods depend on
what's enabled in the Privy dashboard (MoonPay, Coinbase Onramp, etc.).
Funds land directly in the embedded wallet. The button is rendered next to
the mint button in `GenesisPassMintPanel` — it auto-hides for users who
aren't on Privy (Phantom users won't see it).

## Server-side verification

Server actions that already check `getWalletSession()` are unchanged. By
the time a request hits the server, the user has signed a SIWS message
with their embedded wallet's keypair, and the session cookie already
encodes that pubkey. There's no separate "Privy verification" step on the
server.

If you ever need to verify a Privy JWT directly on the server (e.g. for a
paid feature gate that bypasses SIWS), call `verifyAuthToken` from
`@privy-io/server-auth`:

```ts
import { PrivyClient } from "@privy-io/server-auth";
const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);
const claims = await privy.verifyAuthToken(
  req.headers.get("authorization")!.slice(7),
);
```

That package isn't installed yet — only add it when you actually need
JWT-based authentication (instead of, or in addition to, SIWS).

## Embedded-wallet recovery

Privy supports MPC + email-based recovery. Configure in the dashboard:

- **Custodial** (default): Privy holds the key, user only needs email
- **Self-custodial via MPC**: split the key between Privy and the user's
  device — they can export the private key any time

Recommended for the launchpad: **custodial by default, with a "Take
self-custody" upgrade prompt** once a user holds > $50 of value. Lowest
friction onboarding, with a clear path off-ramp for crypto-natives.

## Known limits / next steps

- **Sign-out edge cases.** When a Privy user clicks the signed-in pill,
  we (1) clear our SIWS cookie, (2) `disconnect()` wallet-adapter,
  (3) `privyLogout()`. The bridge picks up Privy logout and double-checks
  that any lingering Privy adapter selection is cleaned up. If you see a
  ghost-connected state, hard refresh to reset.
- **Mobile.** Privy's modal works fine on mobile Safari/Chrome; we have
  not yet tested deep-links into Phantom mobile when a Privy user wants to
  switch to a self-custody wallet mid-session.
- **Bundle size.** `@privy-io/react-auth` pulls in EVM dependencies even
  with `walletChainType: "solana-only"` because Privy's own internal
  abstraction is multi-chain. Consider code-splitting Privy out of the
  initial bundle if your LCP regresses.
