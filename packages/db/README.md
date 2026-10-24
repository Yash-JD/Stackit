# Stackit database package

This workspace owns the PostgreSQL schema, migrations, Prisma configuration,
and generated Prisma Client shared by the backend and WebSocket service.

## Architecture and structure

```text
packages/db/
  index.ts                  Prisma Client + PostgreSQL adapter export
  prisma/
    schema.prisma           Database models, relations, and enums
    migrations/             Ordered SQL migration history
  prisma7.config.ts         Prisma schema/migration paths and CLI datasource
  package.json              Prisma CLI/client dependencies and scripts
```

The current schema includes users, organizations, memberships, invitations,
board grants, boards, sections, issues, and comments. Important relationships:

- A user can belong to multiple organizations through a membership.
- Membership roles are `superadmin`, `admin`, and `member`. A workspace has at
  most one active superadmin.
- Superadmins and admins can access every board in their workspace. A member
  needs an active `BoardMembership` grant for each board they can access.
- Invitations associate a member with selected boards through
  `InvitationBoard`; accepting activates those grants.
- A workspace owns boards; boards contain sections and issues.
- Issues store a label, optional date-only due date, and persisted position
  within a section; they can have comments authored by users.
- `IssueActivity` records issue creation, metadata edits, list moves, and
  comment changes with an optional actor and timestamp. Deleting an issue
  cascades its comments and activity; deleting an actor preserves activity
  while clearing the actor relation.
- Invitations move through `PENDING`, `ACCEPTED`, `REJECTED`, or `FAILED`
  delivery/application states.
- Memberships and most content use `isDeleted` for soft deletion.

The generated client is emitted under `generated/prisma` and is ignored by
Git; regenerate it after schema changes.

## Requirements and setup

Use Bun 1.3.14 and install the monorepo from its root:

```bash
cd ../..
bun install
```

Configure `packages/db/.env` with a PostgreSQL `DATABASE_URL` for Prisma CLI
operations. Runtime services also need `DATABASE_URL` in `apps/backend/.env`.
Use the same database for migrations and runtime. Keep connection strings
private and never commit local environment files.

## Prisma workflow

From `packages/db`:

```bash
bun run prisma-all
```

The script formats the schema, generates Prisma Client, and runs
`prisma migrate dev`. It can create and apply migrations and changes the
configured database; use it only when that is intended. The backend package
forwards the same command as `bun run prisma-all`.

For schema-only edits, a safe first check is:

```bash
cd packages/db
bunx prisma validate
```

When a schema change requires a migration, review the generated SQL, commit
the schema and migration together, and regenerate the client. Do not edit old
migrations to represent new schema changes; add a new migration instead.
Production deployments should apply reviewed migrations with a deployment
workflow rather than running `migrate dev`.

The Phase 10 migrations add the superadmin role and board-grant tables, the
Phase 11 migration adds card metadata and activity history, and the Phase 12
migration adds/backfills issue positions and a section-order index. These
migrations are present. The project owner reports these migrations have been
handled; verify migration status against the intended database before future
migration operations. The current Prisma schema and generated client have
been validated.
The legacy migration promotes the oldest active admin in each existing
workspace because workspace creator identity was not recorded in the old
schema. Existing regular members are intentionally not granted boards; assign
their board access as needed after migration status is confirmed.

## Change checklist

Update all code that depends on changed models or enum values, regenerate the
client, validate/type-check affected services, and review migration behavior.
Keep this guide and the root [project flow](../../PROJECT_FLOW.md) or
[agent handoff](../../AGENT_HANDOFF.md) current when the data model or setup
workflow changes.
