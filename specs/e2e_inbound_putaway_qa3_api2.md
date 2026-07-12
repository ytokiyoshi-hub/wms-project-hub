# Phase 9-QA3: 入荷〜棚入れ E2E 検証シナリオ詳細化（Phase 9-API2 対応版）

作成日：2026-07-12  
作成者：にーちゃん（id=7）  
対応タスク：#1124 Phase 9-QA3  
対象 API：wms-api-draft.yaml v0.4.0-draft（Phase 9-API2 完了版・#1113）  
前バージョン：`specs/e2e_inbound_putaway_qa3.md`（work_orders 代替版・#820/#866/#867）

---

## 概要

Phase 9-QA1（#359）で定義した業務シナリオ SC-INB-01〜SC-INB-05（入荷〜棚入れ）に対し、  
**Phase 9-API2 で確定した REST API エンドポイント・検品手順・DB 確認 SQL・画面操作** を追記し、  
staging 環境で手順書として実際に動かせる形式に整備する。

### 前バージョンとの差分

| 項目 | 旧版（e2e_inbound_putaway_qa3.md） | 本版（API2 対応版） |
|------|----------------------------------|-------------------|
| 入荷受付 | `work_orders` 直接 INSERT（ASN 代替） | `POST /inbound` または `POST /inbound/receipt` |
| 検品記録 | API なし（Stage2 未 deploy 前提） | `PATCH /inbound/{id}/inspect` |
| 棚入れ指示 | API なし | `POST /putaway-instructions` |
| 棚入れ実行 | API なし | `PUT /putaway-instructions/{id}/execute` |
| DB 確認 | inventory + work_orders のみ | API レスポンス + inventory + 全関連テーブル |

---

## テスト環境

| 項目 | 値 |
|------|-----|
| Supabase Project ID | wqjsemttubzbpauvgyai |
| Supabase URL | https://wqjsemttubzbpauvgyai.supabase.co |
| Staging URL | https://shacho-shitsu-git-develop-ytokiyoshi-2875s-projects.vercel.app |
| WMS API ベース URL | `{STAGING_URL}/api/wms`（または `/api` プレフィックス） |
| SQL 実行手段 | Supabase MCP（`execute_sql`）/ Dashboard SQL Editor |
| 認証ヘッダー | `Authorization: Bearer {SUPABASE_ANON_KEY}` |

```bash
# 環境変数設定（実行前に設定すること）
export WMS_BASE="https://shacho-shitsu-git-develop-ytokiyoshi-2875s-projects.vercel.app/api"
export AUTH="Bearer <supabase_anon_key>"
```

---

## スキーマ対応状況（2026-07-12 時点）

| テーブル | 状態 | 用途 |
|---------|------|------|
| `owners` | ✅ Deploy 済み | 荷主マスタ・検品/棚入れ/差異処理方式フラグ |
| `skus` | ✅ Deploy 済み | 商品マスタ・lot/serial 要否 |
| `locations` | ✅ Deploy 済み（Phase 9-DB5: picking_priority 列・PICK ロケ種別） | ロケーション管理 |
| `lots` | ✅ Deploy 済み | ロット管理（lot_number, mfg_date, expiry_date） |
| `serials` | ✅ Deploy 済み | シリアル管理（serial_number, current_inventory_id） |
| `inventory` | ✅ Deploy 済み | 在庫（棚入れ完了後の最終確認対象） |
| `work_orders` | ✅ Deploy 済み | 作業指示（Phase 9-API2 未実装環境での ASN 代替） |
| `inbound_plans` | 📋 Phase 9 Stage2 | 入荷予定（ASN 登録先・API2 仕様定義済み） |
| `inspection_results` | 📋 Phase 9 Stage2 | 検品結果 |
| `inbound_discrepancies` | 📋 Phase 9 Stage2 | 差異記録 |
| `putaway_orders` | 📋 Phase 9 Stage2 | 棚入れ指示 |

---

## 事前確認：テスト前のクリーン状態チェック

```sql
-- 在庫ゼロ確認（テスト開始前の前提）
SELECT COUNT(*) AS inv_count FROM inventory;
-- → 0 であること

-- 荷主マスタ確認
SELECT id, code, name, inspection_strategy, putaway_strategy, discrepancy_strategy
FROM owners ORDER BY id;

-- SKU マスタ確認（TKY）
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 1 ORDER BY id LIMIT 5;

-- SKU マスタ確認（FDB）
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 2 ORDER BY id LIMIT 5;

-- SKU マスタ確認（PRC）
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 3 ORDER BY id;

-- ロケーション確認（TKY）
SELECT id, code, area, abc_class, picking_priority, capacity, current_volume, status
FROM locations WHERE owner_id = 1 ORDER BY picking_priority, code LIMIT 10;

-- ロケーション確認（FDB）
SELECT id, code, area, abc_class, picking_priority, capacity, current_volume, status
FROM locations WHERE owner_id = 2 ORDER BY picking_priority, code LIMIT 10;

-- ロケーション確認（PRC）
SELECT id, code, area, abc_class, picking_priority, location_type, capacity, current_volume, status
FROM locations WHERE owner_id = 3 ORDER BY picking_priority, code;
```

---

## Phase 9-API2 エンドポイント一覧（入荷〜棚入れ）

