/**
 * Pure AST analysis for L2 routes (TypeScript compiler API). No orchestration —
 * callers use `enforcement-engine.ts`. Rule data: `enforcement-policy.ts`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

import {
  L2_AST_ANALYSIS_POLICY,
  L2_AST_FORBIDDEN_OBJECT_KEYS,
  L2_FORBIDDEN_SUBSTRINGS,
} from "./enforcement-policy";

export type L2AstViolation = {
  kind: string;
  message: string;
  line: number;
  column: number;
};

const FORBIDDEN_OBJECT_KEYS = new Set(L2_AST_FORBIDDEN_OBJECT_KEYS);

const SUBSTRING_FORBIDDEN = L2_FORBIDDEN_SUBSTRINGS;

/** Match `vested` without common false positives like `unvested` / `divested`. */
const VESTED_STANDALONE = /(?<![a-z])vested(?![a-z])/i;

function posLineCol(sf: ts.SourceFile, pos: number): { line: number; column: number } {
  const lc = sf.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, column: lc.character + 1 };
}

function push(
  out: L2AstViolation[],
  sf: ts.SourceFile,
  pos: number,
  kind: string,
  message: string,
) {
  const { line, column } = posLineCol(sf, pos);
  out.push({ kind, message, line, column });
}

/** Identifiers whose names embed financial-reconstruction semantics (per L2 policy). */
export function identifierHitsForbidden(name: string): string | null {
  if (!L2_AST_ANALYSIS_POLICY.identifierFinancialNames) return null;
  const lower = name.toLowerCase();
  if (lower.includes("payout")) return "payout";
  if (lower.includes("allocation")) return "allocation";
  if (lower.includes("claimable")) return "claimable";
  if (lower.includes("ownership")) return "ownership";
  if (lower.includes("rewardsperholder")) return "rewardsPerHolder";
  if (lower.includes("payoutsplit")) return "payoutSplit";
  if (lower.includes("feedistributionplan")) return "feeDistributionPlan";
  if (lower.includes("calculateclaimable")) return "calculateClaimable";
  if (lower.includes("estimatedentitlement")) return "estimatedEntitlement";
  if (lower.includes("authoritativeclaimable")) return "authoritativeClaimable";
  if (lower.includes("persistentitlement")) return "persistEntitlement";
  if (lower.includes("dbclaimable")) return "dbClaimable";
  if (lower.includes("computeholderrewards")) return "computeHolderRewards";
  if (lower.includes("computerewardsplit")) return "computeRewardSplit";
  if (lower.includes("canonicalclaimable")) return "canonicalClaimable";
  if (lower.includes("holderentitlement")) return "holderEntitlement";
  if (lower.includes("rewardsplitplanner")) return "rewardSplitPlanner";
  if (VESTED_STANDALONE.test(name)) return "vested";
  return null;
}

function collectStaticStringParts(node: ts.Node): string[] | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text];
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = collectStaticStringParts(node.left);
    const right = collectStaticStringParts(node.right);
    if (left && right) return [...left, ...right];
    return null;
  }
  return null;
}

function combinedStringViolates(combined: string): string | null {
  const lower = combined.toLowerCase();
  for (const s of SUBSTRING_FORBIDDEN) {
    if (lower.includes(s.toLowerCase())) return s;
  }
  return null;
}

function isDynamicJsonParseArgument(arg: ts.Expression): boolean {
  if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.PlusToken) return true;
  if (ts.isTemplateExpression(arg)) return true;
  return false;
}

function isEvalCall(node: ts.CallExpression): boolean {
  const expr = node.expression;
  return ts.isIdentifier(expr) && expr.text === "eval";
}

function isJsonParseCall(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const pa = node.expression;
  return (
    pa.name.text === "parse" &&
    ts.isIdentifier(pa.expression) &&
    pa.expression.text === "JSON"
  );
}

function forbiddenInTypeNode(node: ts.TypeNode | undefined, sf: ts.SourceFile, out: L2AstViolation[]) {
  if (!node || !L2_AST_ANALYSIS_POLICY.functionNameAndSignatureTypes) return;
  const visitType = (n: ts.TypeNode) => {
    const visit = (x: ts.Node) => {
      if (ts.isIdentifier(x)) {
        const hit = identifierHitsForbidden(x.text);
        if (hit) {
          push(
            out,
            sf,
            x.getStart(sf, false),
            "forbidden_type_identifier",
            `Forbidden financial identifier "${x.text}" inside a type (segment "${hit}")`,
          );
        }
      }
      ts.forEachChild(x, visit);
    };
    visit(n);
  };
  visitType(node);
}

