/**
 * Unified enforcement orchestration for API routes, L2 semantics, and
 * **protocol failure modes** (read-only spec in `src/lib/protocol/*`).
 *
 * ENFORCEMENT MUST BE DETERMINISTIC: same file bytes + same options → the same
 * ordered violation messages. Architecture rules: `enforcement-policy.ts`.
 * Protocol taxonomy: `failure-modes.ts` + `protocol-spec.ts`. AST walks only
 * via `l2-ast-scanner.ts` (no duplicated AST logic here).
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { ApiRouteLayer } from "./enforcement-policy";
import {
  API_ROUTE_LAYER_EXPORT_RE,
  API_ROUTE_LAYER_SATISFIES_RE,
  API_ROUTE_LAYER_TAG_RE,
  FORBIDDEN_OPERATION_MARKERS,
  L1_FORBIDDEN_IMPORTS_IN_API,
  L2_FORBIDDEN_SUBSTRINGS,
  l2FileEnforcementAtModuleLoad,
} from "./enforcement-policy";
import failureModes from "../protocol/failure-modes";
import protocolSpec from "../protocol/protocol-spec";
import { formatAstViolations, scanL2SourceAST } from "./l2-ast-scanner";

type ProtocolFailureScope = import("../protocol/failure-modes").ProtocolFailureScope;

function scopesForApiLayer(layer: ApiRouteLayer): ProtocolFailureScope[] {
  if (layer === "L2") return ["L2_ROUTE"];
  if (layer === "L3") return ["L3_ROUTE"];
  return ["L2_ROUTE", "L3_ROUTE"];
}

/**
 * Protocol-grade failure modes (substring hooks). AST remains delegated to
 * `scanL2SourceAST` inside `enforceL2File` only — no duplicated AST walks here.
 */
