# ADR: Tech Stack Selection for GraphHub

**Date**: 2026-04-13
**Status**: Proposed

## Context
The user wants to building GraphHub as a clone of GitNexus.
GitNexus is a code intelligence engine that parses codebases into interactive knowledge graphs.
It is privacy-focused, local-first, and integrates with AI agents via the Model Context Protocol (MCP).

## Decision
We will adopt the following technology stack to match GitNexus's architecture and capabilities:

### 1. Ingestion & Parsing
- **Engine**: [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- **Rationale**: Industry standard for language-agnostic parsing. Supports WASM (for browser) and native (for CLI). Essential for extracting ASTs.

### 2. Graph Storage
- **Database**: [KuzuDB](https://kuzu.io/)
- **Rationale**: An embedded graph database designed for performance. Supports local filesystem storage (CLI) and IndexedDB via WASM (Web). GitNexus explicitly uses this to store relationships.

### 3. Integration Layer
- **Protocol**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- **Rationale**: To provide architectural awareness to AI agents (Cursor, Claude Code, etc.), matching GitNexus's primary value proposition.

### 4. Search & RAG
- **Search**: Hybrid (BM25 + Semantic)
- **Embeddings**: [transformers.js](https://huggingface.co/docs/transformers.js/)
- **Rationale**: Enables both keyword and semantic retrieval without external servers.

### 5. Frontend & Visualization
- **Framework**: React + TypeScript
- **Visualization**: [D3.js](https://d3js.org/) or [React Flow](https://reactflow.dev/)
- **Rationale**: High flexibility for interactive graph rendering. React Flow is excellent for node-based UIs, while D3 provides deeper control over force-directed layouts.

## Alternatives Considered
- **Neo4j**: Rejected because it requires a server; not suitable for local-first/local-only requirements.
- **SQLite (as graph)**: Possible, but KuzuDB provides native graph query (Cypher) and optimization for graph traversals.

## Consequences
- Requires management of WASM binaries for Tree-sitter and KuzuDB in the browser.
- High memory usage for local indexing of large repositories.
- Strong TypeScript typing required for the graph schema.
