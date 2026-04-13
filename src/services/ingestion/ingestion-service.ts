import fs from 'fs/promises';
import path from 'path';
import { CodeParser, SymbolDefinition } from './parser.ts';
import { GraphClient } from '../db/graph-client.ts';

export class IngestionService {
  private parser: CodeParser;
  private db: GraphClient;

  constructor() {
    this.parser = new CodeParser();
    this.db = GraphClient.getInstance();
  }

  public async initialize(): Promise<void> {
    await this.parser.initialize();
    await this.db.initializeSchema();
  }

  public async indexFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    const ext = path.extname(filePath).slice(1);
    
    let language = 'javascript';
    if (ext === 'ts') language = 'typescript';
    if (ext === 'tsx') language = 'tsx';

    const symbols = this.parser.parse(content, language);

    // 1. Add File Node
    await this.db.runCypher(
      'MERGE (f:File {path: $path}) ON CREATE SET f.language = $language',
      { path: absolutePath, language }
    );

    // 2. Add Symbols and CONTAINS relationship
    for (const sym of symbols) {
      const symId = `${absolutePath}:${sym.name}:${sym.kind}:${sym.range.start.row}`;
      
      await this.db.runCypher(
        'MERGE (s:Symbol {id: $id}) ' +
        'ON CREATE SET s.name = $name, s.kind = $kind, s.range = $range, s.calls = $calls',
        { 
          id: symId, 
          name: sym.name, 
          kind: sym.kind, 
          range: JSON.stringify(sym.range),
          calls: sym.calls || []
        }
      );

      await this.db.runCypher(
        'MATCH (f:File {path: $path}), (s:Symbol {id: $symId}) ' +
        'MERGE (f)-[:CONTAINS]->(s)',
        { path: absolutePath, symId }
      );
    }

    console.log(`Indexed ${filePath} with ${symbols.length} symbols.`);
  }

  public async resolveCalls(): Promise<void> {
    console.log('Resolving symbol calls across the graph...');
    try {
      // Heuristic resolution: Link callers to any symbol with matching name
      await this.db.runCypher(
        'MATCH (s1:Symbol) ' +
        'UNWIND s1.calls AS targetName ' +
        'MATCH (s2:Symbol {name: targetName}) ' +
        'WHERE s1.id <> s2.id ' +
        'MERGE (s1)-[:CALLS]->(s2)'
      );
      console.log('Call resolution complete.');
    } catch (error) {
      console.error('Error during call resolution:', error);
    }
  }

  public async indexDirectory(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.graphhub') continue;
        await this.indexDirectory(fullPath);
      } else {
        const ext = path.extname(entry.name);
        if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
          await this.indexFile(fullPath);
        }
      }
    }
  }
}
