# Planning Context: GraphHub

## Current Project
GraphHub is a platform designed to manage and visualize complex graph-based data. The goal is to provide a seamless interface for creating, exploring, and sharing relational datasets with a focus on performance and visual clarity.

## What Good Looks Like
- **Modular Specification**: Features are defined in `specs/` before implementation.
- **Traceable Decisions**: Significant architectural choices are documented in `decisions/` using the ADR format.
- **Architectural Integrity**: The visual and logical layers of the graph system are clearly separated as per the `architecture/` docs.
- **Iterative Growth**: Small, verifiable chunks of work that move the project toward a scalable graph ecosystem.

## What to Avoid
- **Implicit Knowledge**: Avoid starting development on complex features without a corresponding spec file.
- **Monolithic Bloat**: Don't combine data processing logic with visualization components.
- **Stale Context**: Ensure this document and related planning docs are updated when the project pivot occurs.

## Key Planning Areas
- `/specs` — Functional requirements for graph manipulation, user auth, and sharing.
- `/architecture` — System design, including the graph engine and rendering stack.
- `/decisions` — Records of major technical trade-offs.
