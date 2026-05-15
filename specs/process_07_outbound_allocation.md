# 工程7：在庫引当仕様（BF-2 詳細実装仕様）

> 起票：2026-05-16 / Phase 9-BF2 さーちゃん（id=5）
> 前提ファイル：`process_07_to_09_outbound_chain.md`（工程7-9 統合ドラフト）から引当部分を分離・詳細化
> 依存テーブル：`owners`（Stage 1）/ `skus`（Stage 1）/ `lots` `locations` `inventory`（Stage 2）

---

## 確定値サマリー

| 項目 | 確定値 | 根拠 |
|------|--------|------|
| BF-2 引当ロジック | D（多軸+荷主切替） | MORNING_DECISION_SHEET 2026-05-14 時吉さん判断 |
| ピッキングFIFO | 強制（E-6） | process_01_requirements.md「FIFO強制」 |
| DB-1 在庫モデル | D（4軸 UNIQUE） | 同上 |
| DB-2 ロット管理 | D（荷主切替） | 同上 |
| DB-5 ロケーション | D（階層×機能種別） | 同上 |

---

## 1. 引当方式定義

`owners.allocation_strategy` で荷主ごとに切替。

| strategy | 名称 | 在庫取得ソート順 | 主な適用荷主 |
|----------|------|----------------|-------------|
| `fifo` | 先入先出（**デフォルト・3PL業界標準**） | `expiry_date ASC NULLS LAST, mfg_date ASC NULLS LAST, lot_id ASC NULLS LAST, picking_priority ASC` | 食品・医薬品・日用品 |
| `lifo` | 後入先出 | `mfg_date DESC NULLS LAST, lot_id DESC NULLS LAST, picking_priority ASC` | 鉄鋼・部品等（期限不問） |
| `lpa` | ロケ優先引当 | `picking_priority ASC, expiry_date ASC NULLS LAST, mfg_date ASC NULLS LAST, lot_id ASC` | ABC分析・配置最適化済み倉庫 |
| `custom` | カスタム（将来拡張） | Phase 10 以降。現時点では `fifo` フォールバック | 荷主個別要件 |

### FIFO強制ルール（E-6）

- **ピッキング実行フェーズ**（HT 画面表示・ウェーブ生成）は strategy に関わらず FEFO/FIFO 順を強制する
- `lpa` 策略でもロケ優先でソートした後、**同一ロケ内は必ず `expiry_date ASC NULLS LAST, mfg_date ASC`** で並べる
- 理由：倉庫オペレータが誤って新しいロットを先出しすることを防止（食品衛生法対応）

---

## 2. 荷主切替ロジック

```
引当リクエスト（owner_id, sku_id, qty）
  ↓
SELECT allocation_strategy FROM owners WHERE id = owner_id
  ↓
strategy に応じた ORDER BY を在庫クエリに適用
  ↓
RLS: inventory.owner_id IN (SELECT owner_id FROM user_owners WHERE user_id = auth.uid())
```

- 荷主切替はリアルタイム：strategy 変更後の次の引当から即時反映
- `custom` は未実装 → `fifo` フォールバック（EXCEPTION を避けるため）

---

## 3. 引当フロー詳細

```
Step 1: 出荷指示明細（shipment_order_items）取得
        → owner_id / sku_id / requested_qty / shipment_order_item.id

Step 2: owners.allocation_strategy 取得

Step 3: inventory を strategy でソートして全件取得
        WHERE owner_id = p_owner_id AND sku_id = p_sku_id
          AND status = 'available' AND quantity > 0

Step 4: greedy allocation（requested_qty を満たすまで上から消費）
        各行で:
          alloc_qty = MIN(row.quantity, remaining)
          inventory(available).quantity  -= alloc_qty  [UPDATE]
          inventory(reserved) += alloc_qty              [UPSERT: UPDATE or INSERT]
          allocation_results に INSERT
          remaining -= alloc_qty

Step 5: 充足判定
        remaining == 0 → shipment_order_items.status = 'allocated'
        remaining > 0  → allow_partial=true  → status = 'partial' (backorder)
                       → allow_partial=false → ROLLBACK + EXCEPTION
```

### ロット管理なしSKUの特例（`skus.lot_required = false`）

- `inventory.lot_id = NULL`
- FIFO/LIFO は製造日情報なし → `inventory.created_at` を代替ソートキーに使用
  - FIFO: `inventory.created_at ASC`（最古の在庫行から消費）
  - LIFO: `inventory.created_at DESC`
  - LPA: `picking_priority ASC, inventory.created_at ASC`
- UNIQUE制約注意：lot_id=NULL は PostgreSQL の UNIQUE で複数行可能。`(owner_id, sku_id, NULL, location_id, status)` は重複不可として運用するよう application layer で制御する

---

## 4. テーブル設計

### 4-1. shipment_orders（出荷指示）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | BIGSERIAL | PK | |
| owner_id | BIGINT | NOT NULL FK→owners | 荷主 |
| order_number | TEXT | NOT NULL | 荷主指定注文番号 |
| source_type | TEXT | NOT NULL DEFAULT 'manual' | manual / csv / api / edi |
| status | TEXT | NOT NULL DEFAULT 'draft' | draft / pending / allocated / picking / packed / shipped / cancelled |
| ship_date | DATE | | 出荷予定日 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| UNIQUE | (owner_id, order_number) | | 荷主内で注文番号一意 |

### 4-2. shipment_order_items（出荷指示明細）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | BIGSERIAL | PK | |
| shipment_order_id | BIGINT | NOT NULL FK→shipment_orders | |
| owner_id | BIGINT | NOT NULL FK→owners | |
| sku_id | BIGINT | NOT NULL FK→skus | |
| requested_qty | NUMERIC | NOT NULL CHECK > 0 | 要求数量 |
| allocated_qty | NUMERIC | NOT NULL DEFAULT 0 CHECK >= 0 | 引当済み数量 |
| status | TEXT | NOT NULL DEFAULT 'pending' | pending / partial / allocated / short |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

