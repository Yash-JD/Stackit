# Stackit

Stackit is a Trello-style project management application organized as a Bun
workspace monorepo. The web client, HTTP API, WebSocket service, and Prisma
database package live in separate workspaces.

## Documentation

- [Project flow and product roadmap](./PROJECT_FLOW.md): current user workflows
  and planned development phases.
- [Agent handoff](./AGENT_HANDOFF.md): current project state, architecture,
  development conventions, and continuation instructions for coding agents.
- [Frontend learning notes](./FRONTEND_LEARNING.md): phased frontend
  implementation notes and concepts.
- [Backend guide](./apps/backend/README.md)
- [Frontend guide](./apps/frontend/README.md)
- [WebSocket guide](./apps/websocket/README.md)
- [Database guide](./packages/db/README.md)

Keep the flow and handoff documents, and any affected package guide, updated
alongside implementation changes. They are the canonical project context for
future contributors and coding agents.

## Requirements

- Bun 1.3.14 (the repository's configured package-manager version)
- A PostgreSQL database

Install dependencies from the repository root:

```bash
bun install
```

Configure local environment files before starting services. Do not commit
environment files or put secret values in documentation:

- `packages/db/.env`: `DATABASE_URL` for Prisma CLI operations.
- `apps/backend/.env`: `DATABASE_URL`, `JWT_SECRET`, and `RESEND_API_KEY`.
  The WebSocket dev script loads this file too; `WS_PORT` is optional and
  defaults to `8080`.
- The frontend can use `BUN_PUBLIC_API_URL` and `BUN_PUBLIC_WS_URL`; defaults
  are `http://localhost:3000` and `ws://localhost:8080`. Its dev server uses
  port `5173` by default (`PORT` can override it).

Use the same database connection for the runtime services and Prisma CLI.

## Run locally

Run the following in separate terminals from the indicated package directories.
Apply database migrations before starting the services.

1. Prepare/generate the database client and apply development migrations:

   ```bash
   cd apps/backend
   bun run prisma-all
   ```

   This forwards to the database package's `prisma-all` script, which formats
   the schema, generates Prisma Client, and runs `prisma migrate dev`. The
   migration step modifies the configured database.

2. Start the API:

   ```bash
   cd apps/backend
   bun run start:dev
   ```

3. Start the WebSocket service:

   ```bash
   cd apps/websocket
   bun run start:dev
   ```

4. Start the frontend:

   ```bash
   cd apps/frontend
   bun run dev
   ```

The local services use frontend `http://localhost:5173`, API
`http://localhost:3000`, and WebSocket `ws://localhost:8080` by default.
The API health checks are `/health` and `/health/db`; interactive API
documentation is at `/api-docs`.

## Common checks

Run from the repository root:

```bash
bunx tsc --noEmit -p apps/frontend/tsconfig.json
bunx tsc --noEmit -p apps/backend/tsconfig.json
bunx tsc --noEmit -p apps/websocket/tsconfig.json
bun run --cwd apps/frontend build
```

The workspace does not currently define a dedicated automated test suite.
See each package guide for its responsibilities, file layout, and package
specific commands.
