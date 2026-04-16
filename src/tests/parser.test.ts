import { describe, it, expect, beforeAll } from 'vitest';
import { CodeParser } from '../services/ingestion/parser.ts';

describe('CodeParser', () => {
  let parser: CodeParser;

  beforeAll(async () => {
    parser = new CodeParser();
    await parser.initialize();
  });

  it('should extract class and method definitions with metadata', () => {
    const code = `
      class TestScanner {
        /**
         * Scans a directory for symbols.
         * TODO: Add support for more languages.
         */
        public scan(dir: string, depth: number = 5): Promise<void> {
          this.parser.parse(dir);
          return Promise.resolve();
        }
      }
    `;
    const symbols = parser.parse(code, 'typescript');
    
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'TestScanner',
      kind: 'class'
    }));
    
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'scan',
      kind: 'method',
      inputs: ['dir: string', 'depth: number = 5'],
      outputs: ['Promise<void>'],
      calls: ['parse', 'resolve']
    }));
  });

  it('should extract function declarations from JavaScript with inferred types', () => {
    const code = `
      function helloWorld(name) {
        console.log("Hello " + name);
        return "Greeting sent";
      }
    `;
    const symbols = parser.parse(code, 'javascript');
    
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'helloWorld',
      kind: 'function',
      inputs: ['name'],
      outputs: ['inferred_dynamic_type'],
      calls: ['log']
    }));
  });

  it('should handle arrow functions and variables', () => {
    const code = `
      const add = (a: number, b: number): number => a + b;
    `;
    const symbols = parser.parse(code, 'typescript');
    
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'add',
      kind: 'function',
      inputs: ['a: number', 'b: number'],
      outputs: ['number']
    }));
  });
});