### 4-3. allocation_results（引当結果）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | BIGSERIAL | PK | |
| shipment_order_item_id | BIGINT | NOT NULL FK→shipment_order_items | |
| owner_id | BIGINT | NOT NULL FK→owners | |
| sku_id | BIGINT | NOT NULL FK→skus | |
| lot_id | BIGINT | FK→lots（NULL可） | ロット管理なし SKU は NULL |
| location_id | BIGINT | NOT NULL FK→locations | |
| allocated_qty | NUMERIC | NOT NULL CHECK > 0 | |
| strategy_used | TEXT | NOT NULL | 実際に適用した strategy |
| allocated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

## 5. SQL関数仕様

### `allocate_inventory(p_shipment_order_item_id, p_allow_partial)`

```
引数:
  p_shipment_order_item_id BIGINT  -- 引当対象の明細 ID
  p_allow_partial BOOLEAN DEFAULT false  -- 部分引当を許可するか

戻り値: TABLE(lot_id BIGINT, location_id BIGINT, allocated_qty NUMERIC)

処理:
  1. shipment_order_items + owners から owner_id / sku_id / requested_qty / strategy 取得
  2. inventory を strategy に応じた ORDER BY で取得（動的 EXECUTE）
  3. greedy allocation: available 減算 + reserved 加算（UPSERT手動）
  4. allocation_results INSERT
  5. shipment_order_items.allocated_qty / status 更新

エラー:
  - 明細 ID 不在 → EXCEPTION
  - 在庫不足 + allow_partial=false → ROLLBACK + EXCEPTION 'insufficient inventory'
```

### `deallocate_inventory(p_shipment_order_item_id)`

```
引数:
  p_shipment_order_item_id BIGINT

処理:
  1. allocation_results から引当レコードを取得
  2. inventory(reserved) 減算（0になれば DELETE）
  3. inventory(available) 加算（UPSERT）
  4. allocation_results DELETE
  5. shipment_order_items.allocated_qty = 0, status = 'pending'

用途: 出荷キャンセル・引当やり直し
```

---

## 6. 正常系テストシナリオ

### シナリオ1: FIFO引当（ロット管理あり・複数ロット）

```
前提データ:
  owner: TKY（allocation_strategy='fifo'）
  sku: 食品A（lot_required=true）
  inventory:
    lot1（mfg=2026-03-01, exp=2026-09-01）@ loc-A1, qty=20, status='available'
    lot2（mfg=2026-04-01, exp=2026-10-01）@ loc-B1, qty=30, status='available'

引当リクエスト: requested_qty=25

期待結果:
  alloc1: lot1 @ loc-A1, qty=20（expiry 早い方を先に消費）
  alloc2: lot2 @ loc-B1, qty=5
  inventory変化:
    lot1 @ loc-A1 available → DELETE（qty=0）
    lot1 @ loc-A1 reserved qty=20 → INSERT
    lot2 @ loc-B1 available qty=30 → 25
    lot2 @ loc-B1 reserved qty=5 → INSERT
  shipment_order_items.status = 'allocated'
```

### シナリオ2: LPA引当（ロケ優先・FIFO強制確認）

```
前提データ:
  owner: OWN2（allocation_strategy='lpa'）
  inventory:
    lot1（exp=2026-12-01）@ loc-A1（picking_priority=10）, qty=30
    lot2（exp=2026-08-01）@ loc-B1（picking_priority=5）,  qty=20

引当リクエスト: requested_qty=15

期待結果:
  alloc1: lot2 @ loc-B1, qty=15（picking_priority=5 が優先）
  ※ 同一ロケ内では FIFO（exp 早い）が優先
```

### シナリオ3: 在庫不足・部分引当

```
前提データ:
  available inventory: qty=8 のみ

引当リクエスト: requested_qty=10, allow_partial=true

期待結果:
  alloc: qty=8
  shipment_order_items.status = 'partial'
  shipment_order_items.allocated_qty = 8
```

---

## 7. 異常系・エラーハンドリング

| ケース | 挙動 |
|--------|------|
| 在庫 0（allow_partial=false） | ROLLBACK + EXCEPTION 'insufficient inventory: needed X, short by Y' |
| 在庫 0（allow_partial=true） | status='short', allocated_qty=0 |
| 引当中に並行 UPDATE で quantity 変化 | FOR UPDATE なし → CONTINUE（next row に移動）|
| shipment_order_item_id 不在 | EXCEPTION 'shipment_order_item X not found' |
| allocation_strategy='custom' | FIFO フォールバック（CASE ELSE 節） |

> ⚠️ 並行引当の排他制御：本 SQL ドラフトは行ロック（SELECT FOR UPDATE）未実装。
> 本番適用前に `SELECT ... FOR UPDATE SKIP LOCKED` によるキューイング方式を検討すること。

---

## 8. 残課題（Phase 9 以降）

| ID | 内容 | 優先度 |
|----|------|--------|
| AL-1 | SELECT FOR UPDATE SKIP LOCKED による排他制御 | high |
| AL-2 | `custom` strategy プラグイン機構（荷主別コールバック） | medium |
| AL-3 | キャンセル時の在庫戻し（deallocate）トランザクション検証 | high |
| AL-4 | 部分引当（partial）のバックオーダー連携フロー | medium |
| AL-5 | ピッキングウェーブ生成（BF-3）との連携インターフェース | medium |

---

*最終更新: 2026-05-16 / Phase 9-BF2 さーちゃん（id=5）*