export function scanL2SourceAST(sourceText: string, filePathForDisplay: string): L2AstViolation[] {
  const out: L2AstViolation[] = [];
  const sf = ts.createSourceFile(
    filePathForDisplay,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const p = node.parent;
      if (L2_AST_ANALYSIS_POLICY.forbiddenObjectKeys && ts.isPropertyAssignment(p) && p.name === node) {
        if (FORBIDDEN_OBJECT_KEYS.has(node.text)) {
          push(
            out,
            sf,
            node.getStart(sf, false),
            "forbidden_object_key",
            `Forbidden object key "${node.text}"`,
          );
        } else if (L2_AST_ANALYSIS_POLICY.identifierFinancialNames) {
          const hit = identifierHitsForbidden(node.text);
          if (hit) {
            push(
              out,
              sf,
              node.getStart(sf, false),
              "forbidden_object_property",
              `Object literal property name "${node.text}" embeds forbidden segment "${hit}"`,
            );
          }
        }
      } else if (L2_AST_ANALYSIS_POLICY.identifierFinancialNames) {
        const hit = identifierHitsForbidden(node.text);
        if (hit) {
          if (ts.isPropertyAccessExpression(p) && p.name === node) {
            push(
              out,
              sf,
              node.getStart(sf, false),
              "forbidden_member",
              `Forbidden member name "${node.text}" (segment "${hit}")`,
            );
          } else {
            push(
              out,
              sf,
              node.getStart(sf, false),
              "forbidden_identifier",
              `Forbidden identifier "${node.text}" (segment "${hit}")`,
            );
          }
        }
      }
    }

    if (L2_AST_ANALYSIS_POLICY.forbiddenObjectKeys) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const p = node.parent;
        if (ts.isPropertyAssignment(p) && p.name === node) {
          const key = node.text;
          if (FORBIDDEN_OBJECT_KEYS.has(key)) {
            push(out, sf, node.getStart(sf, false), "forbidden_object_key", `Forbidden object key "${key}"`);
          }
        }
      }

      if (ts.isPropertySignature(node)) {
        const n = node.name;
        if (ts.isIdentifier(n)) {
          if (FORBIDDEN_OBJECT_KEYS.has(n.text)) {
            push(out, sf, n.getStart(sf, false), "forbidden_object_key", `Forbidden type property "${n.text}"`);
          } else {
            const hit = identifierHitsForbidden(n.text);
            if (hit) {
              push(
                out,
                sf,
                n.getStart(sf, false),
                "forbidden_type_property",
                `Forbidden type property "${n.text}" (segment "${hit}")`,
              );
            }
          }
        } else if (ts.isStringLiteral(n) && FORBIDDEN_OBJECT_KEYS.has(n.text)) {
          push(out, sf, n.getStart(sf, false), "forbidden_object_key", `Forbidden type property "${n.text}"`);
        }
      }
    }

    if (L2_AST_ANALYSIS_POLICY.stringCompositionAgainstL2Substrings) {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const parts = collectStaticStringParts(node);
        if (parts) {
          const combined = parts.join("");
          const bad = combinedStringViolates(combined);
          if (bad) {
            push(
              out,
              sf,
              node.getStart(sf, false),
              "string_composition",
              `String concatenation forms forbidden fragment (matched ${JSON.stringify(bad)})`,
            );
          }
        }
      }
    }

    if (L2_AST_ANALYSIS_POLICY.templateShellAgainstL2Substrings) {
      if (ts.isTemplateExpression(node)) {
        let acc = node.head.text;
        for (const sp of node.templateSpans) {
          acc += sp.literal.text;
        }
        const bad = combinedStringViolates(acc);
        if (bad) {
          push(
            out,
            sf,
            node.getStart(sf, false),
            "template_shell",
            `Template literal static shell forms forbidden fragment (matched ${JSON.stringify(bad)})`,
          );
        }
      }
    }

    if (ts.isCallExpression(node)) {
      if (L2_AST_ANALYSIS_POLICY.evalCall && isEvalCall(node)) {
        push(out, sf, node.getStart(sf, false), "eval", "eval() is forbidden in L2 routes");
      }
      if (L2_AST_ANALYSIS_POLICY.dynamicJsonParse && isJsonParseCall(node)) {
        const arg = node.arguments[0];
        if (arg && isDynamicJsonParseArgument(arg)) {
          push(
            out,
            sf,
            node.getStart(sf, false),
            "json_parse_dynamic",
            "JSON.parse() on dynamically built strings is forbidden in L2 routes",
          );
        }
      }
    }

    if (L2_AST_ANALYSIS_POLICY.functionNameAndSignatureTypes) {
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        forbiddenInTypeNode(node.type, sf, out);
        for (const param of node.parameters) {
          forbiddenInTypeNode(param.type, sf, out);
        }
        const nameId =
          ts.isFunctionDeclaration(node) && node.name
            ? node.name
            : ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
              ? node.parent.name
              : null;
        if (nameId) {
          const fnHit = identifierHitsForbidden(nameId.text);
          if (fnHit) {
            push(
              out,
              sf,
              nameId.getStart(sf, false),
              "forbidden_function_name",
              `Function name "${nameId.text}" embeds forbidden segment "${fnHit}"`,
            );
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);

  return dedupeViolations(out);
}

function dedupeViolations(v: L2AstViolation[]): L2AstViolation[] {
  const seen = new Set<string>();
  const out: L2AstViolation[] = [];
  for (const x of v) {
    const k = `${x.line}:${x.column}:${x.kind}:${x.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export function scanL2FileAST(filePath: string): L2AstViolation[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const text = fs.readFileSync(abs, "utf8");
  return scanL2SourceAST(text, abs);
}

export function formatAstViolations(fileLabel: string, v: L2AstViolation[]): string {
  if (v.length === 0) return "";
  const lines = v.map((x) => `  ${fileLabel}:${x.line}:${x.column} [${x.kind}] ${x.message}`);
  return lines.join("\n");
}