| # | メソッド | パス | 説明 | 実装状態 |
|---|---------|------|------|---------|
| 1 | POST | `/inbound` | 入荷受付（簡易・HT 直接登録） | ✅ API2 確定 |
| 2 | POST | `/inbound/receipt` | 入荷受付（正規フロー） | ✅ API2 確定 |
| 3 | GET | `/inbound` | 入荷一覧 | ✅ API2 確定 |
| 4 | GET | `/inbound/{id}` | 入荷詳細取得 | ✅ API2 確定 |
| 5 | PATCH | `/inbound/{id}/inspect` | 検品更新（部分更新） | ✅ API2 確定 |
| 6 | PATCH | `/inbound/{id}/inspect-result` | 検品更新（別エンドポイント） | ✅ API2 確定 |
| 7 | GET | `/inbound/{id}/discrepancies` | 入荷差異一覧 | ✅ API2 確定 |
| 8 | POST | `/inbound/{id}/discrepancies/{id}/approve` | 差異承認 | ✅ API2 確定 |
| 9 | POST | `/putaway-instructions` | 棚入れ指示作成 | ✅ API2 確定 |
| 10 | PUT | `/putaway-instructions/{id}/execute` | 棚入れ実行 | ✅ API2 確定 |

---

## SC-INB-01 詳細：正常入荷（ASN 照合→検品→棚入れ完走）

**荷主**：東京通販株式会社（TKY, id=1）  
**検品方式**：sampling（抜き取り検品）  
**棚入れ方式**：free（フリーロケーション）  
**入荷品**：TKY-001（Tシャツ白M）× 50枚、TKY-002（Tシャツ白L）× 30枚  
**LOT/SERIAL**：不要（TKY は lot_required=false, serial_required=false）

---

### Step 0: テストデータ投入（入荷受付登録）

**API 呼び出し（Phase 9-API2 / POST /inbound）：**

```bash
curl -s -X POST "${WMS_BASE}/inbound" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_id": "WH-001",
    "supplier_ref": "ASN-QA3-001",
    "received_by": "user-qa3",
    "lines": [
      { "sku_id": "TKY-001", "received_qty": 50 },
      { "sku_id": "TKY-002", "received_qty": 30 }
    ]
  }'
# 期待レスポンス:
# {
#   "id": "<inbound_id>",
#   "status": "received",
#   "supplier_ref": "ASN-QA3-001",
#   "created_at": "..."
# }
# → id を <inbound_id_01> としてメモ
```

**API 未実装環境での代替（work_orders 使用）：**

```sql
INSERT INTO work_orders (
    owner_id, order_type, status, priority, external_ref, notes, scheduled_date
)
VALUES (
    1, 'inbound', 'pending', 2,
    'ASN-QA3-001',
    'QA3テスト用 SC-INB-01 / TKY-001×50 TKY-002×30',
    CURRENT_DATE
)
RETURNING id;
-- → 返ってきた id を <wo_id_01> としてメモ
```

**投入確認 SQL：**

```sql
-- API 実装環境
SELECT id, status, supplier_ref, created_at
FROM inbound_plans
WHERE supplier_ref = 'ASN-QA3-001';
-- status = 'received', id が生成されていること

-- work_orders 代替環境
SELECT id, owner_id, order_type, status, priority, external_ref
FROM work_orders WHERE external_ref = 'ASN-QA3-001';
```

---

### Step 1: ASN 照合（WMS-INB-001 画面操作）

**操作手順：**

1. staging URL → WMS 入荷フロー画面（`/inbound-flow.html`）にアクセス
2. 荷主「東京通販株式会社（TKY）」を選択
3. ASN 番号「`ASN-QA3-001`」をバーコードスキャンまたは手入力
4. 画面に品目リスト（TKY-001 × 50 / TKY-002 × 30）が表示されることを確認
5. 「入荷開始」ボタンをタップ

**DB 確認 SQL（ASN 照合後）：**

```sql
-- 入荷ステータスが in_progress に更新されること
SELECT id, status, updated_at
FROM work_orders WHERE external_ref = 'ASN-QA3-001';
-- status = 'in_progress' であること
```

**合否：**
- ✅ 品目リスト（2品目）が正しく表示される
- ✅ `work_orders.status` が `in_progress` に更新される

---

### Step 2: 検品（WMS-INB-002 / PATCH /inbound/{id}/inspect）

**TKY は抜き取り検品（sampling）の確認：**

```sql
SELECT inspection_strategy FROM owners WHERE id = 1;
-- → 'sampling'
```

**API 呼び出し（Phase 9-API2 / PATCH /inbound/{id}/inspect）：**

```bash
INBOUND_ID=<inbound_id_01>
curl -s -X PATCH "${WMS_BASE}/inbound/${INBOUND_ID}/inspect" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "inspector_id": "user-qa3",
    "lines": [
      { "sku_id": "TKY-001", "passed_qty": 50, "failed_qty": 0 },
      { "sku_id": "TKY-002", "passed_qty": 30, "failed_qty": 0 }
    ],
    "completed_by": "user-qa3"
  }'
# 期待レスポンス: HTTP 200
# {
#   "id": "<inbound_id>",
#   "status": "inspected",
#   ...
# }
```

**画面操作手順：**

1. WMS-INB-002（検品画面）にて TKY-001 の JAN コード `4901234000001` をスキャン
2. 抜き取り指示（例：50個中 5個スキャン）に従い HT でスキャン実施
3. 5個全数 OK → 「検品完了（抜取 5/50 OK）」を選択して全数受入判定
4. TKY-002 の JAN コード `4901234000002` を同様に抜き取り検品
5. 「全品目検品完了」をタップ

**DB 確認 SQL：**

