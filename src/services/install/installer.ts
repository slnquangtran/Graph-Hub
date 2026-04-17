import fs from 'fs';
import path from 'path';
import os from 'os';

interface HookEntry {
  type: string;
  command: string;
}

interface HookConfig {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    cwd?: string;
  }>;
  hooks?: {
    PreToolUse?: HookConfig[];
    PostToolUse?: HookConfig[];
  };
}

export class Installer {
  private graphhubDir: string;

  constructor() {
    this.graphhubDir = process.cwd();
  }

  public async installForClaudeCode(projectDir?: string): Promise<void> {
    const targetDir = projectDir || process.cwd();
    const claudeDir = path.join(targetDir, '.claude');

    fs.mkdirSync(claudeDir, { recursive: true });

    // 1. Create/update settings.json with MCP server config
    await this.configureMcpServer(claudeDir);

    // 2. Add PreToolUse hook for always-on graph context
    await this.configurePreToolHook(claudeDir);

    // 3. Add PostToolUse hook for auto-reindex after git commit
    await this.configurePostToolHook(claudeDir, targetDir);

    // 4. Create/update CLAUDE.md with graph instructions
    await this.updateClaudeMd(targetDir);

    console.log('GraphHub installed for Claude Code!');
    console.log(`  - MCP server configured in ${path.join(claudeDir, 'settings.json')}`);
    console.log(`  - PreToolUse hook installed for automatic graph context`);
    console.log(`  - PostToolUse hook installed for auto-reindex after git commit`);
    console.log(`  - CLAUDE.md updated with usage instructions`);
  }

  public async uninstall(projectDir?: string): Promise<void> {
    const targetDir = projectDir || process.cwd();
    const settingsPath = path.join(targetDir, '.claude', 'settings.json');

    if (fs.existsSync(settingsPath)) {
      const settings: ClaudeSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

      // Remove graphhub MCP server
      if (settings.mcpServers?.graphhub) {
        delete settings.mcpServers.graphhub;
      }

      // Remove graphhub hooks
      if (settings.hooks?.PreToolUse) {
        settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
          h => !h.hooks.some(hook => hook.command.includes('graphhub'))
        );
      }
      if (settings.hooks?.PostToolUse) {
        settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
          h => !h.hooks.some(hook => hook.command.includes('graphhub'))
        );
      }

      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

      // Remove hook scripts
      const preHookPath = path.join(targetDir, '.claude', 'graphhub-hook.sh');
      const postHookPath = path.join(targetDir, '.claude', 'graphhub-post-hook.sh');
      if (fs.existsSync(preHookPath)) fs.unlinkSync(preHookPath);
      if (fs.existsSync(postHookPath)) fs.unlinkSync(postHookPath);

