import { describe, it, expect, beforeAll } from 'vitest';
import { CodeParser } from '../services/ingestion/parser.ts';

describe('CodeParser', () => {
  let parser: CodeParser;

  beforeAll(async () => {
    parser = new CodeParser();
    await parser.initialize();
  });

  it('should extract class and method definitions from TypeScript', () => {
    const code = `
      class TestScanner {
        public scan(dir: string): void {
          console.log(dir);
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
      kind: 'method'
    }));
  });

  it('should extract function declarations from JavaScript', () => {
    const code = `
      function helloWorld() {
        return "Hello!";
      }
    `;
    const symbols = parser.parse(code, 'javascript');
    
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'helloWorld',
      kind: 'function'
    }));
  });
});