```sql
-- inspection_results（Stage2 deploy 後に実行）
-- SELECT id, work_order_id, sku_id, inspected_qty, ok_qty, ng_qty, inspection_type, result
-- FROM inspection_results WHERE work_order_id = <wo_id_01>;

-- 現在は work_orders ステータスで代替確認
SELECT id, status, updated_at FROM work_orders WHERE external_ref = 'ASN-QA3-001';
-- status = 'in_progress' であること（検品中）
```

**合否：**
- ✅ TKY-001・TKY-002 両方の検品ステータスが「OK」
- ✅ PATCH /inbound/{id}/inspect が HTTP 200 を返す
- ✅ 抜き取り検品で「全数受入判定」が適用される

---

### Step 3: 棚入れ指示作成（POST /putaway-instructions）

**TKY はフリーロケーション（free）の確認：**

```sql
SELECT putaway_strategy FROM owners WHERE id = 1;
-- → 'free'

-- 空きロケーション一覧（picking_priority 順・Phase 9-DB5 対応）
SELECT id, code, area, abc_class, picking_priority, capacity, current_volume
FROM locations
WHERE owner_id = 1 AND current_volume = 0 AND status = 'active'
ORDER BY picking_priority ASC, code ASC
LIMIT 5;
-- TKY-A-01-01-1（abc_class=A, picking_priority=10, capacity=200）が最上位候補
```

**API 呼び出し（Phase 9-API2 / POST /putaway-instructions）：**

```bash
INBOUND_ID=<inbound_id_01>
curl -s -X POST "${WMS_BASE}/putaway-instructions" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_id": "'${INBOUND_ID}'",
    "lines": [
      { "sku_id": "TKY-001", "qty": 50, "location_code": "TKY-A-01-01-1" },
      { "sku_id": "TKY-002", "qty": 30, "location_code": "TKY-A-01-01-1" }
    ]
  }'
# 期待レスポンス: HTTP 201
# { "id": "<putaway_instruction_id>", "status": "pending", ... }
# → putaway_instruction_id をメモ
```

**画面操作手順：**

1. WMS-INB-003 にてシステム提案ロケーション「`TKY-A-01-01-1`」を確認
2. HT でロケーションバーコード `TKY-A-01-01-1` をスキャンして照合
3. TKY-001 を 50枚収納予定として入力

---

### Step 4: 棚入れ実行（PUT /putaway-instructions/{id}/execute）

**API 呼び出し（Phase 9-API2 / PUT /putaway-instructions/{id}/execute）：**

```bash
PUTAWAY_ID=<putaway_instruction_id>
curl -s -X PUT "${WMS_BASE}/putaway-instructions/${PUTAWAY_ID}/execute" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "executed_by": "user-qa3",
    "lines": [
      {
        "line_id": "<putaway-line-uuid-001>",
        "actual_location_code": "TKY-A-01-01-1",
        "actual_qty": 50,
        "scanned_at": "2026-07-12T10:00:00+09:00"
      },
      {
        "line_id": "<putaway-line-uuid-002>",
        "actual_location_code": "TKY-A-01-01-1",
        "actual_qty": 30,
        "scanned_at": "2026-07-12T10:05:00+09:00"
      }
    ]
  }'
# 期待レスポンス: HTTP 200
# { "id": "<putaway_instruction_id>", "status": "completed", ... }
```

**画面操作手順（WMS-INB-003）：**

1. TKY-001 を 50枚収納 →「完了」をタップ
2. TKY-002 を 30枚収納 →「完了」をタップ
3. 「棚入れ完了」ボタンをタップ

---

### Step 5: 棚入れ完了 DB 照合（✅ 現在実行可能）

```sql
-- 在庫加算確認（メイン検証クエリ）
SELECT
    o.name  AS owner_name,
    s.sku_code,
    s.name  AS sku_name,
    l.code  AS location_code,
    i.quantity,
    i.status,
    i.created_at
FROM inventory i
JOIN owners    o ON o.id = i.owner_id
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 1
ORDER BY s.sku_code;
```

**期待結果：**

| owner_name | sku_code | sku_name | location_code | quantity | status |
|------------|---------|---------|--------------|---------|--------|
| 東京通販株式会社 | TKY-001 | Tシャツ（白・M） | TKY-A-01-01-1 | 50 | available |
| 東京通販株式会社 | TKY-002 | Tシャツ（白・L） | TKY-A-01-01-1 | 30 | available |

```sql
-- ロケーション消費量更新確認（80 = 50 + 30）
SELECT code, current_volume, capacity
FROM locations WHERE code = 'TKY-A-01-01-1';
-- current_volume = 80（capacity=200 に対して余裕あり）

-- ASN 完了ステータス確認
SELECT id, status, completed_at
FROM work_orders WHERE external_ref = 'ASN-QA3-001';
-- status = 'completed', completed_at NOT NULL

-- 棚入れ指示確認（Stage2 putaway_orders deploy 後）
-- SELECT id, work_order_id, sku_id, location_id, qty, status, completed_at
-- FROM putaway_orders WHERE work_order_id = <wo_id_01>;
```

### 合否判定チェックリスト（SC-INB-01）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | POST /inbound が 201 を返す | API レスポンス | HTTP 201, id 生成 | □ |
| 2 | PATCH /inbound/{id}/inspect が 200 を返す | API レスポンス | HTTP 200, status='inspected' | □ |
| 3 | POST /putaway-instructions が 201 を返す | API レスポンス | HTTP 201, id 生成 | □ |
| 4 | PUT /putaway-instructions/{id}/execute が 200 | API レスポンス | HTTP 200, status='completed' | □ |
| 5 | TKY-001 在庫計上 | inventory SELECT | quantity=50, status='available' | □ |
| 6 | TKY-002 在庫計上 | inventory SELECT | quantity=30, status='available' | □ |
| 7 | ロケーション消費量 | locations.current_volume | 80（capacity=200） | □ |
| 8 | ASN 完了 | work_orders.status | 'completed' | □ |
| 9 | 棚入れ先が ABC=A ロケ | locations.abc_class | 'A' | □ |

