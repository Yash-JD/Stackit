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
`token`. A `join` message requests a board room; the service verifies the
user's workspace membership and sends initial presence state. It relays
`issue_moved` and `board_changed` events to other sockets in that board room.
The browser client is not yet fully wired for board-level real-time updates;
the event protocol is groundwork for that roadmap phase.

### Failed invitation notices

Workspace admins join a room with `join_organization` and an organization ID.
The service verifies admin membership. After an invitation email failure is
persisted by the API, the initiating client sends `invitation_failed` with
the invitation and organization IDs. The service verifies the failed
invitation and current admin role, then broadcasts the event to connected
admins of that organization. The frontend refreshes the persisted invitation
list when it receives the notice.

Do not treat client-supplied socket messages as authorization: validate the
JWT, current membership/role, and associated database record before relaying
events.

## Change checklist

Keep the event contract synchronized with the frontend People dialog and
backend invitation flow. Update this guide, the root
[project flow](../../PROJECT_FLOW.md), and the
[agent handoff](../../AGENT_HANDOFF.md) when the protocol, connection
configuration, or realtime scope changes.
