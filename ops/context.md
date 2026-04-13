# Operations Context: GraphHub Ops

## Current Directory
This directory handles the lifecycle of GraphHub after source code is merged: including deployment pipelines, infrastructure-as-code (IaC), and runtime monitoring.

## Infrastructure Strategy (Assumed)
- **Deployment**: Likely Vercel / Netlify for the frontend; Docker-based for backend services.
- **CI/CD**: GitHub Actions for automated testing and deployment.
- **Monitoring**: Sentry for error tracking; Grafana/Prometheus for performance metrics.

## What Good Looks Like
- **Automated Deployments**: Every merge to `main` triggers a production deployment or staging preview.
- **Observable Systems**: All key flows (graph rendering time, API latency) are tracked.
- **Safe Recoveries**: Validated rollback procedures are documented in `scripts/`.
- **Infrastructure as Code**: Any cloud resources are defined via code rather than manual UI setup.

## What to Avoid
- **Manual Hotfixes**: Never modify production state manually; use the CI/CD pipeline.
- **Silent Failures**: Ensure every directory in `monitoring/` has clear alerts for critical failures.
- **Hardcoded Secrets**: Use environmental variables or a secret manager.

## Operational Areas
- `/deploy` — CI/CD configurations and deployment scripts.
- `/monitoring` — Alert definitions and dashboard configurations.
- `/scripts` — Operational maintenance scripts (backups, migrations).
