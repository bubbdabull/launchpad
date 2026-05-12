/**
 * Meta-check: fail CI if enforcement rules drift outside the allowed island.
 * Uses `enforcement-policy.ts` only — no duplicate rule lists.
 *
 * Allowed to import `fs` / `path` (Node); rule data always from policy.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { L1_FORBIDDEN_IMPORTS_IN_API } from "./enforcement-policy";

const ENFORCE_SCRIPT = "src/lib/protocol/validate-protocol.ts";

export function verifyEnforcementIsland(root: string): string[] {
  const errors: string[] = [];

  const legacyJson = path.join(root, "src/lib/architecture/l2-forbidden-patterns.json");
  if (fs.existsSync(legacyJson)) {
    errors.push(
      "Remove src/lib/architecture/l2-forbidden-patterns.json — forbidden substrings live in enforcement-policy.ts only.",
    );
  }

  const eslintPath = path.join(root, "eslint.config.mjs");
  if (!fs.existsSync(eslintPath)) {
    errors.push("eslint.config.mjs missing.");
  } else {
    const eslintText = fs.readFileSync(eslintPath, "utf8");
    for (const spec of L1_FORBIDDEN_IMPORTS_IN_API) {
      if (!eslintText.includes(spec)) {
        errors.push(
          `eslint.config.mjs must list no-restricted-imports ban for "${spec}" (lockstep with enforcement-policy.ts).`,
        );
      }
    }
    if (!eslintText.includes("enforcement-policy.ts")) {
      errors.push(
        "eslint.config.mjs must reference enforcement-policy.ts in a comment (ESLint cannot import TS policy).",
      );
    }
  }

  const enforcePath = path.join(root, ENFORCE_SCRIPT);
  const enforceSrc = fs.readFileSync(enforcePath, "utf8");
  const bannedSubstrings = [
    "LAYER_EXPORT_RE",
    "LAYER_SATISFIES_RE",
    "FORBIDDEN_OPERATION_MARKERS",
    "L2_FORBIDDEN_SUBSTRINGS",
  ];
  for (const s of bannedSubstrings) {
    if (enforceSrc.includes(s)) {
      errors.push(
        `${ENFORCE_SCRIPT} must not embed "${s}" — use enforcement-engine / enforcement-policy only.`,
      );
    }
  }

  const archDir = path.join(root, "src/lib/architecture");
  const mayImportTypescript = new Set(["l2-ast-scanner.ts"]);
  for (const name of fs.readdirSync(archDir)) {
    if (!name.endsWith(".ts")) continue;
    const full = path.join(archDir, name);
    if (name === "enforcement-island-verify.ts") continue;
    const text = fs.readFileSync(full, "utf8");
    if (!mayImportTypescript.has(name) && /\bfrom\s+["']typescript["']/.test(text)) {
      errors.push(`${path.relative(root, full)}: must not import "typescript" (keep AST in l2-ast-scanner only).`);
    }
  }

  const invPath = path.join(root, "src/lib/architecture/l2-invariants.ts");
  const inv = fs.readFileSync(invPath, "utf8");
  if (inv.includes("stripBlockComments") || inv.includes("l2-forbidden-patterns")) {
    errors.push("l2-invariants.ts must delegate to enforcement-engine only (no local scanners / legacy json).");
  }

  return errors;
}
