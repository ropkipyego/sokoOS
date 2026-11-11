# SokoOS Implementation Roadmap

**Document:** SOKO-IMPL-ROADMAP-001  
**Source directive:** Master end-to-end product build  
**Order:** Strict — do not skip foundations.

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Audit & architecture docs | **Done** |
| 1 | Platform foundations | **Done** |
| 2 | Departments | **Done** |
| 3 | Item architecture | **Done** |
| 4 | Transaction context (dept on sales/reports) | **Done** |
| 5 | Restaurant pack | **Core done** |
| 6 | Hotel / accommodation | **Core done** |
| 7 | Guest folios (sale-linked) | **Core done** |
| 8 | Remaining industry packs | **Core done** (pharmacy/wholesale/services; hardware/electronics share foundation) |
| 9 | Configuration inheritance | **Done** |
| 10 | Integrations (M-Pesa, eTIMS boundaries) | **Done** (sandbox-safe; live needs credentials) |
| 11 | Offline / sync hardening | **Baseline done** |
| 12 | Reporting & finance completion | **Done** (finance rollup) |
| 13 | Release readiness | **Assessment done** — no deploy |

## Definition of done (every phase)

UI + API + DB + permissions + validation + tenant isolation + tests + docs + no fake buttons.
