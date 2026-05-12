/**
 * SINGLE CI / prebuild entry for protocol integrity + architecture enforcement.
 *
 * READ-ONLY: validates the repo; does not execute product behavior.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { verifyEnforcementIsland } from "../architecture/enforcement-island-verify";
import {
  enforceApiRoute,
  parseApiRouteLayerFromSource,
  scanProtocolFailureModesForLibSource,
  stripBlockCommentsForEnforcement,
} from "../architecture/enforcement-engine";
import { LAUNCH_STATE_VALUES } from "./protocol-spec";
import { LAUNCH_STATE_MONOTONIC_ORDER } from "./state-machine";

function walkApiRouteFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkApiRouteFiles(p));
    else if (name.isFile() && name.name === "route.ts") out.push(p);
  }
  return out;
}

function walkLibTsFiles(libRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, name.name);
      const relFromLib = path.relative(libRoot, p);
      if (name.isDirectory()) {
        if (name.name === "architecture" || name.name === "protocol") continue;
        walk(p);
      } else if (name.isFile() && name.name.endsWith(".ts")) {
        if (relFromLib.startsWith(`architecture${path.sep}`) || relFromLib.startsWith(`protocol${path.sep}`)) {
          continue;
        }
        out.push(p);
      }
    }
  };
  walk(libRoot);
  return out;
}

/** Structural cross-check: spec enum aligns with state-machine spine. */
function assertLaunchStateSpineAligned(): string[] {
  const errs: string[] = [];
  if (LAUNCH_STATE_VALUES.length !== LAUNCH_STATE_MONOTONIC_ORDER.length) {
    errs.push("protocol: LAUNCH_STATE_VALUES length != LAUNCH_STATE_MONOTONIC_ORDER");
  }
  for (let i = 0; i < LAUNCH_STATE_VALUES.length; i++) {
    if (LAUNCH_STATE_VALUES[i] !== LAUNCH_STATE_MONOTONIC_ORDER[i]) {
      errs.push(
        `protocol: launch state mismatch at index ${i}: spec=${LAUNCH_STATE_VALUES[i]} spine=${LAUNCH_STATE_MONOTONIC_ORDER[i]}`,
      );
    }
  }
  return errs;
}

/**
 * Full protocol + architecture validation for `repoPath` (repo root).
 * Returns a deterministic ordered list of violation messages (empty = OK).
 */
export function validateProtocolIntegrity(repoPath: string): string[] {
  const errors: string[] = [];

  errors.push(...verifyEnforcementIsland(repoPath));
  errors.push(...assertLaunchStateSpineAligned());

  const apiRoot = path.join(repoPath, "src", "app", "api");
  const routes = walkApiRouteFiles(apiRoot);
  if (routes.length === 0) {
    errors.push("validate-protocol: no route.ts files under src/app/api");
  }

  for (const abs of routes) {
    const rel = path.relative(repoPath, abs);
    const raw = fs.readFileSync(abs, "utf8");
    const layer = parseApiRouteLayerFromSource(raw);
    if (layer === null) {
      errors.push(`${rel}: missing @apiRouteLayer L2|L3|FORBIDDEN (see architecture docs)`);
      continue;
    }
    errors.push(...enforceApiRoute(abs, layer, { source: raw, cwd: repoPath }));
  }

  const libRoot = path.join(repoPath, "src", "lib");
  for (const abs of walkLibTsFiles(libRoot)) {
    const rel = path.relative(repoPath, abs);
    const raw = fs.readFileSync(abs, "utf8");
    const body = stripBlockCommentsForEnforcement(raw);
    errors.push(...scanProtocolFailureModesForLibSource(rel, body));
  }

  return errors;
}

function main(): void {
  const repoPath = process.cwd();
  const errors = validateProtocolIntegrity(repoPath);
  if (errors.length) {
    console.error("validate-protocol: FAILED\n\n" + errors.join("\n"));
    process.exit(1);
  }
  const nRoutes = walkApiRouteFiles(path.join(repoPath, "src", "app", "api")).length;
  console.log(`validate-protocol: OK (API routes: ${nRoutes}, protocol + architecture checks)`);
}

const entry = (process.argv[1] ?? "").replace(/\\/g, "/");
if (entry.endsWith("src/lib/protocol/validate-protocol.ts") || entry.endsWith("/validate-protocol.ts")) {
  main();
}
