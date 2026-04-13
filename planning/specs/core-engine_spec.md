# Spec: Core Ingestion Engine

## Goal
To parse a codebase and generate a structured knowledge graph in KuzuDB.

## Functional Requirements

### 1. Repository Crawling
- Recursively find all source files in a given directory.
- Respect `.gitignore` and default exclusions (e.g., `node_modules`, `.git`).

### 2. Language Parsing
- Initialize Tree-sitter with language-specific grammars (TS, JS, Python, Go, Rust).
- Generate AST for each file.

### 3. Symbol Extraction
- Extract "Node" entities:
  - **Files**: Path, name, size.
  - **Functions**: Name, parameters, return type, range in file.
  - **Classes/Interfaces**: Name, methods, fields.
  - **Variables**: Name, type (if available).

### 4. Relationship (Edge) Resolution
- **Imports**: File A imports File B / Symbol B.
- **Calls**: Function A calls Function B.
- **Inheritance**: Class A extends Class B.
- **Usage**: Variable A used in Function B.

### 5. Graph Persistence
- Store nodes and edges in KuzuDB.
- Maintain a version/hash per file to enable incremental indexing.

## Non-Functional Requirements
- **Performance**: Indexing a 100-file project should take < 5 seconds.
- **Memory**: Keep memory footprint under 500MB for medium projects.
- **Robustness**: Gracefully handle syntax errors in source files.

## Technical Details

### KuzuDB Schema (Draft)
```cypher
// Nodes
CREATE NODE TABLE File(path STRING, PRIMARY KEY (path));
CREATE NODE TABLE Symbol(name STRING, type STRING, range STRING, PRIMARY KEY (name, path));

// Edges
CREATE REL TABLE IMPORTS(FROM File TO File);
CREATE REL TABLE CALLS(FROM Symbol TO Symbol);
CREATE REL TABLE DEFINED_IN(FROM Symbol TO File);
```
