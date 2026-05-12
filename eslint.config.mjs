import nextConfig from "eslint-config-next";

// L1 import bans: MUST match `L1_FORBIDDEN_IMPORTS_IN_API` in src/lib/architecture/enforcement-policy.ts
// (verified by scripts/verify-enforcement-island.ts).

/** Block L1 program wiring from Next.js API routes (L2/L3 surface only). */
const apiL1ImportBan = {
  name: "creator-launchpad/api-no-l1-imports",
  files: ["src/app/api/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/lib/launch-controller",
            message:
              "API routes are L2/L3 only. Import launch-controller from client tx builders or workers outside src/app/api.",
          },
          {
            name: "@/lib/launch/reward-token-distribute",
            message: "Removed payout planner module — not allowed in API routes.",
          },
        ],
        patterns: [
          {
            group: ["@/lib/launch-controller/*"],
            message:
              "API routes are L2/L3 only. Do not import from @/lib/launch-controller in src/app/api.",
          },
        ],
      },
    ],
  },
};

export default [...nextConfig, apiL1ImportBan];
