# Stackit project flow and roadmap

This is the canonical cross-project description of Stackit's current product
flow and intended future development. Update it whenever implementation,
product decisions, or roadmap scope changes.

## Product overview

Stackit is a Trello-style project management application. People sign in,
organize work in workspaces, create boards, divide boards into lists, and track
work as cards. Teams can invite workspace members and collaborate as the
product's collaboration features are delivered.

## Current end-to-end user flow

1. **Create an account or sign in.** The backend creates or authenticates the
   account and returns a JWT. The frontend stores it and protects workspace
   routes.
2. **Open a workspace.** The sidebar loads the signed-in user's organizations.
   The user selects a workspace or creates/updates one.
3. **Manage boards.** The user views boards grouped by workspace, creates a
   board, or renames/deletes it from the board list. The sidebar keeps the
   selected workspace's boards accessible during navigation.
4. **Plan work on a board.** A board contains sections/lists; sections contain
   issues/cards. The user can create sections and create, edit, and delete
   cards. Board and card operations call the backend API.
5. **Move work.** A card can be dragged between sections. The UI moves it
   optimistically and restores its original location if the API request
   fails. The backend persists the destination section, but not ordering
   within a section.
6. **Manage workspace people.** Workspace admins open Members to view members
   and invitations, invite an email address, or remove a member. Invitees
   signed in with the matching email can accept or decline invitations.
7. **Handle email delivery failure.** The backend stores the invitation before
   sending its email. A failed send is persisted as `FAILED`; the inviting
   client reports the error and asks the authenticated WebSocket service to
   notify connected workspace admins. The People dialog refreshes persisted
   invitation data when it receives the event.

Workspace membership applies to all boards in that workspace. The current data
model does not support board-only memberships. Admin/member roles exist and
the backend protects current membership operations; detailed roles and
permissions remain a planned phase.

## System request flow

```text
Browser (React/Bun, :5173)
  ├── HTTPS/HTTP + raw JWT Authorization header ──> Express API (:3000)
  │                                                  └── Prisma Client
  │                                                       └── PostgreSQL
  └── WebSocket + JWT query token ────────────────> WebSocket service (:8080)
                                                     └── Prisma Client
                                                          └── PostgreSQL
```

The frontend centralizes API calls in `apps/frontend/src/api.ts`. The backend
is the authority for validation, database changes, and access control.
WebSocket notifications are authenticated and re-check relevant membership
and invitation records before broadcasting. Both server processes share
database models from `packages/db`.

## Implemented product areas

- Authentication with signup, signin, persisted JWT state, and protected app
  routes.
- Workspace creation, listing, update, and deletion.
- Board listing, creation, rename, and deletion.
- Board section/list creation.
- Card/issue create, edit, delete, and moves between sections.
- Optimistic card movement with rollback after a failed request.
- Local state updates for card and section changes to avoid unnecessary full
  board reloads.
- Responsive workspace sidebar with board navigation, create-board controls,
  and collapse/expand behavior.
- Workspace member and invitation management, including invite, accept,
  decline, and member removal.
- Persisted invite email failure status and live WebSocket notices for
  connected workspace admins.
- Backend comment CRUD endpoints exist; full user-facing comments/activity
  collaboration is still planned.

See [frontend learning notes](./FRONTEND_LEARNING.md) for the detailed
frontend phase history and implementation concepts.

## Development roadmap

Phases 1–9 are implemented. Continue with the following phases, adjusting
scope as real product decisions are made:

### Phase 10 — Roles and permissions

- Define an intentional role/permission matrix for workspace and board actions.
- Align backend authorization with the matrix and make frontend affordances
  reflect the same rules.
- Decide whether board-specific membership is required and design the data
  model/migration before implementing it.
- Cover authorization boundaries with tests.

### Phase 11 — Project collaboration tools

- Integrate comments into card details and provide authorship and useful
  context.
- Add activity history for meaningful workspace/board/card events.
- Add task workflow fields such as due dates, labels, and other agreed
  prioritization metadata.
- Decide filtering, search, and notification behavior for these features.

### Phase 12 — Real-time collaboration

- Wire board clients to the existing WebSocket board rooms.
- Synchronize board/card/list mutations for users viewing the same board.
- Provide live presence and clear reconnect/error behavior.
- Persist card ordering within sections and synchronize it consistently.
- Validate socket permissions for every event; clients cannot authorize
  themselves by message contents.

### Phase 13 — Quality and polish

- Add focused backend, frontend, WebSocket, and data-layer automated tests.
- Improve accessibility, keyboard use, responsive layouts, and interaction
  feedback.
- Standardize loading, empty, retry, and error states.
- Add regression coverage for workspace permissions, invite delivery failures,
  optimistic updates, and real-time behavior.

### Phase 14 — Production readiness

- Define production environment configuration and secret handling.
- Add deployment/build and reviewed database migration workflows.
- Add operational logging, monitoring, health checks, backup/recovery, and
  service lifecycle guidance.
- Perform production security, performance, browser, and reliability checks.

## Known limitations and decisions to revisit

- Membership is workspace-wide; there is no board-only membership.
- Workspace roles currently are `admin` and `member`; role design is not yet
  complete.
- Card moves persist a destination section, not within-section ordering.
- WebSocket board-room events exist on the server, but the browser is not
  fully wired for board real-time updates. The People dialog does use sockets
  for failed invitation email notices.
- Backend comment endpoints exist, but the complete comments/activity user
  workflow has not been delivered.
- The repository currently has no dedicated automated test suite or CI
  workflow documented here; confirm current tooling before adding one.

## Documentation maintenance

Whenever product behavior, project scope, or architecture changes:

1. Update this flow for every implementation or workflow change, including
   fixes, so it remains a complete description of what is built and planned.
2. Update [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) after every implementation
   change so another agent can continue from the current state.
3. Update the README for every affected package whenever its code, structure,
   setup, scripts, or architecture changes.
4. Keep the root [README.md](./README.md) as the navigation and quick-start
   index, not as a second competing roadmap; update it when shared setup or
   entry points change.
