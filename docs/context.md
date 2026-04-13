# Documentation Context: GraphHub Docs

## Current Directory
This directory serves as the centralized repository for all project documentation, including external API references, user guides, and the project's evolution history.

## What Good Looks Like
- **User-Centric**: Guides focus on specific user outcomes and "how-to" scenarios.
- **Accurate API Docs**: Automatically generated or manually verified endpoint/library references in `api/`.
- **Chronological Accountability**: The `changelog/` maps version updates to specific features and fixes.
- **Markdown Excellence**: Clear use of headers, lists, and code blocks for readability.

## What to Avoid
- **Stale Docs**: Features described in docs should match the current implementation in `src/`.
- **Repetitive Content**: Link to existing specs in `/planning` rather than duplicating technical details.
- **Undocumented Changes**: Every significant PR should update relevant docs.

## Documentation Areas
- `/api` — Detailed documentation for internal and external interfaces.
- `/guides` — Onboarding docs, "Getting Started," and feature walkthroughs.
- `/changelog` — Version history and release notes.
