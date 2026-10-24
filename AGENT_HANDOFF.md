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
- **Current product milestone:** Phases 1–12 are implemented in code and
  validated; Phase 13 quality and polish is in progress. Phase 10, 11, and 12
  migrations are not yet applied to a database.
- **Canonical docs:** [project flow and roadmap](./PROJECT_FLOW.md),
  [root setup](./README.md), and the four package guides linked below.

## Current implementation

### Shipped

- Signup/signin and protected frontend routes.
- Workspace CRUD and workspace-scoped boards.
- Board CRUD and board list navigation.
- Section/list creation and card/issue CRUD.
- Drag-and-drop issue moves between sections with optimistic state and
  rollback on API failure; cards can also be reordered within a section.
- Issue section and ordering positions are persisted by the API and returned
  in deterministic order.
- Board WebSocket clients authenticate with the current JWT, join authorized
  board rooms, and receive active collaborator presence.
- Connected clients synchronize card, comment, list, and board rename/delete
  changes by refreshing server state. Socket sends are notifications only;
  REST authorization and persisted state remain authoritative.
- Board connection status includes bounded automatic reconnect and a manual
  retry action. API changes remain persisted while realtime is unavailable.
- Card ordering rules and the shared workspace-role/board-grant access policy
  have database-independent Bun unit tests.
- Keyboard users can move cards between lists and reorder cards when search
  and label filters are inactive. Board load errors offer retry, and empty
  lists explain their state.
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
- Workspace role hierarchy: one protected `superadmin`, plus `admin` and
  board-scoped `member` access.
- Admin People UI for inviting members with selected boards, updating regular
  member roles and board grants, and removing non-superadmin members.
- Backend authorization filters board/list reads and protects board/list
  management, card/comment operations, membership changes, and invite flows.
- Cards persist a single `Design`/`Build`/`Research` label and optional
  date-only due date. Search matches card titles and descriptions.
- Card detail loads comments and activity history. Authors may edit or
  soft-delete their comments. Activity records card creation, card metadata
  updates, moves, and comment create/edit/delete actions.

### Remaining considerations

- Phase 10 migrations add board grants and `superadmin`; Phase 11 adds card
  metadata and issue activity; Phase 12 adds issue ordering. All migrations
  are present but not applied. The Prisma schema and generated client have
  been validated. The legacy migration promotes the oldest active admin
  membership as superadmin because prior schema did not record workspace
  creators; existing members are intentionally not granted boards.
- Realtime notifications are best-effort. The API and database remain the
  source of truth, and users can manually retry the WebSocket connection.
- Phase 13 is incomplete: the test suite covers issue-ordering rules, but
  permission, invite failure, frontend, WebSocket, and database integration
  regressions still need coverage.

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

- Workspaces/organizations own boards. Superadmins and admins access every
  board; members require an active board grant as well as workspace
  membership.
- The workspace creator is assigned `superadmin` at creation. There is one
  active superadmin per workspace, and API and UI prohibit removing or
  demoting that account, including by itself.
- Members may create, edit, delete, and move cards and comment on assigned
  boards. Board and list creation/management remain admin/superadmin-only.
- Existing regular members receive no board grants during migration; an admin
  must explicitly assign their boards after the migration.
- Labels are a fixed single-select set (`Design`, `Build`, `Research`), and
  due dates are date-only values. No custom labels, card assignments, or new
  notification delivery was added in Phase 11.
- Issue activity is transactionally recorded for issue creation, metadata
  edits, list moves, and comment create/edit/delete. The activity API checks
  current board access. Comment deletion is soft deletion, and comment edits
  or deletes are author-only.
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
   request. Phase 12 real-time collaboration is implemented; Phase 13 quality
   and polish is in progress. Review pending migrations before applying them
   to a target database.
4. Trace a continuous feature across UI, API, authorization, WebSocket, and
   data model as applicable; preserve established patterns.
5. Validate with the narrowest relevant type-check/build/tests and report
   what was and was not exercised. Phases 10 and 11 were validated with Prisma
   schema validation/client generation, affected API/frontend type-checks,
   frontend build, and diff checks. Phase 13 adds Bun tests for issue ordering;
   no DB migration or live user-data change was run.
6. Update this handoff and the project flow before finishing, and update
   package guides affected by the change.
