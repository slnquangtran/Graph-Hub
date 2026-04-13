# Development Context: GraphHub Source

## Current Directory
This directory contains the core application logic, visualization components, and data management services for GraphHub.

## Tech Stack
- **Parser**: `web-tree-sitter` (WASM-based for cross-platform compatibility).
- **Database**: `kuzu` (Embedded graph database).
- **Integration**: `@modelcontextprotocol/sdk` (MCP server support).
- **Language Grammars**: `tree-sitter-typescript`, `tree-sitter-javascript`.
- **Runtime**: Node.js with `tsx` for TypeScript execution.
- **Testing**: Vitest for unit tests.

## What Good Looks Like
- **Component Modularity**: Components are small, reusable, and reside in `components/`.
- **Typed Data Flow**: Full TypeScript coverage for graph nodes, edges, and metadata.
- **Service Isolation**: External API calls and heavy data processing are isolated in `services/`.
- **Testing-First**: Every new feature includes a `.test.ts` file as per `AGENTS.md`.

## What to Avoid
- **Prop Drilling**: Avoid deep nesting; use stores or context for global state.
- **Any Types**: Strict TypeScript; no usage of `any`.
- **Business Logic in UI**: Keep components focused on rendering; move logic to services or utils.

## Directory Mapping
- `/components` — Visual elements and UI building blocks.
- `/services` — Data fetching, graph algorithms, and external integrations.
- `/utils` — Pure helper functions and constants.
- `/tests` — Test suites following the `feature-name.test.ts` convention.