---

## SC-INB-02 詳細：数量差異（実入荷数 ≠ ASN 数量）

**荷主**：富士食品工業株式会社（FDB, id=2）  
**検品方式**：full（全数検品）  
**差異処理方式**：hold（保留 → 荷主確認）  
**入荷品**：FDB-001（みかんジュース 200ml）× 200個予定 → 実入荷 180個（差異 -20個）  
**LOT/SERIAL**：LOT 登録必須（FDB は lot_required=true）

---

### Step 0: テストデータ投入

```sql
-- FDB-001 SKU 確認
SELECT id, sku_code, jan, name, lot_required
FROM skus WHERE owner_id = 2 AND sku_code = 'FDB-001';
-- id=11, lot_required=true を確認

-- 差異処理方式確認
SELECT inspection_strategy, discrepancy_strategy FROM owners WHERE id = 2;
-- inspection_strategy = 'full', discrepancy_strategy = 'hold'
```

```bash
# 入荷受付登録（予定 200個）
curl -s -X POST "${WMS_BASE}/inbound" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_id": "WH-001",
    "supplier_ref": "ASN-QA3-002",
    "received_by": "user-qa3",
    "lines": [
      { "sku_id": "FDB-001", "received_qty": 200 }
    ]
  }'
# → id を <inbound_id_02> としてメモ
```

---

### Step 1: 差異発生の検品登録（PATCH /inbound/{id}/inspect）

**操作手順（WMS-INB-002）：**

1. FDB-001 の JAN コード `4902234000001` を全数スキャン（FDB は全数スキャン必須）
2. 実物 180個のスキャン完了時点で「検品完了」をタップ
3. システムが「数量差異：-20個（200予定 → 180実数）」警告を表示することを確認

**API 呼び出し（実数 180個・差異あり）：**

```bash
INBOUND_ID=<inbound_id_02>
curl -s -X PATCH "${WMS_BASE}/inbound/${INBOUND_ID}/inspect" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "inspector_id": "user-qa3",
    "lines": [
      { "sku_id": "FDB-001", "passed_qty": 180, "failed_qty": 0 }
    ],
    "completed_by": "user-qa3"
  }'
# 期待レスポンス: HTTP 200
# status が 'inspected' または 'discrepancy_pending' になること
```

---

### Step 2: LOT 番号・賞味期限登録（⚠️ FDB は lot_required=true）

**操作手順：**

1. 検品完了後、「ロット情報登録」画面が自動表示されることを確認
2. 以下のロット情報を入力：
   - ロット番号：`LOT-FDB-QA3-002`
   - 製造日：`2026-04-01`
   - 賞味期限：`2027-04-01`
3. 「ロット登録完了」をタップ

**DB 確認 SQL（LOT 登録確認）：**

```sql
SELECT id, sku_id, lot_number, mfg_date, expiry_date, created_at
FROM lots
WHERE owner_id = 2 AND lot_number = 'LOT-FDB-QA3-002';
-- lot_number, mfg_date, expiry_date が正しく登録されていること
```

---

### Step 3: 差異確認・承認（GET /inbound/{id}/discrepancies + POST approve）

**API 呼び出し（差異一覧取得）：**

```bash
INBOUND_ID=<inbound_id_02>
curl -s "${WMS_BASE}/inbound/${INBOUND_ID}/discrepancies" \
  -H "Authorization: ${AUTH}" | python3 -m json.tool
# 期待レスポンス:
# [{
#   "id": "<discrepancy_id>",
#   "sku_id": "FDB-001",
#   "expected_qty": 200,
#   "actual_qty": 180,
#   "difference": -20,
#   "status": "pending"
# }]
# → discrepancy_id をメモ
```

**差異承認 API（短納品選択）：**

```bash
DISC_ID=<discrepancy_id>
curl -s -X POST "${WMS_BASE}/inbound/${INBOUND_ID}/discrepancies/${DISC_ID}/approve" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "accept_actual",
    "approval_note": "SC-INB-02 短納品として受入",
    "discrepancy_type": "quantity"
  }'
# 期待レスポンス: HTTP 200, { "ok": true }
```

---

### Step 4: 棚入れ後の在庫確認（✅ 現在実行可能）

```sql
-- FDB の ABC 分析棚入れ先確認
SELECT id, code, area, abc_class, capacity, current_volume
FROM locations
WHERE owner_id = 2 AND current_volume = 0 AND status = 'active'
ORDER BY abc_class ASC, code ASC LIMIT 3;
-- FDB-COOL-01-01-1（abc_class=A, capacity=150）が最上位候補

-- 在庫に 180個のみ計上されていること（200個ではない）
SELECT
    s.sku_code,
    s.name AS sku_name,
    i.quantity,
    i.status,
    l.code AS location_code
FROM inventory i
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 2;
-- quantity = 180 であること（200 ではないことを必ず確認）

-- LOT と在庫の紐付き確認
SELECT lot_number, mfg_date, expiry_date
FROM lots
WHERE owner_id = 2 AND lot_number = 'LOT-FDB-QA3-002';

-- 差異記録確認（Stage2 inbound_discrepancies deploy 後）
-- SELECT work_order_id, planned_qty, actual_qty, discrepancy_qty, discrepancy_type, status
-- FROM inbound_discrepancies WHERE work_order_id = <wo_id_02>;
```