      console.log('GraphHub uninstalled from Claude Code settings.');
    }
  }

  private async configureMcpServer(claudeDir: string): Promise<void> {
    const settingsPath = path.join(claudeDir, 'settings.json');
    let settings: ClaudeSettings = {};

    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }

    settings.mcpServers = settings.mcpServers || {};
    settings.mcpServers.graphhub = {
      command: 'npx',
      args: ['tsx', path.join(this.graphhubDir, 'src', 'index.ts'), 'serve'],
      cwd: this.graphhubDir,
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  private async configurePreToolHook(claudeDir: string): Promise<void> {
    const settingsPath = path.join(claudeDir, 'settings.json');
    let settings: ClaudeSettings = {};

    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }

    settings.hooks = settings.hooks || {};
    settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];

    // Check if hook already exists
    const hookExists = settings.hooks.PreToolUse.some(
      h => h.hooks.some(hook => hook.command.includes('graphhub-hook'))
    );

    if (!hookExists) {
      // Create the hook script
      const hookScriptPath = path.join(claudeDir, 'graphhub-hook.sh');
      const hookScript = `#!/bin/bash
# GraphHub PreToolUse Hook
# Reminds Claude about the knowledge graph before file operations

GRAPHHUB_REPORT=".graphhub/GRAPH_REPORT.md"

if [ -f "$GRAPHHUB_REPORT" ]; then
  echo "---"
  echo "📊 GraphHub: Knowledge graph available. Before searching files:"
  echo "  1. Use semantic_search for natural language queries"
  echo "  2. Use get_context to see callers/callees of a symbol"
  echo "  3. Use impact_analysis before editing high-traffic symbols"
  echo "  4. Use remember to save learnings for future sessions"
  echo "  5. Check GRAPH_REPORT.md for god nodes and clusters"
  echo "---"
fi
`;
      fs.writeFileSync(hookScriptPath, hookScript, { mode: 0o755 });

      settings.hooks.PreToolUse.push({
        matcher: 'Glob|Grep|Read',
        hooks: [
          {
            type: 'command',
            command: `bash "${hookScriptPath}"`,
          },
        ],
      });
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  private async configurePostToolHook(claudeDir: string, targetDir: string): Promise<void> {
    const settingsPath = path.join(claudeDir, 'settings.json');
    let settings: ClaudeSettings = {};

    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }

    settings.hooks = settings.hooks || {};
    settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];

    // Check if hook already exists
    const hookExists = settings.hooks.PostToolUse.some(
      h => h.hooks.some(hook => hook.command.includes('graphhub-post-hook'))
    );

    if (!hookExists) {
      // Create the post-commit hook script
      const hookScriptPath = path.join(claudeDir, 'graphhub-post-hook.sh');
      const graphhubDirUnix = this.graphhubDir.replace(/\\/g, '/');
      const targetDirUnix = targetDir.replace(/\\/g, '/');

      const hookScript = `#!/bin/bash
# GraphHub PostToolUse Hook
# Auto-reindexes the knowledge graph after git commit/merge/rebase

GRAPHHUB_DIR="${graphhubDirUnix}"
TARGET_DIR="${targetDirUnix}"
GRAPHHUB_DIR_CHECK=".graphhub"
LAST_INDEX_FILE=".graphhub/.last_index_commit"

# Only run if .graphhub exists (project is indexed)
if [ ! -d "$GRAPHHUB_DIR_CHECK" ]; then
  exit 0
fi

# Get current HEAD commit
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null)
if [ -z "$CURRENT_COMMIT" ]; then
  exit 0
fi

# Check if we already indexed this commit
if [ -f "$LAST_INDEX_FILE" ]; then
  LAST_INDEXED=$(cat "$LAST_INDEX_FILE")
  if [ "$CURRENT_COMMIT" = "$LAST_INDEXED" ]; then
    exit 0
  fi
fi

# New commit detected - reindex
echo "---"
echo "GraphHub: New commit detected, auto-reindexing..."

# Run reindex in background to not block Claude
(
  cd "$GRAPHHUB_DIR" && \\
  npx tsx src/index.ts index "$TARGET_DIR" > /dev/null 2>&1 && \\
  npx tsx src/index.ts report > /dev/null 2>&1 && \\
  echo "$CURRENT_COMMIT" > "$TARGET_DIR/$LAST_INDEX_FILE"
) &

echo "   Reindex started in background."
echo "---"
`;
      fs.writeFileSync(hookScriptPath, hookScript, { mode: 0o755 });

      settings.hooks.PostToolUse.push({
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: `bash "${hookScriptPath}"`,
          },
        ],
      });
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  private async updateClaudeMd(targetDir: string): Promise<void> {
    const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
    let content = '';

    if (fs.existsSync(claudeMdPath)) {
      content = fs.readFileSync(claudeMdPath, 'utf-8');
    }

    // Check if GraphHub section already exists
    if (content.includes('## GraphHub')) {
      console.log('CLAUDE.md already has GraphHub section, skipping.');
      return;
    }

    const graphhubSection = `
## GraphHub — Codebase Memory

This project has a GraphHub knowledge graph. Use it to understand code faster and maintain session memory.

### Quick Reference

| Task | MCP Tool | Example |
|------|----------|---------|
| Find code by description | \`semantic_search\` | "authentication logic" |
| See callers/callees | \`get_context\` | symbol name |
| Check blast radius | \`impact_analysis\` | before editing |
| Run Cypher query | \`query_graph\` | custom queries |
| Save a learning | \`remember\` | persist across sessions |
| Recall past learnings | \`recall\` | query session memory |

### Before Editing

Always run \`impact_analysis\` before modifying a symbol. Check \`.graphhub/GRAPH_REPORT.md\` for god nodes (high-traffic symbols).

### Session Memory

Use \`remember\` to save learnings, decisions, or context. They persist across sessions and are searchable via \`recall\`.

\`\`\`
remember({content: "The auth flow validates JWT tokens in middleware", type: "learning"})
recall({query: "how does auth work?"})
\`\`\`

### Re-index After Changes

\`\`\`bash
npm run index -- ./src
npm run report
\`\`\`
`;

    content = graphhubSection + '\n' + content;
    fs.writeFileSync(claudeMdPath, content);
  }
}
