# Day 1 Report: Environment and Database Setup

## Completed Scope
- Installed Day 1 dependencies for Drizzle + PostgreSQL, auth, S3, and utilities.
- Added database scripts to `package.json`.
- Added environment templates: `.env.example` and `.env.local`.
- Created Drizzle configuration and DB layer scaffold.
- Generated and applied first migration to local PostgreSQL.
- Validated project health with lint, typecheck, and tests.

## Installed Dependencies
- Runtime:
  - `drizzle-orm`, `pg`
  - `bcryptjs`, `jsonwebtoken`
  - `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
  - `uuid`
  - `dotenv`
- Dev:
  - `drizzle-kit`, `@types/pg`
  - `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/uuid`

## Package Scripts Added
- `db:generate`: `drizzle-kit generate`
- `db:migrate`: `drizzle-kit migrate`
- `db:studio`: `drizzle-kit studio`

## Files Added/Updated
- Added:
  - `drizzle.config.ts`
  - `lib/db/client.ts`
  - `lib/db/schema.ts`
  - `lib/db/migrations/.gitkeep`
  - `.env.example`
  - `.env.local`
  - `day1-report.md`
- Updated:
  - `package.json`
  - `pnpm-lock.yaml`

## Database Schema (v1)
- `users`:
  - role enum: `admin | hr_manager | employee`
  - unique email
  - password hash storage
- `refresh_tokens`:
  - user link
  - hashed token
  - expiry and revocation timestamps
- `audit_logs`:
  - action/resource audit trail base for security requirements

## Local DB Bring-Up (Executed)
- Docker Desktop started.
- PostgreSQL container launched:
  - image: `postgres:16-alpine`
  - container: `snark-postgres`
  - db: `snark_portal`
  - user/password: `postgres/postgres`
  - port: `5432`

## Migration Result
- `pnpm db:generate`: success
  - created migration:
    - `lib/db/migrations/0000_brainy_krista_starr.sql`
- `pnpm db:migrate`: success
- `pnpm db:studio`: startup verified successfully.

## Validation Result
- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (3/3)

## Required Environment Keys
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## Quick Start Commands
```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm dev
```
