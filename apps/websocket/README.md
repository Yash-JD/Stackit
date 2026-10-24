# Stackit WebSocket service

The WebSocket service is a separate Bun process that authenticates connections
with the same JWT as the HTTP API. It currently supports board-room presence
and relaying board events, plus workspace-admin notifications for failed
invitation email delivery.

## Architecture and structure

```text
apps/websocket/
  index.ts       WebSocket server, JWT validation, room membership, event relay
  package.json   Workspace dependencies and development scripts
  tsconfig.json  TypeScript checking configuration
```

The service imports Prisma Client from `packages/db`. It reads `JWT_SECRET`
for connection authentication and `WS_PORT` for its listening port (defaults
to `8080`). It currently does not expose an HTTP health endpoint.

## Requirements and setup

Install all workspace dependencies from the repository root:

```bash
bun install
```

The development script loads `apps/backend/.env` so the service shares the
backend's `DATABASE_URL` and `JWT_SECRET`. Set `WS_PORT` there only if the
default port must change. The frontend can target a different service URL with
`BUN_PUBLIC_WS_URL`.

## Run and validate

From `apps/websocket`:

```bash
bun run start:dev
```

This runs Bun watch mode from the monorepo root. Changes to this service and
its workspace imports are watched and restart the process. Stop it with
Ctrl+C. Type-check from the monorepo root:

```bash
bunx tsc --noEmit -p apps/websocket/tsconfig.json
```

## Current event flows

### Board rooms

Clients authenticate with a JWT in the WebSocket URL query parameter
`token`. A `join` message requests a board room; the service requires active
workspace membership and, for regular members, an active grant for that board.
Admins and superadmins can join every board in their workspace. Every
board-room event re-checks current access for the sender and recipients.
`issue_moved` is relayed only when the issue's persisted section matches the
message; the server includes its persisted position. `board_changed` only
prompts clients to reload from the API and may identify an existing issue for
activity refresh. Board rename notifications require current board access;
board deletion notifications require an active workspace admin and an
already-soft-deleted board. Mutation payloads are never treated as persisted
state.

The frontend connects when a board page opens, sends `join`, and consumes
`initial_state`, `join`, and `leave` presence messages. It retries interrupted
connections with bounded exponential delays and exposes a manual retry after
the retry limit. After receiving a change event, clients reload the board and
issue activity from the API.

### Failed invitation notices

Workspace admins and superadmins join a room with `join_organization` and an
organization ID. The service verifies admin membership. After an invitation
email failure is persisted by the API, the initiating client sends
`invitation_failed` with the invitation and organization IDs. The service
verifies the failed invitation and current admin role, then broadcasts the
event to connected admins of that organization. The frontend refreshes the
persisted invitation list when it receives the notice.

Do not treat client-supplied socket messages as authorization: validate the
JWT, current membership/role, and associated database record before relaying
events.

## Change checklist

Keep the event contract synchronized with the frontend People dialog and
backend invitation flow. Update this guide, the root
[project flow](../../PROJECT_FLOW.md), and the
[agent handoff](../../AGENT_HANDOFF.md) when the protocol, connection
configuration, or realtime scope changes.
