import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { GraphEngine } from './client';
import { DeprecationRule, Finding, Severity } from './types';
import { langFromExt, rulesForLang } from './rules';

/**
 * Parses source files and builds the in-memory code graph.
 *
 * For TypeScript/JavaScript: uses the TypeScript compiler AST to detect
 *   - File nodes
 *   - Function / arrow-function / method declarations  → DEFINES edges
 *   - Call expressions against the deprecation rules registry → USES edges
 *   - Import declarations → IMPORTS + DEPENDS_ON edges
 *
 * For Python / other languages: uses fast line-by-line regex scanning
 *   and writes simplified File→DeprecatedAPI USES edges.
 */
export class CodeParser {
  constructor(
    private graph: GraphEngine,
    private rules: DeprecationRule[]
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  parseFile(filePath: string): Finding[] {
    const ext = path.extname(filePath).toLowerCase();
    const lang = langFromExt(ext);
    const applicable = rulesForLang(lang, this.rules);

    if (applicable.length === 0) return [];

    try {
      const source = fs.readFileSync(filePath, 'utf-8');

      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx' || ext === '.mjs') {
        return this.parseTsJs(filePath, source, applicable);
      } else {
        return this.parseGeneric(filePath, source, applicable);
      }
    } catch {
      return [];
    }
  }

  // ── TypeScript / JavaScript AST parser ────────────────────────────────────

  private parseTsJs(filePath: string, source: string, rules: DeprecationRule[]): Finding[] {
    const findings: Finding[] = [];
    const fileKey = this.graph.addNode('file', path.basename(filePath), { path: filePath });

    const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
    const lines = source.split('\n');

    // Track current enclosing function stack for CALLS edges
    const funcStack: string[] = [fileKey];

    const visit = (node: ts.Node) => {
      // ── Function / method / arrow declarations ──────────────────────────
      const funcName = this.extractFuncName(node);
      if (funcName) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        const funcKey = this.graph.addNode('function', funcName, {
          path: filePath,
          line: line + 1,
        });
        this.graph.addEdge(fileKey, funcKey, 'DEFINES');

        // If there's a parent function, it calls this one too
        if (funcStack.length > 0) {
          const parent = funcStack[funcStack.length - 1];
          if (parent !== fileKey) {
            this.graph.addEdge(parent, funcKey, 'CALLS');
          }
        }

        funcStack.push(funcKey);
        ts.forEachChild(node, visit);
        funcStack.pop();
        return; // already visited children
      }

      // ── Import declarations ─────────────────────────────────────────────
      if (ts.isImportDeclaration(node)) {
        try {
          const mod = (node.moduleSpecifier as ts.StringLiteral).text;
          const importKey = this.graph.addNode('api', mod, { path: filePath });
          this.graph.addEdge(fileKey, importKey, 'IMPORTS');
        } catch { /* skip */ }
      }

      // ── Call expressions — check against rules ──────────────────────────
      if (ts.isCallExpression(node)) {
        const callText = node.expression.getText(sf);
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
        const snippet = lines[line]?.trim() ?? '';
        const enclosingFunc = funcStack[funcStack.length - 1];

        for (const rule of rules) {
          const re = new RegExp(rule.pattern, rule.flags ?? 'i');
          if (re.test(callText) || re.test(snippet)) {
            const deprKey = this.graph.addNode('deprecatedapi', rule.id, {
              metadata: { rule },
            });
            this.graph.addEdge(enclosingFunc, deprKey, 'USES', {
              line: line + 1,
              snippet,
            });

            findings.push({
              ruleId: rule.id,
              title: rule.title,
              severity: rule.severity,
              filePath,
              line: line + 1,
              col: character + 1,
              snippet,
              guidance: rule.guidance,
              replacement: rule.replacement,
              docsUrl: rule.docsUrl,
              propagationDepth: 0,
              propagationChain: [],
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sf, visit);
    return findings;
  }

  // ── Generic regex scanner (Python, Go, Java, C#, etc.) ───────────────────

  private parseGeneric(filePath: string, source: string, rules: DeprecationRule[]): Finding[] {
    const findings: Finding[] = [];
    const fileKey = this.graph.addNode('file', path.basename(filePath), { path: filePath });
    const lines = source.split('\n');

    lines.forEach((lineText, idx) => {
      for (const rule of rules) {
        const re = new RegExp(rule.pattern, rule.flags ?? 'i');
        if (re.test(lineText)) {
          const deprKey = this.graph.addNode('deprecatedapi', rule.id, {
            metadata: { rule },
          });
          this.graph.addEdge(fileKey, deprKey, 'USES', {
            line: idx + 1,
            snippet: lineText.trim(),
          });

          findings.push({
            ruleId: rule.id,
            title: rule.title,
            severity: rule.severity,
            filePath,
            line: idx + 1,
            col: 1,
            snippet: lineText.trim(),
            guidance: rule.guidance,
            replacement: rule.replacement,
            docsUrl: rule.docsUrl,
            propagationDepth: 0,
            propagationChain: [],
          });
        }
      }
    });

    return findings;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private extractFuncName(node: ts.Node): string | null {
    if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
    if (ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
    }
    if (ts.isFunctionExpression(node) && node.name) return node.name.text;
    return null;
  }
}
