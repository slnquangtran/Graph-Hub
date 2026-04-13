import { GraphExporter } from './services/db/graph-exporter.ts';
import fs from 'fs';

async function main() {
  console.error('Generating codebase graph...');
  const exporter = new GraphExporter();
  const mermaid = await exporter.exportToMermaid();
  
  console.log('--- MERMAID GRAPH START ---');
  console.log(mermaid);
  console.log('--- MERMAID GRAPH END ---');
  
  // Also save to a file for reference
  fs.writeFileSync('graph.mermaid', mermaid);
  console.error('Graph saved to graph.mermaid');
}

main().catch(err => {
  console.error('Visualization failed:', err);
});
