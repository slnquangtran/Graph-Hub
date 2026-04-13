import { GraphClient } from '../src/services/db/graph-client.ts';

async function test() {
  const db = GraphClient.getInstance();
  const res = await db.runCypher('MATCH (n) RETURN n, label(n) LIMIT 2');
  console.log(await res.getAll());
  
  const relsRes = await db.runCypher('MATCH ()-[r]->() RETURN r, label(r) LIMIT 2');
  console.log(await relsRes.getAll());
}

test().catch(console.error);
