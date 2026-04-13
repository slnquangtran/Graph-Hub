import { Parser, Language } from 'web-tree-sitter';
import path from 'path';

export interface SymbolDefinition {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'method' | 'import' | 'variable';
  range: {
    start: { row: number; column: number };
    end: { row: number; column: number };
  };
  calls?: string[];
}

export class CodeParser {
  private parser: Parser | null = null;
  private languages: Record<string, Parser.Language> = {};

  public async initialize(): Promise<void> {
    await Parser.init();
    this.parser = new Parser();

    // Load languages
    const langDir = path.resolve('node_modules');
    
    this.languages['typescript'] = await Language.load(
      path.join(langDir, 'tree-sitter-typescript', 'tree-sitter-typescript.wasm')
    );
    this.languages['javascript'] = await Language.load(
      path.join(langDir, 'tree-sitter-javascript', 'tree-sitter-javascript.wasm')
    );
    this.languages['tsx'] = await Language.load(
      path.join(langDir, 'tree-sitter-typescript', 'tree-sitter-tsx.wasm')
    );
  }

  public parse(sourceCode: string, language: string): SymbolDefinition[] {
    if (!this.parser || !this.languages[language]) {
      throw new Error(`Parser not initialized or language ${language} not supported.`);
    }

    this.parser.setLanguage(this.languages[language]);
    const tree = this.parser.parse(sourceCode);
    
    return this.extractSymbols(tree.rootNode);
  }

  private extractSymbols(rootNode: Parser.SyntaxNode): SymbolDefinition[] {
    const symbols: SymbolDefinition[] = [];
    let currentSymbolsStack: SymbolDefinition[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      let symbol: SymbolDefinition | null = null;

      // Basic extraction logic for TS/JS
      switch (node.type) {
        case 'function_declaration':
        case 'function_expression':
        case 'arrow_function':
        case 'method_definition':
          let kind: any = node.type === 'method_definition' ? 'method' : 'function';
          let name = 'anonymous';
          
          if (node.type === 'method_definition' || node.type === 'function_declaration') {
            name = node.childForFieldName('name')?.text || 'anonymous';
          }

          symbol = {
            name,
            kind,
            range: this.getRange(node),
            calls: []
          };
          break;
        case 'class_declaration':
          symbol = {
            name: node.childForFieldName('name')?.text || 'anonymous',
            kind: 'class',
            range: this.getRange(node),
          };
          break;
        case 'interface_declaration':
          symbol = {
            name: node.childForFieldName('name')?.text || 'anonymous',
            kind: 'interface',
            range: this.getRange(node),
          };
          break;
        case 'import_specifier':
        case 'import_clause':
          symbol = {
            name: node.text,
            kind: 'import',
            range: this.getRange(node),
          };
          break;
        
        // --- Call Extraction ---
        case 'call_expression':
          const caller = currentSymbolsStack[currentSymbolsStack.length - 1];
          if (caller && caller.calls) {
            const funcNode = node.childForFieldName('function');
            if (funcNode) {
              // Extract simple name from identifier or member expression
              let targetName = '';
              if (funcNode.type === 'identifier') {
                targetName = funcNode.text;
              } else if (funcNode.type === 'member_expression') {
                targetName = funcNode.childForFieldName('property')?.text || '';
              }
              
              if (targetName) {
                caller.calls.push(targetName);
              }
            }
          }
          break;
      }

      if (symbol) {
        symbols.push(symbol);
        if (['function', 'method'].includes(symbol.kind)) {
          currentSymbolsStack.push(symbol);
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        visit(node.child(i)!);
      }

      if (symbol && ['function', 'method'].includes(symbol.kind)) {
        currentSymbolsStack.pop();
      }
    };

    visit(rootNode);
    return symbols;
  }

  private getRange(node: Parser.SyntaxNode) {
    return {
      start: { row: node.startPosition.row, column: node.startPosition.column },
      end: { row: node.endPosition.row, column: node.endPosition.column },
    };
  }
}
