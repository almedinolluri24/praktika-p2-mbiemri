# Foodora — ER diagrami

```mermaid
erDiagram
    USERS ||--o{ RESTAURANTS : owns
    RESTAURANTS ||--o{ BRANCHES : has
    USERS ||--o{ BRANCH_STAFF : assigned
    BRANCHES ||--o{ BRANCH_STAFF : staffs
    BRANCHES ||--o{ BUSINESS_HOURS : schedules
    RESTAURANTS ||--o{ PRODUCT_CATEGORIES : defines
    RESTAURANTS ||--o{ PRODUCTS : sells
    PRODUCT_CATEGORIES ||--o{ PRODUCTS : categorizes
    BRANCHES ||--o{ BRANCH_PRODUCTS : offers
    PRODUCTS ||--o{ BRANCH_PRODUCTS : available_at
    OPTION_GROUPS ||--o{ PRODUCT_OPTIONS : contains
    OPTION_GROUPS }o--o{ PRODUCTS : configures
    BRANCHES ||--o{ ORDERS : receives
    USERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    ORDERS ||--o| PAYMENTS : paid_by
    PRODUCTS o|--o{ ORDER_ITEMS : snapshot_source
    ORDER_ITEMS ||--o{ ORDER_ITEM_OPTIONS : selects
    PRODUCT_OPTIONS o|--o{ ORDER_ITEM_OPTIONS : snapshot_source
    ORDERS ||--o{ ORDER_STATUS_HISTORY : tracks
    USERS o|--o{ ORDER_STATUS_HISTORY : acts
    ORDERS ||--o{ ORDER_ETA_HISTORY : estimates
    USERS o|--o{ ORDER_ETA_HISTORY : changes
    USERS o|--o{ AUDIT_LOGS : performs
    USERS ||--o{ NOTIFICATIONS : receives

    USERS {
        bigint id PK
        string role
        string name
        string email UK
    }
    RESTAURANTS {
        bigint id PK
        bigint owner_id FK
        string business_type
        string status
    }
    BRANCHES {
        bigint id PK
        bigint restaurant_id FK
        string name
        string city
        string address
        string phone
        text pickup_instructions
        string timezone
        boolean is_active
    }
    BUSINESS_HOURS {
        bigint id PK
        bigint branch_id FK
        tinyint weekday
        time opens_at
        time closes_at
        smallint orders_per_slot
    }
    BRANCH_STAFF {
        bigint id PK
        bigint branch_id FK
        bigint user_id FK
        string role
    }
    PRODUCTS {
        bigint id PK
        bigint restaurant_id FK
        bigint category_id FK
        decimal price
        json allergens
        string prep_station
    }
    BRANCH_PRODUCTS {
        bigint id PK
        bigint branch_id FK
        bigint product_id FK
        decimal price_override
        boolean is_available
    }
    OPTION_GROUPS {
        bigint id PK
        bigint restaurant_id FK
        boolean is_required
        tinyint min_selections
        tinyint max_selections
    }
    PRODUCT_OPTIONS {
        bigint id PK
        bigint option_group_id FK
        decimal price_delta
    }
    ORDERS {
        bigint id PK
        bigint branch_id FK
        bigint customer_id FK
        string status
        datetime pickup_at
        datetime estimated_ready_at
        datetime packaging_confirmed_at
        string schedule_type
        string payment_method
        text customer_note
        decimal total
        string idempotency_key
        string pickup_code_hash
    }
    ORDER_ITEMS {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        string product_name
        decimal unit_price
        smallint quantity
        decimal line_total
        string prep_station
        string prep_status
        datetime completed_at
    }
    ORDER_ITEM_OPTIONS {
        bigint id PK
        bigint order_item_id FK
        bigint product_option_id FK
        string group_name
        string option_name
        decimal price_delta
    }
    ORDER_STATUS_HISTORY {
        bigint id PK
        bigint order_id FK
        bigint actor_id FK
        string from_status
        string to_status
    }
    ORDER_ETA_HISTORY {
        bigint id PK
        bigint order_id FK
        bigint actor_id FK
        smallint eta_minutes
        smallint previous_eta_minutes
        datetime estimated_ready_at
    }
    PAYMENTS {
        bigint id PK
        bigint order_id FK UK
        bigint recorded_by FK
        string method
        string status
        decimal amount
        datetime paid_at
    }
    AUDIT_LOGS {
        bigint id PK
        bigint actor_id FK
        string event
        json metadata
    }
    NOTIFICATIONS {
        uuid id PK
        bigint notifiable_id
        string notifiable_type
        json data
        datetime read_at
    }
```

Produktet dhe opsionet kopjohen te `order_items` / `order_item_options` si snapshot emri e çmimi; fshirja e produktit origjinal nuk ndryshon historikun e blerjes. `pickup_code_hash` është hash i kodit njëpërdorimësh; një kopje e enkriptuar ruhet për t'ia kthyer të njëjtin sekret klientit në riprovim idempotent.

Migrimet bazë të Laravel-it për sesione, cache dhe jobs nuk paraqiten në diagram.
