# Stackit backend

The backend is the Express HTTP API for authentication, organizations,
memberships, boards, sections, issues, and comments. Prisma Client talks to
PostgreSQL through the shared `packages/db` workspace.

## Architecture and structure

```text
apps/backend/
  index.ts                 Express app, middleware, health checks, router mounts
  src/
    authentication.ts      Signup and signin
    organization.ts        Workspace CRUD and membership lookups
    orgMember.ts           Invites, membership lists, accept/decline/removal
    board.ts               Board CRUD
    section.ts             Board section CRUD
    issue.ts               Issue CRUD, listing, and section moves
    comment.ts             Issue comment endpoints
  helper/
    authMiddleware.ts      JWT verification and request user identity
    hasRole.ts             Workspace membership/role checks
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

For a direct non-watch run from this package, use `bun run index.ts` after
configuring the required environment variables.

## Current API areas

| Area           | Routes                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Authentication | `POST /api/v1/signup`, `POST /api/v1/signin`                                                                 |
| Organizations  | `GET /api/v1/organization`, `POST /api/v1/organization/create`, and `/:orgId` update, get, and delete routes |
| Membership     | `POST /api/v1/invite`, invitation pending/list/accept/reject routes, member list, and member removal         |
| Boards         | `GET`/`POST /api/v1/boards`, `PUT`/`DELETE /api/v1/boards/:boardId`                                          |
| Sections       | `GET`/`POST /api/v1/section`, `PUT`/`DELETE /api/v1/section/:sectionId`                                      |
| Issues         | List/create/update/delete issues and `PUT /api/v1/issue/move/:issueId/:sectionId`                            |
| Comments       | List/create/update/delete comments for issues                                                                |

See the live OpenAPI document at `/api-docs` for request and response shapes.
Authorization is enforced server-side; hiding a frontend control is not an
access-control check.

## Change checklist

When changing an API route, update its validation and authorization, API
documentation, relevant frontend client/UI, this guide, and
[the project flow](../../PROJECT_FLOW.md) or
[agent handoff](../../AGENT_HANDOFF.md) when architecture or project status
changes. Add or update tests when coverage is introduced.