### 合否判定チェックリスト（SC-INB-02）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 差異警告表示 | 画面目視 | 「-20個差異」が表示される | □ |
| 2 | PATCH /inspect が差異を検出 | API レスポンス | status='discrepancy_pending' 等 | □ |
| 3 | GET /discrepancies で差異取得 | API レスポンス | difference=-20, status='pending' | □ |
| 4 | 差異承認 API が 200 を返す | API レスポンス | HTTP 200 | □ |
| 5 | 在庫（短納品選択時） | inventory SELECT | quantity=180（200ではない） | □ |
| 6 | LOT 登録 | lots SELECT | lot_number='LOT-FDB-QA3-002', expiry_date 正しく登録 | □ |
| 7 | ロケーション消費量 | locations.current_volume | 180（ABC=A の FDB-COOL-01-01-1）| □ |

---

## SC-INB-03 詳細：破損品発見（検品時に不良品を分離）

**荷主**：富士食品工業株式会社（FDB, id=2）  
**入荷品**：FDB-001（みかんジュース 200ml）× 60個 / うち 3個破損  
**LOT/SERIAL**：LOT 登録必須（FDB は lot_required=true）

---

### Step 0: テストデータ投入

```sql
-- QUARANTINE ロケーション確認（存在しない場合は作成）
SELECT id, code, location_type FROM locations WHERE location_type = 'quarantine';

-- QUARANTINE ロケーション作成（テスト用・存在しない場合のみ）
INSERT INTO locations (
    owner_id, code, area, aisle, rack, level,
    location_type, capacity, current_volume, status
)
VALUES (
    2, 'FDB-QUAR-01', 'QUARANTINE', '00', '00', '0',
    'quarantine', 999, 0, 'active'
)
ON CONFLICT DO NOTHING
RETURNING id;
```

```bash
# 入荷受付（60個予定）
curl -s -X POST "${WMS_BASE}/inbound" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_id": "WH-001",
    "supplier_ref": "ASN-QA3-003",
    "received_by": "user-qa3",
    "lines": [{ "sku_id": "FDB-001", "received_qty": 60 }]
  }'
```

---

### Step 1: 検品中の不良品報告（PATCH /inbound/{id}/inspect）

**画面操作手順（WMS-INB-002）：**

1. FDB-001 の JAN コード `4902234000001` を全数スキャン
2. 破損品発見時点で「不良品報告」ボタンをタップ
3. 不良理由「外装破損」・数量「3」を入力して登録
4. 残り 57個のスキャンを継続
5. 「検品完了」をタップ（良品 57個 / 不良品 3個の内訳が表示されること）

**API 呼び出し（良品 57 + 不良品 3 を分離検品）：**

```bash
INBOUND_ID=<inbound_id_03>
curl -s -X PATCH "${WMS_BASE}/inbound/${INBOUND_ID}/inspect" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "inspector_id": "user-qa3",
    "lines": [
      {
        "sku_id": "FDB-001",
        "passed_qty": 57,
        "failed_qty": 3,
        "failure_reason": "外装破損"
      }
    ],
    "completed_by": "user-qa3"
  }'
# 期待レスポンス: HTTP 200
# passed_qty=57, failed_qty=3 が記録されること
```

---

### Step 2: LOT 番号登録（⚠️ FDB は lot_required=true）

```sql
-- LOT 登録確認
SELECT id, sku_id, lot_number, mfg_date, expiry_date
FROM lots WHERE owner_id = 2 AND lot_number = 'LOT-FDB-QA3-003';
```

---

### Step 3: 良品・不良品の分別棚入れ

```bash
# 良品ライン（57個）の棚入れ指示
curl -s -X POST "${WMS_BASE}/putaway-instructions" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_id": "'${INBOUND_ID}'",
    "lines": [
      { "sku_id": "FDB-001", "qty": 57, "location_code": "FDB-COOL-01-01-1" }
    ]
  }'

# 不良品ライン（3個）の棚入れ指示（QUARANTINE へ）
curl -s -X POST "${WMS_BASE}/putaway-instructions" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_id": "'${INBOUND_ID}'",
    "lines": [
      { "sku_id": "FDB-001", "qty": 3, "location_code": "FDB-QUAR-01" }
    ]
  }'
```

---

### Step 4: 在庫分別確認（✅ 現在実行可能）

```sql
-- ロケーション種別ごとの在庫内訳確認
SELECT
    l.code          AS location_code,
    l.location_type,
    s.sku_code,
    i.quantity,
    i.status
FROM inventory i
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 2
ORDER BY l.location_type;
```

**期待結果：**

| location_code | location_type | sku_code | quantity | status |
|--------------|--------------|---------|---------|--------|
| FDB-COOL-01-01-1 | storage | FDB-001 | 57 | available |
| FDB-QUAR-01 | quarantine | FDB-001 | 3 | quarantine |

```sql
-- 出荷可能在庫が 57 のみであること
SELECT SUM(quantity) AS available_qty
FROM inventory
WHERE owner_id = 2 AND status = 'available';
-- → 57（quarantine 分は含まない）

-- QUARANTINE ロケーション消費量確認
SELECT code, current_volume FROM locations WHERE code = 'FDB-QUAR-01';
-- current_volume = 3
```

