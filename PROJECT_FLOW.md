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
2. **Open a workspace.** The sidebar loads the signed-in user's workspaces and
   membership roles. The workspace creator is its sole `superadmin`; admins
   and superadmins can manage workspace settings and boards.
3. **Manage boards.** Admins and superadmins create, rename, and delete boards.
   Members only see boards explicitly assigned to them. The sidebar keeps
   boards the signed-in user can access available during navigation.
4. **Plan work on a board.** A board contains sections/lists; sections contain
   issues/cards. Admins and superadmins manage boards and lists. Members can
   create, edit, delete, and move cards on boards assigned to them. Cards have
   a `Design`, `Build`, or `Research` label and an optional date-only due date.
5. **Move and order work.** A card can be dragged between sections or
   reordered within a section. The UI updates optimistically and restores the
   original order if the API request fails. The API persists each card's
   section and position; connected board clients refresh from that
   authoritative state after a move.
6. **Manage workspace people.** Workspace admins invite an email address and
   choose its board access, update regular members' roles and board grants, or
   remove a member. The single superadmin is shown as protected and cannot be
   removed or demoted, including by themself. Members can review invitations
   addressed to them. Invitees signed in with the matching email can accept or
   decline; accepting activates the selected board grants.
7. **Handle email delivery failure.** The backend stores the invitation before
   sending its email. A failed send is persisted as `FAILED`; the inviting
   client reports the error and asks the authenticated WebSocket service to
   notify connected workspace admins. The People dialog refreshes persisted
   invitation data when it receives the event.

Admins and the superadmin have access to all boards in their workspace.
Members must have an active workspace membership and an explicit grant for a
board. Existing members receive no board grants during migration and remain
without board access until an admin assigns it.

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
WebSocket notifications are authenticated and re-check relevant membership,
board grants, and associated records before broadcasting. Board clients show
live presence and reconnect status; realtime messages prompt recipients to
reload authoritative API state rather than applying untrusted mutation
payloads. Both server processes share database models from `packages/db`.

## Implemented product areas

- Authentication with signup, signin, persisted JWT state, and protected app
  routes.
- Workspace creation, listing, update, and deletion.
- Board listing, creation, rename, and deletion.
- Board section/list creation.
- Card/issue create, edit, delete, and moves between sections.
- Persisted card ordering within each section, including optimistic
  drag-and-drop reordering and rollback after a failed request.
- Board-level live presence, reconnect/retry status, and same-board
  synchronization for card, comment, list, and board rename/delete changes.
- Local state updates for card and section changes to avoid unnecessary full
  board reloads.
- Responsive workspace sidebar with board navigation, create-board controls,
  and collapse/expand behavior.
- Workspace member and invitation management, including invite, accept,
  decline, and member removal.
- Persisted invite email failure status and live WebSocket notices for
  connected workspace admins.
- Workspace `superadmin`/`admin`/`member` authorization with board-scoped
  member access, role/grant management, and superadmin removal/demotion
  protection.
- Card detail collaboration: comments can be listed, added, edited, or
  soft-deleted by their author; the card's activity timeline records card
  creation, metadata edits, moves, and comment changes.
- Card label and due-date metadata are persisted. Board search covers card
  titles and descriptions and the existing label filter uses saved labels.

See [frontend learning notes](./FRONTEND_LEARNING.md) for the detailed
frontend phase history and implementation concepts.

## Development roadmap

Phases 1–12 are implemented in code. The Phase 10, Phase 11, and Phase 12
database migrations are present and the project owner reports they have been
handled. Verify migration status against the intended database before future
migration operations; do not assume they need to be reapplied.
Continue with the following phases, adjusting scope as real product decisions
are made:

### Phase 12 — Real-time collaboration

- Complete: authenticated board-room clients, live presence, bounded
  reconnects, visible connection state, and manual retry.
- Complete: same-board clients synchronize card, comment, list, and board
  rename/delete changes by refreshing API state.
- Complete: persist and synchronize card ordering within sections.
- Complete: validate current socket permissions and relevant database records;
  client messages do not authorize or supply authoritative mutation data.
- The project owner reports that the ordering migration has been handled.

### Phase 13 — Quality and polish (in progress)

- Added database-independent backend unit tests for card ordering, the shared
  board-access policy, and invitation email failure handling; frontend,
  WebSocket, and database integration coverage remains.
- Improve accessibility, keyboard use, responsive layouts, and interaction
  feedback. Card moves now have keyboard-accessible controls.
- Standardize loading, empty, retry, and error states. Board loading errors
  include retry controls and empty lists have explanatory text.
- Add regression coverage for API-level permission enforcement, optimistic
  updates, and real-time behavior.

### Phase 14 — Production readiness

- Define production environment configuration and secret handling.
- Add deployment/build and reviewed database migration workflows.
- Add operational logging, monitoring, health checks, backup/recovery, and
  service lifecycle guidance.
- Perform production security, performance, browser, and reliability checks.

## Known limitations and decisions to revisit

- Migrations are not applied automatically by schema generation. The project
  owner reports that the Phase 10–12 migrations have been handled. Check the
  intended database's migration status before running migration commands.
- The legacy migration promotes the oldest active `admin` membership in each
  workspace to `superadmin`, because the old schema did not record a workspace
  creator. It intentionally does not assign boards to existing members.
- Phase 11 uses a fixed set of single-select labels and date-only due dates.
  There are no card assignments, custom labels, or new notification delivery;
  notifications remain part of future real-time product decisions.
- Board and card mutations remain available through the API while WebSocket
  clients reconnect; connected peers may need a refresh if a notification
  could not be delivered.
- Phase 12 ordering migration status is reported handled by the project owner;
  verify against the intended database if migration state becomes relevant.
- The test suite covers issue-ordering rules, the shared board-access policy,
  and invitation failure handling. Add API persistence, frontend, WebSocket,
  and optimistic-update coverage as Phase 13 continues. No CI workflow is
  configured.

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
