# ADR-001: Modular Monolith for Cloud API

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-07-15 |
| **Deciders** | Architecture |

## Context

SRS lists multiple services (`auth-service`, `sales-service`, …). We must choose deployable topology for v1 without sacrificing clean boundaries or future extraction.

## Options

1. **Microservices from day one** — independent deploys, higher operational and consistency cost.  
2. **Unstructured single app** — fastest coding, poor long-term maintainability.  
3. **Modular monolith** — one NestJS deployable with strict bounded contexts/packages; extract services later.

## Decision

Adopt **option 3**: `services/api` modular monolith with domain modules mirroring SRS services. Keep optional service folders as packages until a scaling or team boundary forces extraction.

## Consequences

- Simpler transactions and local reasoning for sync ingest.  
- Must enforce import boundaries (lint/CI).  
- Extraction path is preserved via package boundaries.
