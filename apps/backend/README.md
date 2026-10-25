# Stackit backend

The backend is the Express HTTP API for authentication, organizations,
memberships, boards, sections, issues, and comments. Prisma Client talks to
PostgreSQL through the shared `packages/db` workspace.

## Architecture and structure

```text
apps/backend/
  index.ts                 Express app, middleware, health checks, router mounts
  src/
    authentication.ts      Signup, signin, and current-user profile routes
    organization.ts        Workspace CRUD and membership lookups
    orgMember.ts           Invites, board access, roles, and membership changes
    board.ts               Board CRUD
    section.ts             Board section CRUD
    issue.ts               Issue CRUD, metadata, activity logging, and moves
    comment.ts             Issue comment endpoints and activity logging
    activity.ts            Authorized issue activity history
  helper/
    authMiddleware.ts      JWT verification and request user identity
    hasRole.ts             Workspace role and board-grant checks
    boardAccessPolicy.ts   Shared pure role/grant decision for board access
    invitationDelivery.ts  Invitation email delivery and failure persistence
    email.ts               Invitation and password-reset email delivery
    errorHandler.ts        Shared Express error response handling
  shared/
    apidocs.ts             OpenAPI document served by Swagger UI
    checkDBhealth.ts       Database connectivity check
```

`index.ts` enables JSON parsing and CORS for the local frontend origin
`http://localhost:5173`, exposes `/health`, `/health/db`, and `/api-docs`, then
mounts the feature routers. Protected routes use the raw JWT in the
`Authorization` request header (not a `Bearer`-prefixed value).

## Requirements and setup

Use Bun 1.3.14 and the repository-level install:

```bash
cd ../..
bun install
```

Create `apps/backend/.env` locally with:

```dotenv
DATABASE_URL=<PostgreSQL connection string>
JWT_SECRET=<secret used to sign and verify tokens>
RESEND_API_KEY=<Resend API key>
```

Do not commit `.env` files or put their values in logs, documentation, or
source control. Prisma CLI operations use the database package's own
`packages/db/.env`; configure its `DATABASE_URL` for the same database.

## Run and maintain

From `apps/backend`:

```bash
bun run prisma-all
bun run start:dev
```

`prisma-all` forwards to the database package script. It formats the Prisma
schema, generates Prisma Client, and runs `prisma migrate dev` against the
configured database. Review schema and migration changes before running it.

`start:dev` starts the API with Bun watch mode from the monorepo root, so
changes to backend code and imported workspace files (including the shared
database client) trigger a restart. It loads `apps/backend/.env` and listens
on port `3000`.

API health checks:

- `http://localhost:3000/health`
- `http://localhost:3000/health/db`
- `http://localhost:3000/api-docs`

Run focused backend unit tests from the repository root with `bun test`, or
from this package with `bun run test`. Current tests cover card ordering, the
shared workspace-role/board-grant policy, and invitation email failure
handling, membership mutation policy, and profile update validation. They use
Bun's built-in test runner and do not require a database.

For a direct non-watch run from this package, use `bun run index.ts` after
configuring the required environment variables.

## Current API areas

| Area           | Routes                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication | `POST /api/v1/signup`, `POST /api/v1/signin`, `GET`/`PUT /api/v1/profile` (self profile; email is read-only)                                           |
| Organizations  | `GET /api/v1/organization`, `POST /api/v1/organization/create`, and `/:orgId` update, get, and delete routes                                           |
| Membership     | Invite with board IDs; pending/list/accept/reject invitations; member list/removal; role and board-grant updates                                       |
| Boards         | `GET`/`POST /api/v1/boards`, `PUT`/`DELETE /api/v1/boards/:boardId`                                                                                    |
| Sections       | `GET`/`POST /api/v1/section`, `PUT`/`DELETE /api/v1/section/:sectionId`                                                                                |
| Issues         | List/create/update/delete issues, persist labels/due dates and section ordering, and move/reorder issues; activity via `GET /api/v1/activity/:issueId` |
| Comments       | List/create/update/delete comments for issues; changes are recorded in issue activity                                                                  |

See the live OpenAPI document at `/api-docs` for request and response shapes.
Authorization is enforced server-side; hiding a frontend control is not an
access-control check.

The authenticated `/api/v1/profile` GET and PUT routes expose only the current
user's profile. The update schema accepts a display name, photo URL, and short
description; email and other account credentials cannot be changed through
this route. Existing users' names are backfilled from their email local-part
by the new display-name migration.

The workspace creator is assigned the sole `superadmin` role. Superadmins and
admins can manage workspace/board/list operations and access all workspace
boards. Members must have an active workspace membership and explicit board
grant; they can manage cards and comments on assigned boards. The API rejects attempts to demote or remove the superadmin, including
self-removal, and rejects role changes and removals targeting the acting
administrator. Board
grant changes are validated against the target workspace. The project owner
reports that the Phase 10–12 migrations have been handled. Verify migration
status against the intended database before any future migration operation;
do not rerun them based on this guide alone.

Cards persist one of the existing labels (`Design`, `Build`, `Research`) and
an optional date-only due date. Their position within a section is persisted;
`PUT /api/v1/issue/move/:issueId/:sectionId` accepts an optional nonnegative
`position` to move or reorder a card. The API returns section issues ordered by
position. Authorized users can read and add activity history for cards.
Comments can be edited or deleted only by their author; deleted comments are
soft-deleted, while their activity entries remain. Phase 12 ordering migration
is part of the Phase 12 schema and migration history.

## Change checklist

When changing an API route, update its validation and authorization, API
documentation, relevant frontend client/UI, this guide, and
[the project flow](../../PROJECT_FLOW.md) or
[agent handoff](../../AGENT_HANDOFF.md) when architecture or project status
changes. Add or update tests when coverage is introduced.
