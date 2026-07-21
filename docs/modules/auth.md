# Auth Module

## Purpose

Authenticate users and devices, issue short-lived access tokens + refresh tokens, bind sessions to tenants/branches, and expose the caller’s effective permission set for RBAC. Satisfies SRS auth/tenancy entry points used by Admin and POS.

## Architecture

NestJS `AuthModule` inside `services/api`:

- `AuthService` — password verify (bcrypt), JWT access/refresh, refresh rotation, logout, optional device registration  
- `JwtStrategy` + `JwtAuthGuard` — Bearer validation; `@Public()` opt-out for login/health  
- `PermissionsGuard` + `@RequirePermissions()` — enforced globally with JWT guard  
- `RolesService` — permission templates and `authzVersion` bump on role changes  

Tokens carry `sub` (user), `tenantId`, permissions snapshot / version, optional `deviceId` / `branchId`.

## Database

Prisma (Postgres): `users`, `refresh_tokens` (hashed), `devices`, `roles`, `permissions`, `role_permissions`, `user_roles`, `authz_versions`. Tenant scoping via `users.tenant_id`.

## API

Under `/v1` (see `services/api/openapi/openapi.yaml`):

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | email/password; optional `tenantSlug`, `deviceId`, `branchId` |
| `POST` | `/auth/refresh` | rotate refresh token |
| `POST` | `/auth/logout` | revoke refresh |
| `GET` | `/auth/me` | current user + permissions |

Related: `/users`, `/roles` for admin of identities.

## UI

- **Admin** — login screen; stores tokens; gates routes by permission keys  
- **POS** — device-oriented login; may pass `deviceId` for sync identity  

Neither UI embeds business rules beyond calling auth endpoints.

## Business Rules

- Active users only; inactive/archived rejected  
- Refresh tokens stored hashed; reuse detection may revoke family  
- Permission checks are OR over required keys on a route  
- Cross-tenant login disambiguated by `tenantSlug` when email collides  
- Demo seed: `demo@sokoos.local` / `Demo123!`

## Testing

- Unit: TTL parsing, token hash helper  
- Integration: login → me → refresh → logout; 401 without Bearer; 403 missing permission (`test/permissions.guard.test.ts`)  
- Security: tenant isolation on `/users` and resource GETs (**REQ-QA-006**)

## Security

- Distinct `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`  
- Short access TTL (default 15m); long refresh with rotation  
- Passwords bcrypt; never logged  
- Global throttling via Nest Throttler  
- Audit interceptor records mutating authenticated actions

## Future Improvements

- MFA / passkeys for owner roles  
- Step-up auth for voids and large discounts  
- Session list UI and remote revoke  
- OIDC SSO for enterprise tenants  
