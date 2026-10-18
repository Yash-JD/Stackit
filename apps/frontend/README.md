# Stackit frontend

The frontend is a React 19 and TypeScript single-page application. Bun serves
the app during development and builds its production browser bundle.

## Architecture and structure

```text
apps/frontend/src/
  frontend.tsx             React root, BrowserRouter, AuthProvider
  App.tsx                  Public/protected routes, workspace and board pages
  auth.tsx                 Auth context and persisted JWT state
  api.ts                   Typed API models, request helper, endpoint functions
  types.ts                 Board and card view models
  hooks/
    useBoard.ts            Board loading, mutations, optimistic issue moves
    useWorkspaceBoards.ts  Workspace/board grouping and refresh events
  components/
    AuthPage.tsx
    Sidebar.tsx
    BoardCanvas.tsx
    BoardTopbar.tsx         Board header, top bar, and presence controls
    BoardToolbar.tsx
    OrganizationMembersDialog.tsx
    StackitLogo.tsx
  index.css                Application styles
  index.html               Browser document entry
  index.ts                 Bun server and development HMR
```

`frontend.tsx` provides router and authentication context. `App.tsx` composes
the protected workspace shell, board list, and board pages. Data requests are
centralized in `api.ts`; reusable server-state behavior belongs in the hooks,
while page/component state handles view interactions and dialogs.

## Requirements and setup

From the repository root, install the Bun workspace dependencies once:

```bash
bun install
```

The backend API and WebSocket defaults are `http://localhost:3000` and
`ws://localhost:8080`. Optionally set `BUN_PUBLIC_API_URL` and
`BUN_PUBLIC_WS_URL` in the frontend environment. The Bun dev server defaults
to port `5173`; set `PORT` to override it.

## Run and build

From `apps/frontend`:

```bash
bun run dev
bun run build
bun run start
```

`dev` starts the Bun server with HMR. `build` writes the production bundle to
`dist/`. `start` serves the production-mode Bun entry; configure
`NODE_ENV=production` according to your shell/deployment environment.

## Data and interaction behavior

- The frontend sends the raw stored JWT through the `Authorization` header.
- Board and workspace data are loaded from the API; mutations update local
  state where implemented to avoid reloading every card/list.
- Card moves are optimistic and roll back when the API rejects the move.
- Sidebar/workspace changes use local browser events to refresh affected views.
- The People dialog uses the authenticated WebSocket service for live failed
  invitation delivery notices; it also reads persisted invitation status from
  the API.
- WebSocket configuration and behavior are described in the
  [WebSocket guide](../websocket/README.md).

## Validation and documentation

Type-check and production-build from the repository root:

```bash
bunx tsc --noEmit -p apps/frontend/tsconfig.json
bun run --cwd apps/frontend build
```

Keep this guide synchronized with route structure, shared state hooks,
environment settings, and user-visible workflows. Update
[the project flow](../../PROJECT_FLOW.md) for roadmap or workflow changes and
[the agent handoff](../../AGENT_HANDOFF.md) when continuation context changes.