### 合否判定チェックリスト（SC-INB-03）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | PATCH /inspect で passed/failed 分離記録 | API レスポンス | passed_qty=57, failed_qty=3 | □ |
| 2 | 良品 57個が通常ロケ | inventory SELECT | quantity=57, status='available' | □ |
| 3 | 不良品 3個が QUARANTINE | inventory SELECT | quantity=3, status='quarantine' | □ |
| 4 | 出荷可能在庫に不良品が含まれない | SUM WHERE status='available' | 57 | □ |
| 5 | LOT 登録 | lots SELECT | lot_number='LOT-FDB-QA3-003', expiry_date 登録済み | □ |

---

## SC-INB-04 詳細：事前通知なし入荷（ASN なし・アドホック入荷）

**荷主**：精和プレシジョン株式会社（PRC, id=3）  
**棚入れ方式**：fixed（固定ロケーション）  
**入荷品**：PRC-001（センサーユニットAX-10）× 30個（突然到着・ASN なし）  
**LOT/SERIAL**：LOT + SERIAL 両方必須（PRC は lot_required=true, serial_required=true）

---

### Step 0: PRC ロケーション・SKU 確認

```sql
-- PRC の固定ロケーション一覧（Phase 9-DB5 対応）
SELECT id, code, area, abc_class, picking_priority, location_type, capacity, current_volume, status
FROM locations WHERE owner_id = 3 ORDER BY picking_priority, code;
-- PRC-PICK-01-01-1（picking_priority=5, location_type='picking'）が最優先候補

-- PRC-001 SKU 確認（lot+serial 両方必須）
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 3 AND sku_code = 'PRC-001';
-- lot_required=true, serial_required=true を確認
```

---

### Step 1: ASN なし入荷登録（POST /inbound / supplier_ref 省略）

**API 呼び出し（ASN なし）：**

```bash
curl -s -X POST "${WMS_BASE}/inbound" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_id": "WH-001",
    "received_by": "user-qa3",
    "lines": [
      { "sku_id": "PRC-001", "received_qty": 30 }
    ]
  }'
# supplier_ref を省略（ASN なし入荷）
# 期待レスポンス: HTTP 201
# { "id": "<inbound_id_04>", "status": "received", "supplier_ref": null }
```

**画面操作手順：**

1. WMS-INB-001 にて「ASN なし入荷」ボタンをタップ
2. 荷主「精和プレシジョン（PRC）」を選択
3. PRC-001 の JAN コード `4903234000001` をスキャンまたは手入力
4. 数量「30」を入力
5. 仮棚入れ先「RECEIVING-HOLD」への棚入れを実施
6. 「事後 ASN 登録依頼」フラグを ON にして完了

---

### Step 2: LOT 番号登録（⚠️ PRC は lot_required=true）

```sql
-- LOT 登録確認
SELECT id, sku_id, lot_number, mfg_date, expiry_date
FROM lots WHERE owner_id = 3 AND lot_number = 'LOT-PRC-QA3-004';
```

---

### Step 3: シリアル番号登録（⚠️ PRC は serial_required=true・1個ずつ）

**操作手順（30個全件のシリアル番号を登録）：**

1. 「シリアル番号登録」画面が表示されることを確認
2. 1個ずつ HT でシリアルバーコードをスキャン（例: `SN-PRC-001-QA3-0001` 〜 `SN-PRC-001-QA3-0030`）
3. 30個全件登録完了後、「シリアル登録完了」をタップ

**DB 確認 SQL：**

```sql
-- シリアルが 30件登録されていること
SELECT COUNT(*) AS serial_count
FROM serials
WHERE owner_id = 3 AND serial_number LIKE 'SN-PRC-001-QA3-%';
-- → 30 であること

-- 個別シリアルの確認（先頭5件）
SELECT id, serial_number, status, current_inventory_id
FROM serials
WHERE owner_id = 3 AND serial_number LIKE 'SN-PRC-001-QA3-%'
ORDER BY serial_number LIMIT 5;
```

---

### Step 4: 承認待ち状態・出荷ブロック確認（✅ 現在実行可能）

```sql
-- 仮棚入れ在庫（on_hold ステータス）
SELECT
    s.sku_code,
    i.quantity,
    i.status,
    l.code AS location_code,
    l.location_type
FROM inventory i
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 3;
-- status = 'on_hold' であること（'available' ではない）

-- 出荷可能在庫に含まれないことを確認
SELECT SUM(quantity) AS available_qty
FROM inventory
WHERE owner_id = 3 AND status = 'available';
-- → 0 であること（on_hold 分は出荷不可）

-- work_orders 承認待ちステータス確認
SELECT id, status, notes
FROM work_orders
WHERE owner_id = 3 AND order_type = 'inbound'
ORDER BY created_at DESC LIMIT 1;
-- status = 'pending_approval' であること
```

### 合否判定チェックリスト（SC-INB-04）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | POST /inbound（supplier_ref=NULL）が 201 を返す | API レスポンス | HTTP 201, supplier_ref=null | □ |
| 2 | 在庫 on_hold で計上 | inventory.status | 'on_hold' | □ |
| 3 | 出荷可能在庫に含まれない | SUM WHERE status='available' | 0 | □ |
| 4 | LOT 登録 | lots SELECT | lot_number='LOT-PRC-QA3-004', 有効期限 2028-03-01 | □ |
| 5 | SERIAL 登録 30件 | serials COUNT | 30件登録済み | □ |
| 6 | 承認後に available へ変化 | inventory.status（承認後） | 'available' | □ |

---

