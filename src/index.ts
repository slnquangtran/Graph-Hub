import { IngestionService } from './services/ingestion/ingestion-service.ts';
import { GraphHubMCPServer } from './services/mcp/server.ts';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'serve';

  if (command === 'index') {
    const service = new IngestionService();
    console.error('--- GraphHub Indexer Starting ---');
    await service.initialize();
    
    const targetDir = args[1] || './src';
    console.error(`Indexing directory: ${path.resolve(targetDir)}`);
    await service.indexDirectory(targetDir);
    await service.resolveCalls();
    console.error('Indexing complete.');
    process.exit(0);
  } else if (command === 'serve') {
    const server = new GraphHubMCPServer();
    console.error('--- GraphHub MCP Server Starting ---');
    await server.run();
  } else {
    console.error('Usage: tsx src/index.ts [index <dir> | serve]');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
