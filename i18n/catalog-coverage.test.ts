import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import hu from "@/messages/hu.json";

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(file);
    return /\.tsx?$/.test(file) && !/\.(test|spec)\.|\.d\.ts$/.test(file) ? [file] : [];
  });
}

describe("translation coverage", () => {
  it("does not render raw English copy in JSX, field hints, or toasts", () => {
    const raw: string[] = [];
    const neutral = new Set(["BeeSmart", "KB", "MB", "GB", "PDF"]);
    function record(file: string, copy: string) {
      const text = copy.trim();
      if (/[A-Za-z]{2}/.test(text) && !neutral.has(text)) raw.push(`${file}: ${text}`);
    }
    for (const file of [...componentFiles("app"), ...componentFiles("components"), ...componentFiles("hooks")]) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      function visit(node: ts.Node) {
        if (ts.isJsxText(node)) record(file, node.text);
        if (ts.isJsxAttribute(node) && /^(hint|placeholder|aria-label|ariaLabel|alt)$/.test(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) record(file, node.initializer.text);
        if (ts.isCallExpression(node) && /^(toast\.(success|error|loading|info|warning)|window\.confirm)$/.test(node.expression.getText(source))) {
          const argument = node.arguments[0];
          if (argument && ts.isStringLiteral(argument)) record(file, argument.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(raw).toEqual([]);
  });
  it("registers static API error and status messages", () => {
    const sources = new Set<string>(Object.values(en.UI));
    const missing: string[] = [];
    for (const file of componentFiles("app/api")) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isPropertyAssignment(node) && /^(error|message)$/.test(node.name.getText(source)) && ts.isStringLiteral(node.initializer) && !sources.has(node.initializer.text)) missing.push(`${file}: ${node.initializer.text}`);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });
  it("registers every literal translation call in the interface", () => {
    const sources = new Set<string>(Object.values(en.UI));
    const missing: string[] = [];
    for (const file of [...componentFiles("app"), ...componentFiles("components"), ...componentFiles("hooks")]) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const variables = new Map<string, ts.Expression>();
      function collect(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
        ts.forEachChild(node, collect);
      }
      collect(source);
      function check(argument: ts.Node) {
        if (ts.isStringLiteral(argument) && /[A-Za-z]{3}/.test(argument.text) && !sources.has(argument.text)) missing.push(`${file}: ${argument.text}`);
        else if (ts.isConditionalExpression(argument)) { check(argument.whenTrue); check(argument.whenFalse); }
        else if (ts.isBinaryExpression(argument) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(argument.operatorToken.kind)) check(argument.right);
      }
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
          const argument = node.arguments[0];
          if (argument) {
            if (ts.isIdentifier(argument)) {
              const initializer = variables.get(argument.text);
              if (initializer) check(initializer);
            } else check(argument);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });
  it("keeps activity translations available in both languages", () => {
    expect(Object.keys(hu.Activity).sort()).toEqual(Object.keys(en.Activity).sort());
    expect(hu.Activity.COURSE_COMPLETED).toBe("Teljesítette:");
    const completedKey = Object.entries(en.UI).find(([, source]) => source === "Completed")![0] as keyof typeof hu.UI;
    expect(hu.UI[completedKey]).toBe("Teljesítve");
  });
});