## SC-INB-05 詳細：緊急入荷（優先フラグ付き）

**荷主**：東京通販株式会社（TKY, id=1）  
**入荷品**：翌日出荷確定品（緊急フラグ付き ASN）  
**シナリオ**：通常入荷 3件が並んでいる状態で緊急入荷が割り込む  
**LOT/SERIAL**：不要（TKY）

---

### Step 0: テストデータ投入（通常 + 緊急）

```sql
-- 通常入荷（低優先）3件を先に登録
INSERT INTO work_orders (owner_id, order_type, status, priority, external_ref, notes, scheduled_date)
VALUES
  (1, 'inbound', 'pending', 3, 'ASN-QA3-NORM-01', 'QA3通常入荷1（優先度低）', CURRENT_DATE),
  (1, 'inbound', 'pending', 3, 'ASN-QA3-NORM-02', 'QA3通常入荷2（優先度低）', CURRENT_DATE),
  (1, 'inbound', 'pending', 3, 'ASN-QA3-NORM-03', 'QA3通常入荷3（優先度低）', CURRENT_DATE);

-- 緊急入荷登録（priority=1 = 最高優先）
INSERT INTO work_orders (owner_id, order_type, status, priority, external_ref, notes, scheduled_date)
VALUES (
    1, 'inbound', 'pending', 1,
    'ASN-QA3-URGENT',
    'QA3緊急入荷 翌日出荷確定品 EMERGENCY',
    CURRENT_DATE
)
RETURNING id;
```

---

### Step 1: 優suas度順キュー確認

```sql
-- 入荷キューを優先度順で表示（priority=1 が最上位であること）
SELECT id, external_ref, priority, status
FROM work_orders
WHERE owner_id = 1 AND order_type = 'inbound' AND status = 'pending'
ORDER BY priority ASC, created_at ASC;
```

**期待結果：**

| external_ref | priority |
|-------------|---------|
| ASN-QA3-URGENT | **1** |
| ASN-QA3-NORM-01 | 3 |
| ASN-QA3-NORM-02 | 3 |
| ASN-QA3-NORM-03 | 3 |

**API 呼び出し（緊急入荷を GET /inbound で確認）：**

```bash
curl -s "${WMS_BASE}/inbound?status=received&limit=10" \
  -H "Authorization: ${AUTH}" | python3 -m json.tool
# 緊急フラグ付きの入荷が一覧の上位に表示されること
```

**画面操作：**

1. WMS-INB-001 を開き、入荷キュー一覧で `ASN-QA3-URGENT` が最上位に表示されることを確認
2. 「緊急」バッジ（または赤色ハイライト）が付いていることを確認
3. 通常フローと同じ手順で検品 → 棚入れを実施

---

### Step 2: 棚入れ完了・出荷指示連携確認（✅ 現在実行可能）

```sql
-- 緊急入荷 work_order の完了確認
SELECT id, status, priority, completed_at
FROM work_orders WHERE external_ref = 'ASN-QA3-URGENT';
-- status = 'completed', priority = 1, completed_at NOT NULL

-- 在庫計上確認
SELECT s.sku_code, i.quantity, i.status, l.code AS location_code
FROM inventory i
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 1;
-- 緊急入荷品が status='available' で計上されていること

-- 通常入荷 3件が pending のまま残っていること
SELECT external_ref, status
FROM work_orders WHERE external_ref LIKE 'ASN-QA3-NORM%'
ORDER BY external_ref;
-- 全件 status = 'pending'
```

### 合否判定チェックリスト（SC-INB-05）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 緊急 ASN が最上位表示 | work_orders ORDER BY priority | priority=1 が最上位 | □ |
| 2 | 「緊急」バッジ表示 | 画面目視 | バッジ / 赤色ハイライトあり | □ |
| 3 | PATCH /inspect が 200 を返す | API レスポンス | HTTP 200 | □ |
| 4 | 在庫計上 OK | inventory SELECT | status='available' | □ |
| 5 | 緊急 ASN 完了 | work_orders.completed_at | NOT NULL | □ |
| 6 | 通常 ASN は pending のまま | work_orders SELECT | 3件とも status='pending' | □ |

---

## API エラーケース確認

### バリデーションエラー確認（全シナリオ共通）

```bash
# 1. supplier_id が存在しない → 422
curl -s -X POST "${WMS_BASE}/inbound/receipt" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "NON_EXISTENT_SUPPLIER",
    "scheduled_date": "2026-07-12",
    "expected_items": [{ "sku": "TKY-001", "quantity": 10 }]
  }'
# 期待: HTTP 422 - 仕入先IDが存在しない

# 2. 必須フィールド欠落 → 400
curl -s -X POST "${WMS_BASE}/inbound" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{}'
# 期待: HTTP 400

# 3. 既に検品完了済みに再検品 → 409
# PATCH /inbound/{id}/inspect を2回実行
# 期待: HTTP 409 - 検品既に確定済み

# 4. 認証なし → 401
curl -s -X GET "${WMS_BASE}/inbound"
# 期待: HTTP 401 Unauthorized

# 5. 存在しない入荷 ID → 404
curl -s "${WMS_BASE}/inbound/non-existent-id" \
  -H "Authorization: ${AUTH}"
# 期待: HTTP 404
```

**エラーケース合否チェックリスト：**

| # | テストケース | 期待 HTTP | 判定 |
|---|------------|---------|------|
| 1 | 存在しない supplier_id | 422 | □ |
| 2 | 必須フィールド欠落 | 400 | □ |
| 3 | 検品完了済みに再検品 | 409 | □ |
| 4 | 認証なし | 401 | □ |
| 5 | 存在しない inbound_id | 404 | □ |

