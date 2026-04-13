import { GraphClient } from './graph-client.ts';

export class GraphExporter {
  private db: GraphClient;

  constructor() {
    this.db = GraphClient.getInstance();
  }

  public async exportToMermaid(): Promise<string> {
    const symbolsResult = await this.db.runCypher('MATCH (s:Symbol) RETURN s.id as id, s.name as name, s.kind as kind');
    const symbols = await symbolsResult.getAll();
    
    const callsResult = await this.db.runCypher('MATCH (s1:Symbol)-[:CALLS]->(s2:Symbol) RETURN s1.id as caller, s2.id as callee');
    const calls = await callsResult.getAll();

    let mermaid = 'graph TD\n';
    
    // Create nodes with human-readable IDs for Mermaid
    const idMap: Record<string, string> = {};
    symbols.forEach((s: any, index: number) => {
      const safeId = `node_${index}`;
      idMap[s.id] = safeId;
      mermaid += `  ${safeId}["${s.name} (${s.kind})"]\n`;
    });

    // Create edges
    calls.forEach((c: any) => {
      if (idMap[c.caller] && idMap[c.callee]) {
        mermaid += `  ${idMap[c.caller]} --> ${idMap[c.callee]}\n`;
      }
    });

    return mermaid;
  }
}
