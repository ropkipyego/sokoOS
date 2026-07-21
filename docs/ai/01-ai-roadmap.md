# SokoOS — AI Roadmap (Deferred)

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-AI-001 |
| **Version** | 1.0.0 |
| **Status** | **Deferred** — not in current implementation |

---

## 1. Explicit deferral

**AI forecasts, replenishment recommendations, anomaly detection, and cashier copilots are out of scope for the current platform foundation.**

Do not add AI model calls, recommendation tables, or “smart” inventory suggestions to core modules until the prerequisites below are met. The SRS may list aspirational AI capabilities; this document overrides schedule: **AI = deferred**.

---

## 2. What is deferred

| Capability | Notes |
| --- | --- |
| Demand / sales forecasts | Time-series over tenant sales |
| Reorder / stock recommendations | Needs clean movement history + supplier lead times |
| Price / promo suggestions | Requires policy + human approval UX |
| Fraud / void anomaly flags | Needs labeled events + low false-positive ops |
| NLP search / receipt assistants | Optional later; not POS-critical |

Plugins must not smuggle AI into core sale commit paths.

---

## 3. Prerequisites before any AI work

1. **Stable domain events** — append-only stock movements, immutable sales, audited voids/returns in production use.  
2. **Sync correctness** — REQ-QA-002/003 green; conflict rates understood.  
3. **Tenant isolation proven** — REQ-QA-006 suites + ops runbooks.  
4. **Reporting baselines** — sales / stock / expense reports accurate enough to train or evaluate models.  
5. **Data contract** — feature store or export jobs with PII policy (no raw customer phone in training without consent).  
6. **Offline story** — recommendations never block offline checkout; cloud-only side channel.  
7. **Cost & egress controls** — model provider allowlists, per-tenant budgets, kill switch.

---

## 4. When AI is green-lit

1. Add `docs/modules/ai.md` with Purpose → Security sections.  
2. Ship as a **plugin or optional module** (`soko.plugin.ai-*`), not hard-wired into Sales/Inventory.  
3. All suggestions human-approved; never auto-mutate stock or prices without explicit permission keys.  
4. Extend testing strategy with evaluation fixtures (offline accuracy ≠ production accuracy).

---

## 5. Interim guidance for contributors

- Prefer better inventory accuracy, sync reliability, and reports over predictive UX.  
- If a ticket says “AI”, re-scope to deterministic rules (e.g. low-stock threshold alerts via Notifications) unless this roadmap is revised.
