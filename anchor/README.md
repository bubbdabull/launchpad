# LaunchController (Anchor) — financial truth layer

Single program for **launch lifecycle**, **deposit receipts (Option A)**, **mint binding + allocation**, and **vested SPL claims**.

## Truth rules

- **One allocation source:** `MintReceipt.allocation` is derived only from `DepositReceipt.lamports` and `LaunchState.tokens_per_quote_*`.
- **Lifecycle** is only mutable via `advance_lifecycle` (authority). Supabase must not act as lifecycle authority.
- **Claim** requires `lifecycle == CLAIM_ACTIVE` and on-chain vesting math.

## Build

```bash
cd anchor && cargo build -p launch-controller --release
```

## Instructions

| Instruction | Purpose |
|-------------|---------|
| `initialize_launch` | Create `LaunchState` + vault ATA; `lifecycle = DRAFT` |
| `set_alpha_vault` | Link Meteora vault pubkey; `DRAFT → VAULT_OPEN` |
| `advance_lifecycle` | Strict transitions; sets `vesting_start_ts` when entering `CLAIM_ACTIVE` |
| `record_genesis_participation` | User + fixed quote → `DepositReceipt` + `MintReceipt` |
| `claim` | Pull vested project tokens to pass owner |

## Events

`LaunchInitialized`, `AlphaVaultLinked`, `LifecycleAdvanced`, `GenesisParticipationRecorded`, `TrancheClaimed`

TypeScript PDAs: [`../src/lib/launch-controller/pdas.ts`](../src/lib/launch-controller/pdas.ts)

## Product doc

See [`../docs/ARCHITECTURE_ENFORCEMENT.md`](../docs/ARCHITECTURE_ENFORCEMENT.md).
