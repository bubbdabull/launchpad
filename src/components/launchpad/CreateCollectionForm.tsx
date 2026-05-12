// Deprecated. The launch creation form is now CreateLaunchForm and the
// associated server-action state type is CreateLaunchState (was CreateDraftState
// in the EVM-era codebase). This file is kept as a thin re-export so any stale
// imports still compile and resolve to the live Solana flow.

export { CreateLaunchForm as CreateCollectionForm } from "./CreateLaunchForm";
export type { CreateLaunchState as CreateDraftState } from "@/app/create/actions";
