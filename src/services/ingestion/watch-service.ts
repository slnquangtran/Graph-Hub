import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { IngestionService } from './ingestion-service.ts';

const SUPPORTED_EXTS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py',
  '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift',
  '.md', '.txt', '.sh', '.ps1',
]);

export interface WatchOptions {
  debounceMs?: number;
  onEvent?: (kind: 'indexed' | 'removed' | 'skipped' | 'unsupported', filePath: string) => void;
}

export class WatchService {
  private ingestion: IngestionService;
  private watcher: fs.FSWatcher | null = null;
  private pending = new Map<string, NodeJS.Timeout>();

  constructor(ingestion: IngestionService) {
    this.ingestion = ingestion;
  }

  public async start(rootDir: string, options: WatchOptions = {}): Promise<void> {
    const debounceMs = options.debounceMs ?? 150;
    const root = path.resolve(rootDir);
    this.watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const full = path.resolve(root, filename.toString());
      const ext = path.extname(full).toLowerCase();
      if (!SUPPORTED_EXTS.has(ext)) return;

      const existing = this.pending.get(full);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        this.pending.delete(full);
        this.handleChange(full, options).catch((err) => {
          console.error(`Watch error on ${full}:`, err);
        });
      }, debounceMs);
      this.pending.set(full, t);
    });
  }

  private async handleChange(filePath: string, options: WatchOptions): Promise<void> {
    let exists = true;
    try {
      await fsp.access(filePath);
    } catch {
      exists = false;
    }
    if (!exists) {
      await this.ingestion.removeFileFromGraph(filePath);
      options.onEvent?.('removed', filePath);
      return;
    }
    const result = await this.ingestion.indexSingle(filePath);
    options.onEvent?.(result, filePath);
  }

  public async stop(): Promise<void> {
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
    this.watcher?.close();
    this.watcher = null;
  }
}
