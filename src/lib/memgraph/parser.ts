import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { CodeNode, CodeRelationship } from './types';

export class CodeParser {
  parseFile(filePath: string): { nodes: CodeNode[]; relationships: CodeRelationship[] } {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const nodes: CodeNode[] = [];
      const relationships: CodeRelationship[] = [];

      // Add file node
      const fileNode: CodeNode = {
        type: 'file',
        name: path.basename(filePath),
        path: filePath,
      };
      nodes.push(fileNode);

      // Visit all nodes
      this.visitNode(sourceFile, nodes, relationships, fileNode);

      return { nodes, relationships };
    } catch (error) {
      console.error(`[Parser] Error parsing ${filePath}:`, error);
      return { nodes: [], relationships: [] };
    }
  }

  private visitNode(
    node: ts.Node,
    nodes: CodeNode[],
    relationships: CodeRelationship[],
    parentFile: CodeNode
  ): void {
    // Extract functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      const funcNode = this.extractFunction(node, parentFile);
      nodes.push(funcNode);
      relationships.push({
        from: parentFile,
        to: funcNode,
        type: 'DEFINES',
      });
    }

    // Extract classes
    if (ts.isClassDeclaration(node) && node.name) {
      const classNode = this.extractClass(node, parentFile);
      nodes.push(classNode);
      relationships.push({
        from: parentFile,
        to: classNode,
        type: 'DEFINES',
      });
    }

    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const importNode = this.extractImport(node, parentFile);
      if (importNode) {
        nodes.push(importNode);
        relationships.push({
          from: parentFile,
          to: importNode,
          type: 'IMPORTS',
        });
      }
    }

    ts.forEachChild(node, child => this.visitNode(child, nodes, relationships, parentFile));
  }

  private extractFunction(node: ts.FunctionDeclaration, parentFile: CodeNode): CodeNode {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      type: 'function',
      name: node.name?.text || 'anonymous',
      path: sourceFile.fileName,
      line: line + 1,
      metadata: {
        isAsync: node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
        parameters: node.parameters.length,
      },
    };
  }

  private extractClass(node: ts.ClassDeclaration, parentFile: CodeNode): CodeNode {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      type: 'class',
      name: node.name?.text || 'anonymous',
      path: sourceFile.fileName,
      line: line + 1,
      metadata: {
        methods: node.members.filter(ts.isMethodDeclaration).length,
      },
    };
  }

  private extractImport(node: ts.ImportDeclaration, parentFile: CodeNode): CodeNode | null {
    try {
      const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const sourceFile = node.getSourceFile();
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

      return {
        type: 'import',
        name: moduleSpecifier,
        path: sourceFile.fileName,
        line: line + 1,
      };
    } catch {
      return null;
    }
  }
}
