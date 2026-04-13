import express from 'express';
import cors from 'cors';
import { GraphClient } from '../db/graph-client.ts';
import { RAGService } from '../ai/rag-service.ts';

export class GraphHubAPIServer {
  private app: express.Application;
  private db: GraphClient;
  private rag: RAGService;

  constructor() {
    this.app = express();
    this.db = GraphClient.getInstance();
    this.rag = RAGService.getInstance();
    
    this.app.use(cors());
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/api/graph', async (req, res) => {
      try {
        // Fetch all nodes and edges
        const nodesRes = await this.db.runCypher('MATCH (n) RETURN n');
        const relsRes = await this.db.runCypher('MATCH ()-[r]->() RETURN r');
        
        const nodes = (await nodesRes.getAll()).map((row: any) => ({
          id: row['n']._id?.offset.toString() || row['n'].id || row['n'].path,
          label: row['n'].name || row['n'].path || row['n'].text?.substring(0, 20),
          type: row['n']._label,
          properties: row['n']
        }));

        const edges = (await relsRes.getAll()).map((row: any) => ({
          id: `e-${row['r']._src.offset}-${row['r']._dst.offset}`,
          source: row['r']._src.offset.toString(),
          target: row['r']._dst.offset.toString(),
          label: row['r']._label
        }));

        res.json({ nodes, edges });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/search', async (req, res) => {
      try {
        const { query } = req.body;
        const results = await this.rag.search(query);
        res.json(results);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  public listen(port: number = 9000) {
    this.app.listen(port, () => {
      console.error(`GraphHub API Server running on http://localhost:${port}`);
    });
  }
}
