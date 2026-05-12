/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import {
  PRIVY_SERVER_ENABLED,
  privyServerConfigMissing,
} from "@/lib/auth/privy-server";

export const dynamic = "force-dynamic";

/**
 * Read-only diagnostic for the Privy server config. Returns whether each
 * env var is *present* — never the secret value itself. Hit this in your
 * browser to confirm the running runtime is loading what you expect:
 *
 *   curl https://your-site/api/auth/privy/debug
 *   # { "enabled": true, "appIdSet": true, "appSecretSet": true, ... }
 *
 * If `appSecretSet` is false here, the runtime simply doesn't have the
 * secret in its environment — set it in Netlify's env var dashboard (or
 * restart your local dev server after editing .env.local).
 */
export function GET() {
  const appIdSet = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  const appSecretSet = Boolean(process.env.PRIVY_APP_SECRET);
  const enabledFlag = process.env.NEXT_PUBLIC_PRIVY_ENABLED === "true";

  return NextResponse.json({
    enabled: enabledFlag,
    appIdSet,
    appSecretSet,
    serverReady: PRIVY_SERVER_ENABLED,
    missing: privyServerConfigMissing(),
    runtime: process.env.NETLIFY ? "netlify" : "node",
  });
}
