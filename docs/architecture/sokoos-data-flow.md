# SokoOS Data Flow

**Document:** SOKO-ARCH-FLOW-001  
**Depends on:** [Upgrade audit](../audit/sokoos-upgrade-audit.md), [Upgrade plan](./sokoos-upgrade-plan.md)

---

## 1. Runtime topology

```mermaid
flowchart LR
  subgraph edge [POS terminal]
    UI[POS React]
    Mem[(MemoryLocalDb)]
    Outbox[Outbox]
    UI --> Mem
    Mem --> Outbox
  end

  subgraph lan [Same Wi-Fi]
    Admin[Admin React]
  end

  subgraph cloud [API host]
    API[NestJS /v1]
    PG[(PostgreSQL)]
    Redis[(Redis / BullMQ)]
    Files[Local media]
    API --> PG
    API --> Redis
    API --> Files
  end

  UI -->|"JWT /sales /products"| API
  Outbox -->|"POST /sync/push + JWT"| API
  Admin -->|"JWT CRUD"| API
  API -.->|Socket.IO| Admin
```

POS may sell **cash** while offline. M-Pesa STK and eTIMS require network and must not be marked success offline.

---

## 2. Sale (online)

```mermaid
sequenceDiagram
  actor Cashier
  participant POS
  participant API
  participant PG

  Cashier->>POS: Cart + tender
  POS->>API: POST /v1/sales (JWT cashier)
  API->>PG: Sale + items + payments + stock movements
  API-->>POS: receiptNumber + snapshots
  Note over POS: Do NOT also decrement local stock again
  POS->>POS: Print receipt profile
```

Cash stores `tenderedMinor` / `changeMinor`.  
M-Pesa payment may be `pending` until callback; sale may be `pending_payment` until completed allocations cover total.

---

## 3. Sale (offline cash)

```mermaid
flowchart TD
  A[Complete cash sale] --> B[MemoryLocalDb.completeSale]
  B --> C[Local stock -qty]
  B --> D[Outbox]
  D --> E{online?}
  E -->|yes| F[POST /sync/push with JWT]
  F --> G[API accepts idempotent sale id]
```

---

## 4. LPO create → receive (same document)

```mermaid
sequenceDiagram
  actor Buyer
  participant Admin
  participant API
  participant PG

  Buyer->>Admin: Create draft lines
  Admin->>API: POST /purchases
  API->>PG: Purchase + items qtyReceived=0 + lpoNumber
  Buyer->>Admin: Issue
  Admin->>API: POST /purchases/:id/issue
  API->>PG: status=issued
  Buyer->>Admin: Receive partial/full
  Admin->>API: POST /purchases/:id/receive
  Note over API,PG: SAME purchase id
  API->>PG: quantityReceived += n
  API->>PG: StockMovement referenceId=purchase.id
  API->>PG: status=partial|received
```

Partial GRNs are multiple receive calls against one LPO. Cancel only if nothing received.

---

## 5. Product image

```mermaid
flowchart LR
  Admin -->|multipart| Catalog
  Catalog --> Media[MediaService disk]
  Media --> URL["/v1/media/{tenant}/products/..."]
  Catalog --> Product[(products.image_url)]
  POS -->|img src mediaUrl| URL
```

---

## 6. Inventory transfer

```mermaid
sequenceDiagram
  Admin->>API: POST /stock/transfers
  API->>PG: movement transfer OUT warehouse A
  API->>PG: movement transfer IN warehouse B
  Note over PG: Same correlationId; balances updated; no net create/destroy
```

---

## 7. Money and fiscal honesty

- Revenue = completed sale totals (not till cash).
- Gross profit ≈ revenue − product cost snapshots/costs (dashboard).
- Net profit needs expenses + full COGS — do not conflate.
- Local receipt ≠ eTIMS fiscal invoice until verified OSCU/VSCU confirmation.
