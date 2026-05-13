/**
 * One-shot helper: add `* @apiRouteLayer L2|L3` to route file comments (Next.js 16+
 * rejects `export const LAYER` on `route.ts`). Re-run only when adding new API routes
 * (or add ` * @apiRouteLayer …` manually to the opening docblock).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Relative to repo root */
const LAYER_BY_FILE = {
  "src/app/api/launches/index/route.ts": "L2",
  "src/app/api/creator/dashboard/route.ts": "L2",
  "src/app/api/launches/[slug]/yield/route.ts": "L2",
  "src/app/api/webhooks/helius/route.ts": "L2",
  "src/app/api/launches/[slug]/deploy/route.ts": "L2",
  "src/app/api/reputation/[address]/route.ts": "L2",
  "src/app/api/launches/[slug]/signals/latest/route.ts": "L2",
  "src/app/api/ecosystem/signals-methodology/route.ts": "L2",
  "src/app/api/referrals/me/route.ts": "L2",
  "src/app/api/referrals/record/route.ts": "L2",
  "src/app/api/referrals/leaderboard/route.ts": "L2",
  "src/app/api/health/supabase/route.ts": "L2",

  "src/app/api/launches/[slug]/reward-holders/route.ts": "L3",
  "src/app/api/admin/verify-creator/route.ts": "L3",
  "src/app/api/ai/enrich-metadata-field/route.ts": "L3",
  "src/app/api/ai/launch-assist/route.ts": "L3",
  "src/app/api/ai/generate-full-project/route.ts": "L3",
  "src/app/api/ai/generate-launch-image/route.ts": "L3",
  "src/app/api/ai/enrich-token-metadata/route.ts": "L3",
  "src/app/api/upload/collection-asset/route.ts": "L3",
  "src/app/api/metadata/asset/[address]/route.ts": "L3",
  "src/app/api/metadata/collection/[slug]/route.ts": "L3",
  "src/app/api/metadata/token/[slug]/route.ts": "L3",
  "src/app/api/auth/privy/debug/route.ts": "L3",
  "src/app/api/auth/privy/login/route.ts": "L3",
  "src/app/api/auth/privy/logout/route.ts": "L3",
  "src/app/api/auth/siwe/verify/route.ts": "L3",
  "src/app/api/auth/siwe/nonce/route.ts": "L3",
  "src/app/api/creator/profile/route.ts": "L3",
  "src/app/api/auth/siws/logout/route.ts": "L3",
  "src/app/api/auth/siws/verify/route.ts": "L3",
  "src/app/api/auth/siws/nonce/route.ts": "L3",
};

const TAG_RE = /@apiRouteLayer\s+(L2|L3|FORBIDDEN)\b/;

function injectTag(rel) {
  const layer = LAYER_BY_FILE[rel];
  if (!layer) throw new Error(`Missing layer mapping for ${rel}`);
  const abs = path.join(root, rel);
  let s = fs.readFileSync(abs, "utf8");
  if (TAG_RE.test(s)) {
    console.log("skip (already tagged):", rel);
    return;
  }
  const line = ` * @apiRouteLayer ${layer}\n`;
  if (s.startsWith("/**")) {
    s = s.replace(/^\/\*\*\n/, `/**\n${line}`, 1);
  } else {
    s = `/**\n${line} */\n\n${s}`;
  }
  fs.writeFileSync(abs, s);
  console.log("tagged:", rel, layer);
}

for (const rel of Object.keys(LAYER_BY_FILE)) {
  injectTag(rel);
}
