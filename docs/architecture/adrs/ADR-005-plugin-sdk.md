# ADR-005: First-Party Plugin SDK with Manifest Registration

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-07-15 |

## Context

Industry features must not fork core. Marketplace is future; contracts must exist now.

## Options

1. Industry flags scattered in core  
2. **Plugin SDK + manifests + namespaced data**  
3. Fully remote sandboxed plugins immediately

## Decision

Adopt **option 2**. Host first-party plugins in-repo via `packages/plugin-sdk` contracts. Prefer plugin tables + optional JSON extension bags over altering core tables. Single registry index allowed for bundler discovery.

## Consequences

- Core remains stable as plugins grow.  
- Offline plugin entities must register sync schemas.  
- Untrusted third-party execution deferred until signing/sandbox exists.
