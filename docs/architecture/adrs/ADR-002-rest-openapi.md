# ADR-002: REST/OpenAPI as Primary API Style

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-07-15 |

## Context

Clients need a stable, documentable contract. Sync needs idempotent push/pull. Real-time updates are secondary.

## Options

1. GraphQL-only  
2. gRPC-only  
3. **REST + OpenAPI**, WebSocket for notifications  
4. tRPC tightly coupled to TS clients  

## Decision

Use **REST + OpenAPI** for public/system APIs including sync. Use **WebSockets** for server-initiated notifications (P1). Share Zod/types in `packages/types` and `packages/sync-protocol`.

## Consequences

- Strong tooling and gateway compatibility.  
- Slightly more boilerplate than tRPC; acceptable for multi-client (Electron, web, future mobile).  
- Sync envelopes versioned independently via `protocolVersion`.