export function scanProtocolFailureModesForApiRoute(
  relPath: string,
  bodyWithoutBlockComments: string,
  layer: ApiRouteLayer,
): string[] {
  void protocolSpec.version;
  const scopes = scopesForApiLayer(layer);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const mode of failureModes.modes) {
    if (!mode.scope.some((s) => scopes.includes(s))) continue;
    for (const sub of mode.detectionSubstrings) {
      if (!bodyWithoutBlockComments.includes(sub)) continue;
      const key = `${mode.id}:${sub}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        `${relPath}: [PROTOCOL ${protocolSpec.version}][CRITICAL][${mode.id}] ${mode.description} (matched ${JSON.stringify(sub)}) [hook:${mode.astHook}]`,
      );
    }
  }
  return out;
}

/** `src/lib/**` scan (excludes architecture + protocol folders by caller). */
export function scanProtocolFailureModesForLibSource(
  relPath: string,
  bodyWithoutBlockComments: string,
): string[] {
  void protocolSpec.version;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const mode of failureModes.modes) {
    if (!mode.scope.includes("LIB_TS")) continue;
    for (const sub of mode.detectionSubstrings) {
      if (!bodyWithoutBlockComments.includes(sub)) continue;
      const key = `${mode.id}:${sub}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        `${relPath}: [PROTOCOL ${protocolSpec.version}][CRITICAL][${mode.id}] ${mode.description} (matched ${JSON.stringify(sub)}) [hook:${mode.astHook}]`,
      );
    }
  }
  return out;
}

export function stripBlockCommentsForEnforcement(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function parseApiRouteLayerFromSource(source: string): ApiRouteLayer | null {
  const tag = source.match(API_ROUTE_LAYER_TAG_RE);
  if (tag) return tag[1] as ApiRouteLayer;
  const m = source.match(API_ROUTE_LAYER_EXPORT_RE) || source.match(API_ROUTE_LAYER_SATISFIES_RE);
  return m ? (m[1] as ApiRouteLayer) : null;
}

/** First forbidden L2 substring match, or null (deterministic: first list order). */
export function scanL2SourceForForbiddenSubstrings(source: string): string | null {
  const body = stripBlockCommentsForEnforcement(source);
  for (const s of L2_FORBIDDEN_SUBSTRINGS) {
    if (body.includes(s)) return s;
  }
  return null;
}

export type EnforceL2FileOptions = {
  /** When false, substring scan only (runtime module boundary default). */
  includeAst?: boolean;
  /** When set, skip reading from disk (must match filePath content). */
  source?: string;
  cwd?: string;
};

function resolveAbs(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
}

function relLabel(abs: string, cwd: string): string {
  return path.relative(cwd, abs) || abs;
}

/**
 * L2 semantic enforcement only (substring + optional AST). Does not validate
 * `LAYER` export or L1 imports.
 */
export function enforceL2File(filePath: string, options?: EnforceL2FileOptions): string[] {
  const cwd = options?.cwd ?? process.cwd();
  const abs = resolveAbs(filePath, cwd);
  const includeAst = options?.includeAst ?? true;
  let text: string;
  try {
    text = options?.source ?? fs.readFileSync(abs, "utf8");
  } catch {
    return [`${relLabel(abs, cwd)}: could not read file`];
  }
  const rel = relLabel(abs, cwd);
  const violations: string[] = [];
  const body = stripBlockCommentsForEnforcement(text);

  for (const s of L2_FORBIDDEN_SUBSTRINGS) {
    if (body.includes(s)) {
      violations.push(`${rel}: L2 semantic violation — forbidden pattern ${JSON.stringify(s)}`);
    }
  }

  if (includeAst) {
    const astHits = scanL2SourceAST(text, abs);
    if (astHits.length > 0) {
      violations.push(`${rel}: L2 AST semantic violation(s)\n${formatAstViolations(rel, astHits)}`);
    }
  }

  return violations;
}

function isProductionish(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export type EnforceApiRouteOptions = {
  source?: string;
  cwd?: string;
};

/**
 * Full API route checks. `layer` must match `@apiRouteLayer` (or legacy `export const LAYER`) in the file source.
 */
export function enforceApiRoute(
  filePath: string,
  layer: ApiRouteLayer,
  options?: EnforceApiRouteOptions,
): string[] {
  const cwd = options?.cwd ?? process.cwd();
  const abs = resolveAbs(filePath, cwd);
  const rel = relLabel(abs, cwd);
  let raw: string;
  try {
    raw = options?.source ?? fs.readFileSync(abs, "utf8");
  } catch {
    return [`${rel}: could not read file`];
  }

  const violations: string[] = [];
  const parsed = parseApiRouteLayerFromSource(raw);
  if (parsed === null) {
    violations.push(
      `${rel}: missing @apiRouteLayer L2|L3|FORBIDDEN (doc comment line, e.g. " * @apiRouteLayer L3")`,
    );
    return violations;
  }
  if (parsed !== layer) {
    violations.push(
      `${rel}: layer argument does not match file marker (argument was ${JSON.stringify(layer)}, file has ${JSON.stringify(parsed)})`,
    );
  }
  const effective = parsed;

  if (effective === "FORBIDDEN" && isProductionish()) {
    violations.push(
      `${rel}: LAYER is FORBIDDEN — remove this route or downgrade before production (chain truth must not be served from this surface).`,
    );
  }

  const body = stripBlockCommentsForEnforcement(raw);

  if (effective === "L2" || effective === "L3") {
    for (const banned of L1_FORBIDDEN_IMPORTS_IN_API) {
      const needle = `from "${banned}"`;
      const needle2 = `from '${banned}'`;
      const needleStar = `from "${banned}/`;
      const needleStar2 = `from '${banned}/`;
      if (
        body.includes(needle) ||
        body.includes(needle2) ||
        body.includes(needleStar) ||
        body.includes(needleStar2)
      ) {
        violations.push(`${rel}: forbidden import ${banned} (API routes are L2/L3 only).`);
      }
    }
    for (const marker of FORBIDDEN_OPERATION_MARKERS) {
      if (body.includes(marker)) {
        violations.push(`${rel}: forbidden operation marker "${marker}"`);
      }
    }
  }

  violations.push(...scanProtocolFailureModesForApiRoute(rel, body, effective));

  if (effective === "L2") {
    violations.push(...enforceL2File(abs, { includeAst: true, source: raw, cwd }));
  }

  return violations;
}

/**
 * Dynamic fragments (SQL strings, etc.): substring policy only (no AST).
 */
export function assertL2DynamicSnippetInvariant(fnName: string, code: string): void {
  if (!code) return;
  const hit = scanL2SourceForForbiddenSubstrings(code);
  if (!hit) return;
  const soft = process.env.L2_INVARIANT_SOFT === "1";
  const msg = `L2 invariant violation (${fnName}): forbidden pattern ${JSON.stringify(hit)}`;
  if (soft && process.env.NODE_ENV === "development") {
    console.warn(`[L2_SOFT] ${msg}`);
    return;
  }
  throw new Error(msg);
}

/**
 * Route module boundary: same engine as CI; AST at runtime is opt-in (see
 * `l2FileEnforcementAtModuleLoad` in policy) so default prod bundles avoid loading
 * `typescript`.
 */
export function enforceL2RouteModuleBoundary(repoRelativePath: string, routeLabel: string): void {
  const cwd = process.cwd();
  const abs = path.join(cwd, repoRelativePath);
  if (!fs.existsSync(abs)) return;
  let src: string;
  try {
    src = fs.readFileSync(abs, "utf8");
  } catch {
    return;
  }
  const { includeAst } = l2FileEnforcementAtModuleLoad();
  const violations = enforceL2File(abs, { includeAst, source: src, cwd });
  if (violations.length === 0) return;
  const soft = process.env.L2_INVARIANT_SOFT === "1";
  const msg = `L2 invariant violation (${routeLabel} in ${repoRelativePath}):\n${violations.join("\n")}`;
  if (soft && process.env.NODE_ENV === "development") {
    console.warn(`[L2_SOFT] ${msg}`);
    return;
  }
  throw new Error(msg);
}
