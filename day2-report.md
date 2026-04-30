# Day 2 Report: Authentication (Server Side)

## Implemented
- Created auth types and shared validator:
  - `types/auth.d.ts`
  - `lib/validators/auth.ts`
- Added auth utilities:
  - `lib/auth/password.ts`
  - `lib/auth/tokens.ts`
  - `lib/auth/session.ts`
- Added API routes:
  - `app/api/auth/login/route.ts`
  - `app/api/auth/refresh/route.ts`
  - `app/api/auth/logout/route.ts`
- Added route protection:
  - `middleware.ts`
- Added App Router auth/protected pages:
  - `app/(auth)/login/page.tsx`
  - `app/(main)/layout.tsx`
  - `app/(main)/dashboard/page.tsx`
  - `app/(main)/admin/page.tsx`
- Added client auth context/hook:
  - `hooks/use-auth.tsx`
- Integrated `AuthProvider` into root layout:
  - `app/layout.tsx`

## Security Checklist
- Passwords are verified only on server via bcrypt.
- Refresh token is stored in DB as hash (SHA-256), not plaintext.
- Refresh token is set in `httpOnly` cookie.
- Cookie flags include `sameSite: "lax"` and `secure` in production mode.
- Login error does not disclose whether email exists.
- No logging of passwords/tokens/secrets in new auth code.
- Role guard for `/admin/*` is enforced in middleware.

## Validation Results
- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (3/3)

## Notes
- Middleware attempts refresh via `/api/auth/refresh` when access token is missing/invalid.
- Access token is also set in cookie for middleware checks.
- Existing DB schema (`users`, `refresh_tokens`) was reused without destructive changes.
