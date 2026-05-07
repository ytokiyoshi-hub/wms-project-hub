# ER 図ドラフト：致命傷ライン関連の核テーブル

> 起票：2026-05-08 / Phase 7-A（まーちゃん・自走モード）
> 致命傷ライン15項目の **まーちゃん推奨案**（process_03_db_design.md / process_02_system_design.md）に基づく ER 図のドラフト。
> 朝の時吉さん判断で確定後、Phase 7-B で実装移行。

---

## スコープ

致命傷ライン15項目を実現する **核テーブル群**：

- `owners`：荷主マスタ（DB-4 荷主切替・差別化4点の起点）
- `skus`：商品マスタ（AU-2 SKU/JAN・DB-3 シリアル）
- `lots`：ロット（DB-2）
- `locations`：ロケーション（DB-5）
- `inventory`：在庫（DB-1 4軸）
- `users` + `user_owners`：権限（AU-1）
- `billing_rules`：請求ルール（CA-1）

---

## 全体図（mermaid）

```mermaid
erDiagram
    owners ||--o{ skus : "1荷主N商品"
    owners ||--o{ lots : "1荷主Nロット"
    owners ||--o{ locations : "1荷主Nロケ（または共有）"
    owners ||--o{ inventory : "1荷主N在庫レコード"
    owners ||--o{ user_owners : "1荷主N権限割当"
    owners ||--o{ billing_rules : "1荷主N請求ルール"
    
    skus ||--o{ inventory : "1SKU N在庫"
    lots ||--o{ inventory : "1ロット N在庫"
    locations ||--o{ inventory : "1ロケ N在庫"
    
    skus ||--o{ lots : "1SKU Nロット"
    skus ||--o{ serials : "1SKU Nシリアル（serial_required時のみ）"
    
    users ||--o{ user_owners : "1ユーザーN荷主アクセス"
    
    owners {
        bigint id PK
        text code "TKY/AAA等"
        text name
        text theme_color "差別化4点：荷主別テーマカラー"
        text allocation_strategy "BF-2: fifo/lifo/lpa/custom"
        text picking_strategy "BF-3: single/batch/wave/auto"
        text lot_strategy "DB-2: inbound_batch/manufacturer/none"
        text inspection_strategy "BF-1 工程2-Q2: full/sampling/sign"
        text discrepancy_strategy "工程2-Q3: hold/post"
        text putaway_strategy "工程2-Q4: fixed/free/abc"
        text return_strategy "工程2-Q5: not_managed/wms_separate"
        text barcode_required_fields "LK-2: jan,serial,lot,owner_sku"
        boolean cost_management_enabled "CA-2"
        timestamp created_at
    }
    
    skus {
        bigint id PK
        bigint owner_id FK
        text sku_code "荷主指定 SKU"
        text jan
        text name
        boolean serial_required "DB-3"
        boolean lot_required "DB-2"
        timestamp created_at
        UNIQUE "(owner_id, sku_code)"
        UNIQUE "(owner_id, jan)"
    }
    
    lots {
        bigint id PK
        bigint owner_id FK
        bigint sku_id FK
        text lot_number
        text source_type "inbound_batch/manufacturer"
        date mfg_date
        date expiry_date
        timestamp created_at
    }
    
    locations {
        bigint id PK
        bigint owner_id FK "NULL の場合は共有ロケ"
        text code "WH-A1-01-3 等"
        text area
        text aisle
        text rack
        text level
        text location_type "storage/picking/staging/damage/returns/inspection"
        text abc_class "A/B/C"
        int picking_priority
        timestamp created_at
    }
    
    inventory {
        bigint id PK
        bigint owner_id FK
        bigint sku_id FK
        bigint lot_id FK "DB-2"
        bigint location_id FK
        decimal quantity "DB-1: 4軸の数量"
        text status "available/reserved/damaged/quarantine"
        decimal unit_cost "CA-2: 移動平均単価"
        timestamp updated_at
        UNIQUE "(owner_id, sku_id, lot_id, location_id, status)"
    }
    
    serials {
        bigint id PK
        bigint sku_id FK
        text serial_number
        bigint current_inventory_id FK
        text status
    }
    
    users {
        uuid id PK "supabase auth.users"
        text email
        text display_name
        timestamp created_at
    }
    
    user_owners {
        bigint id PK
        uuid user_id FK
        bigint owner_id FK
        text role "AU-1: admin/operator/viewer/shipper"
        timestamp granted_at
        UNIQUE "(user_id, owner_id)"
    }
    
    billing_rules {
        bigint id PK
        bigint owner_id FK
        text rule_type "保管料/入庫料/出庫料/期間外料/その他"
        text period_type "CA-1: 3-period/2-period/daily/monthly/tsubo"
        decimal unit_price
        text unit "case/piece/tsubo/sqm"
        date valid_from
        date valid_to
        timestamp created_at
    }
```

