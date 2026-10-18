# Stackit coding-agent handoff

This is the living handoff for continuing Stackit with another coding agent.
Keep it current when implementation state, product decisions, architecture,
development commands, or the next phase changes. Do not copy credentials or
secret environment values into this file.

## Project at a glance

- **Product:** Stackit, a Trello-style project management application.
- **Repository:** `Yash-JD/Stackit`.
- **Layout:** Bun/Turborepo monorepo with React frontend, Express API,
  WebSocket service, and shared Prisma/PostgreSQL package.
- **Package manager:** Bun 1.3.14.
- **Current product milestone:** Phases 1–9 implemented; Phase 10 is next.
- **Canonical docs:** [project flow and roadmap](./PROJECT_FLOW.md),
  [root setup](./README.md), and the four package guides linked below.

## Current implementation

### Shipped

- Signup/signin and protected frontend routes.
- Workspace CRUD and workspace-scoped boards.
- Board CRUD and board list navigation.
- Section/list creation and card/issue CRUD.
- Drag-and-drop issue moves between sections with optimistic state and
  rollback on API failure.
- Local card/list state updates avoid refetching the whole board after simple
  mutations.
- Sidebar workspace selection, navigation, collapse/expand, and Stackit
  branding.
- Workspace People dialog: member list, email invitation, incoming
  invitations, accept/decline, and member removal.
- Invitation email send errors propagate to the route and are recorded with
  invitation status `FAILED`; admins can see the status.
- Authenticated WebSocket notification flow for connected workspace admins
  when invitation delivery fails.

### Existing foundations not fully productized

- Backend comment CRUD exists; a complete comments/activity workflow is
  planned.
- WebSocket server supports board room presence and event relay, but the
  frontend is not fully integrated with board-level real-time updates.
- Backend has `admin` and `member` roles and some admin-only routes. The
  complete permission matrix and possible board-level membership are Phase 10
  work, not assumptions to silently bake into the current model.
- Card destination-section moves persist; order within a section does not.

## Architecture and package guides

```text
apps/frontend  React SPA, Bun dev/build, API client, workspace/board UI
apps/backend   Express REST API, authentication, business rules, emails
apps/websocket Authenticated socket rooms, presence/event relay, invite notices
packages/db    Prisma schema, migration history, shared generated client
```

Request/data flow and roadmap details are in [PROJECT_FLOW.md](./PROJECT_FLOW.md).
Read the package guide before changing a package:

- [Backend setup, routes, and architecture](./apps/backend/README.md)
- [Frontend setup, hooks, and UI architecture](./apps/frontend/README.md)
- [WebSocket setup and event protocol](./apps/websocket/README.md)
- [Database setup, models, and migration workflow](./packages/db/README.md)

## Local development

Install dependencies from the repository root:

```bash
bun install
```

Configure ignored local environment files; never put their values in source
control or docs:

- `packages/db/.env`: `DATABASE_URL` for Prisma CLI.
- `apps/backend/.env`: runtime `DATABASE_URL`, `JWT_SECRET`, and
  `RESEND_API_KEY`; optional `WS_PORT` (defaults to `8080`). The WebSocket
  dev script loads this file too.
- Frontend optional `BUN_PUBLIC_API_URL`, `BUN_PUBLIC_WS_URL`, and `PORT`;
  defaults are API `http://localhost:3000`, WebSocket
  `ws://localhost:8080`, and frontend port `5173`.

Use the same database for Prisma CLI and backend/socket runtime.

Start each service in a separate terminal, after applying intended migrations:

```bash
cd apps/backend
bun run prisma-all
```

```bash
cd apps/backend
bun run start:dev
```

```bash
cd apps/websocket
bun run start:dev
```

```bash
cd apps/frontend
bun run dev
```

`prisma-all` formats the schema, generates Prisma Client, and runs
`prisma migrate dev`; it modifies the configured database. Do not run it
without understanding the target database and migration effects.

Service ports: frontend `5173`, API `3000`, WebSocket `8080`. API health
endpoints are `/health` and `/health/db`; Swagger docs are `/api-docs`.

Type-check and build commands from the repository root:

```bash
bunx tsc --noEmit -p apps/frontend/tsconfig.json
bunx tsc --noEmit -p apps/backend/tsconfig.json
bunx tsc --noEmit -p apps/websocket/tsconfig.json
bun run --cwd apps/frontend build
```

There is currently no dedicated automated test suite declared in the
workspace package scripts. Check for new tests before deciding validation
scope.

## Product and workflow decisions

- Workspaces/organizations own boards. A membership in a workspace grants
  access across its boards.
- Board-only membership is not currently supported. If adding it, agree the
  scope and design the model and authorization before implementation.
- Invitations are sent to an email address and can be accepted/declined by
  the account with that matching email.
- Invitation delivery failure is a persisted status and should be treated
  distinctly from a pending invitation. Live notices are best-effort; the API
  remains the source of truth and the UI must be able to refresh.
- Preserve local-first responsiveness where already implemented: do not
  re-fetch every card/list for straightforward card and section mutations.
- Card moves should retain optimistic updates and rollback/error visibility.

## Explicit user preferences and operating notes

- Development is organized into numbered phases. Before moving into the next
  phase, follow the latest user direction and keep the roadmap aligned.
- The product flow and this handoff are living documents: update both after
  every implementation or workflow change, including fixes. Update each
  affected package guide whenever its package code, structure, setup, scripts,
  or architecture changes.
- When asked to start/share the UI, run the frontend and use the shared
  browser if available. When asked to stop the UI or all processes, stop the
  relevant Stackit frontend/API/WebSocket processes and verify their ports.
- Do not send real invitations, remove members, or otherwise mutate user
  data during UI validation unless the user explicitly authorizes it.
- If asked to stage changes but not commit, stage only the requested scope and
  leave the changes uncommitted. Do not commit unless explicitly requested.
- Previous requested UI behavior includes: create board from the board list
  and sidebar, rename/delete from board tiles, collapsible sidebar, avoid
  refetching existing cards/lists after create, and preserve the Stackit
  layered logo. Keep these behaviors unless the user changes direction.

## How to continue

1. Read this file, [PROJECT_FLOW.md](./PROJECT_FLOW.md), and the relevant
   package README(s).
2. Inspect `git status` and existing diffs before editing; preserve unrelated
   staged and unstaged work.
3. Confirm which roadmap phase or bug is in scope from the latest user
   request. Do not infer that all planned features are authorized by a broad
   roadmap.
4. Trace a continuous feature across UI, API, authorization, WebSocket, and
   data model as applicable; preserve established patterns.
5. Validate with the narrowest relevant type-check/build/tests and report
   what was and was not exercised. Database migrations and live user-data
   changes require special care.
6. Update this handoff and the project flow before finishing, and update
   package guides affected by the change.