---

## テストデータクリーンアップ

全シナリオ完了後、以下 SQL でテストデータを削除する。

```sql
-- serials クリア（PRC テスト用）
DELETE FROM serials WHERE owner_id = 3 AND serial_number LIKE 'SN-PRC-001-QA3-%';

-- lots クリア（FDB/PRC テスト用）
DELETE FROM lots WHERE lot_number LIKE 'LOT-%QA3-%';

-- inventory クリア（テスト荷主分）
DELETE FROM inventory WHERE owner_id IN (1, 2, 3);

-- work_orders クリア（QA3 テスト用）
DELETE FROM work_orders WHERE external_ref LIKE 'ASN-QA3%';

-- テスト用 QUARANTINE ロケーション削除（SC-INB-03 で作成した場合）
DELETE FROM locations WHERE code = 'FDB-QUAR-01';

-- ロケーション current_volume リセット
UPDATE locations SET current_volume = 0 WHERE owner_id IN (1, 2, 3);

-- クリーン状態確認
SELECT COUNT(*) AS inv_count FROM inventory;                                    -- → 0
SELECT COUNT(*) AS lot_count FROM lots WHERE lot_number LIKE 'LOT-%QA3-%';     -- → 0
SELECT COUNT(*) AS serial_count FROM serials WHERE serial_number LIKE 'SN-PRC-001-QA3-%'; -- → 0
SELECT COUNT(*) AS qa3_count FROM work_orders WHERE external_ref LIKE 'ASN-QA3%'; -- → 0
```

---

## 実行チェックリスト（全シナリオ）

| # | シナリオ | 荷主 | LOT/SERIAL | API2 エンドポイント | 担当者 | 実施日 | 結果 | 備考 |
|---|---------|------|-----------|-------------------|-------|-------|------|------|
| 1 | SC-INB-01 正常入荷（ASN照合→抜取検品→棚入れ） | TKY | 不要 | POST /inbound + PATCH /inspect + POST/PUT /putaway | | | □OK/□NG | |
| 2 | SC-INB-02 数量差異（全数検品・-20個・hold処理） | FDB | LOT必須 | POST /inbound + PATCH /inspect + GET/POST /discrepancies | | | □OK/□NG | |
| 3 | SC-INB-03 破損品発見（全数検品・QUARANTINE分離） | FDB | LOT必須 | PATCH /inspect（passed+failed分離）| | | □OK/□NG | |
| 4 | SC-INB-04 ASN なし入荷（固定ロケ・on_hold） | PRC | LOT+SERIAL必須 | POST /inbound（supplier_ref省略）| | | □OK/□NG | |
| 5 | SC-INB-05 緊急入荷（priority=1 割り込み） | TKY | 不要 | GET /inbound（priority フィルタ）| | | □OK/□NG | |
| 6 | エラーケース全5パターン | — | — | 各エンドポイントのエラーレスポンス | | | □OK/□NG | |

---

## Phase 9 Stage2 Deploy 後の追加確認 SQL

Stage2 テーブルが deploy されたら以下を追加実行する。

```sql
-- 入荷予定（inbound_plans）確認
SELECT id, work_order_id, sku_id, planned_qty, status
FROM inbound_plans WHERE work_order_id = <wo_id>;

-- 検品結果（inspection_results）確認
SELECT id, work_order_id, sku_id, inspected_qty, ok_qty, ng_qty, inspection_type, result
FROM inspection_results WHERE work_order_id = <wo_id>;

-- 差異記録（inbound_discrepancies）確認
SELECT id, work_order_id, discrepancy_type, planned_qty, actual_qty, discrepancy_qty, status
FROM inbound_discrepancies WHERE work_order_id = <wo_id>;

-- 棚入れ指示（putaway_orders）確認
SELECT id, work_order_id, sku_id, location_id, qty, status, completed_at
FROM putaway_orders WHERE work_order_id = <wo_id>;
```

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| QA1 業務シナリオ（元ベース） | `shacho-shitsu/docs/wms-test-scenarios.md` |
| Supabase 本番スキーマ向けQA3（旧） | `specs/e2e_inbound_putaway_qa3.md` |
| wms-impl SQLite 向けQA3 | `specs/e2e_inbound_putaway_wms_impl_qa3.md` |
| WMS API ドラフト YAML（v0.4.0-draft） | `shacho-shitsu/docs/wms-api-draft.yaml` |
| Phase9 実装計画 | `specs/PHASE9_IMPLEMENTATION_PLAN.md` |
| 入荷仕様書 | `specs/process_02_inbound.md` |
| 入荷実装論点 | `specs/process_04_inbound_implementation.md` |
| 棚入れ実装論点 | `specs/process_06_putaway_implementation.md` |

---

*本ドキュメントはにーちゃん（id=7）が Phase 9-QA3（#1124）として作成。Phase 9-API2 完了版（wms-api-draft.yaml v0.4.0-draft）のエンドポイント（POST /inbound・PATCH /inbound/{id}/inspect・POST /putaway-instructions・PUT /putaway-instructions/{id}/execute）を SC-INB-01〜05 全シナリオに組み込み、curl コマンド・SQL 確認クエリを整備した。*  
*API 未実装環境（Stage2 deploy 前）では work_orders テーブルを使用する代替手順も併記。Stage2 deploy 後に「Phase 9 Stage2 Deploy 後の追加確認 SQL」セクションを必ず実施すること。*