---

## RLS（Row Level Security）方針

致命傷ライン DB-4（荷主切替）と AU-1（権限）の中核実装。

```sql
-- inventory テーブル例
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分が所属する荷主のみアクセス可
CREATE POLICY inventory_owner_access ON inventory
  FOR ALL
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator', 'viewer')
    )
  );

-- shipper（荷主自身）は自分の荷主のみ閲覧
CREATE POLICY inventory_shipper_read ON inventory
  FOR SELECT
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid() AND role = 'shipper'
    )
  );
```

同パターンを `skus` / `lots` / `locations` / `billing_rules` 全テーブルに適用。

---

## 致命傷ライン15項目との対応

| ID | 項目 | 関連テーブル | 実装ポイント |
|----|------|------------|------------|
| DB-1 | 在庫の持ち方 | inventory | 4軸 UNIQUE 複合キー |
| DB-2 | ロット管理方式 | lots / owners.lot_strategy | 荷主切替フラグ |
| DB-3 | シリアル管理方式 | serials / skus.serial_required | SKU 単位フラグ |
| DB-4 | 荷主切替の方式 | 全テーブル owner_id + RLS | Supabase RLS 中心 |
| DB-5 | ロケーション管理方式 | locations | location_type + abc_class |
| BF-1 | 検品・ピッキング順序 | owners.inspection_strategy | 荷主切替 |
| BF-2 | 引当ロジック | owners.allocation_strategy | 荷主切替＋多軸 |
| BF-3 | ピッキング方式 | owners.picking_strategy | 荷主×荷量切替 |
| BF-4 | 返品・誤出荷処理 | inventory.status + owners.return_strategy | ステータス分離 |
| CA-1 | 請求賃率計算 | billing_rules | 荷主×ルール×期間単価 |
| CA-2 | 原価評価方式 | inventory.unit_cost + owners.cost_management_enabled | 移動平均・荷主オプション |
| AU-1 | 権限・承認フロー | user_owners + RLS | 荷主×ロール |
| AU-2 | SKU/JANコード管理 | skus | UNIQUE(owner_id, sku_code) / (owner_id, jan) |
| LK-1 | 外部連携方式 | （別テーブル connectors・本図対象外） | 工程14 で詳細化 |
| LK-2 | HTバーコード仕様 | owners.barcode_required_fields | 荷主切替 |

---

## 朝の判断後の作業（Phase 7-B 想定）

致命傷ライン15項目が時吉さん判断で確定したら：

1. 本 ER 図を最終化（推奨と異なる場合は調整）
2. Supabase migration ファイル作成（`sql/00X_critical_design_lines.sql`）
3. RLS ポリシー実装
4. 既存テーブル（`todos` / `kurokun_memo` / `kurokun_outbox`）と結合確認
5. 工程4（入荷機能開発）の `inbound_movements` テーブルを上記 ER 図に乗せて追加

---

## 注意事項

- 本 ER 図は **まーちゃん推奨案ベース**。時吉さん判断で大きく変わる項目あり：
  - DB-4 が A/C/D（物理分離・スキーマ分離・ハイブリッド）になると owner_id カラム設計から再考
  - DB-3 が C（全 SKU シリアル管理）になると serials テーブルが激重に
- `users` は Supabase Auth の `auth.users` と1:1。WMS 内では `user_owners` で荷主アクセス管理
- `inventory` の 4軸 UNIQUE は同一 SKU・同一ロットでも `status` 別（available / reserved / damaged）に複数行を持てる構造

---

*最終更新: 2026-05-08 / Phase 7-A まーちゃん（致命傷ライン関連の核 ER 図ドラフト）*
