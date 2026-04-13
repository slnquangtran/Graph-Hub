import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphClient } from '../services/db/graph-client.ts';
import fs from 'fs';
import path from 'path';

describe('GraphClient', () => {
  const testDbPath = './.graphhub/test-db';
  let client: any;

  beforeAll(async () => {
    // Cleanup old test db if it exists
    if (fs.existsSync(testDbPath)) {
      // KuzuDB files might be locked, we'll try to delete or just use a new path
    }
    
    // We override the singleton for testing or just create a new instance if we could.
    // Given the singleton implementation, we'll just test the getInstance for now.
    client = GraphClient.getInstance();
    await client.initializeSchema();
  });

  it('should be able to run a simple cypher query', async () => {
    const result = await client.runCypher('RETURN 1 as val');
    const rows = await result.getAll();
    expect(rows[0].val).toBe(1);
  });

  it('should be able to create and find a node', async () => {
    const testPath = '/tmp/test.ts';
    await client.runCypher('MERGE (f:File {path: $path})', { path: testPath });
    const result = await client.runCypher('MATCH (f:File {path: $path}) RETURN f.path as path', { path: testPath });
    const rows = await result.getAll();
    expect(rows[0].path).toBe(testPath);
  });
});
