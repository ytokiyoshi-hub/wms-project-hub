# Phase 9-QA3: 入荷〜棚入れ E2E 検証シナリオ（wms-impl 実装版）

作成日：2026-05-18  
作成者：にーちゃん（id=7）  
対応タスク：#1004 Phase 9-QA3  
対象実装：wms-impl（SQLite / Express API）  
前バージョン：`specs/e2e_inbound_putaway_qa3.md`（Supabase 本番 DB 向け・#820/#866/#867）

---

## 概要

既存の `e2e_inbound_putaway_qa3.md` は Supabase 本番 DB スキーマ（owners / skus / lots / serials など）を対象にしていたが、  
**wms-impl（SQLite / Express）のプロトタイプ実装** には以下の差異がある。

| 項目 | Supabase 本番スキーマ（旧） | wms-impl 実装（本ドキュメント） |
|------|--------------------------|-------------------------------|
| 入荷予定 | `inbound_plans`（Stage2 未 Deploy） | `inbound_schedules` + `inbound_schedule_lines`（実装済み） |
| 検品結果 | `inspection_results`（Stage2 未 Deploy） | `inbound_schedule_lines.status='inspected'` で管理 |
| 棚入れ指示 | `putaway_orders`（Stage2 未 Deploy） | `POST /api/putaway/:lineId` で直接実行 |
| 差異記録 | `inbound_discrepancies` | `inbound_discrepancies`（実装済み） |
| 在庫テーブル | `inventory`（owner_id / sku_id / location_id） | `inventory`（product_code / location_code / lot_no） |
| 検品時の仮置き | 未実装 | `1AK-99-001`（仮置きエリア）に自動格納 |
| 荷主 | TKY / FDB / PRC | MK001 / MK002 |

本ドキュメントは wms-impl の**実際の API エンドポイントと SQLite クエリ**で検証手順を定義する。

---

## テスト環境

| 項目 | 値 |
|------|-----|
| wms-impl サーバー | `http://localhost:3000` |
| DB ファイル | `wms-impl/wms.db`（SQLite） |
| SQL 実行手段 | `sqlite3 wms.db` コマンド または API 経由 |
| サーバー起動 | `cd wms-impl && npm start` |

---

## マスタデータ（初期シードデータ）

wms-impl の初期シードデータは以下のとおり（`server/schema.js` seedCount=0 時に自動投入）。

### 荷主マスタ

| code | name | 備考 |
|------|------|------|
| MK001 | 株式会社マルキ食品 | 常温・冷蔵品 |
| MK002 | サンプル物流株式会社 | 冷凍品 |

```sql
SELECT code, name, jan_strict_mode, rma_mode, lot_slots FROM owners ORDER BY code;
```

### 商品マスタ

| code | owner_code | name | temperature_zone |
|------|-----------|------|-----------------|
| S-00001 | MK001 | 濃口醤油 1L | 常温 |
| S-00002 | MK001 | 減塩味噌 500g | 冷蔵 |
| S-00003 | MK001 | 本みりん 900ml | 常温 |
| S-00004 | MK001 | 料理酒 1.8L | 常温 |
| S-00005 | MK002 | 冷凍餃子 30個 | 冷凍 |

```sql
SELECT code, owner_code, name, temperature_zone, jan_code FROM products ORDER BY code;
```

### ロケーションマスタ

| code | floor_zone | type_char | 備考 |
|------|-----------|-----------|------|
| 1AK-99-001 | A | K | 仮置きエリア（検品後の一時格納） |
| 1AP-01-101 | A | P | パレットロケ |
| 1AP-01-102 | A | P | パレットロケ |
| 1AT-02-101 | A | T | バラ棚 |
| 1AT-02-102 | A | T | バラ棚 |
| 2BF-01-101 | B | F | 冷蔵流動棚 |

```sql
SELECT code, floor, floor_zone, type_char, aisle, position, note, status FROM locations ORDER BY code;
-- ⚠️ status が 'active' であること（putaway の前提条件）
```

---

## ステータス遷移図

```
入荷予定登録
  POST /api/inbound-schedules
  → inbound_schedules (schedule_no, owner_code, ...)
  → inbound_schedule_lines.status = 'planned'

検品実行
  POST /api/inspect/:lineId  { inspected_qty, lot_no, expiry_date }
  → inbound_schedule_lines.status = 'inspected'
  → inventory (1AK-99-001, qty = inspected_qty)         ← 仮置き加算
  → inventory_transactions (tx_type='inbound_inspect')
  → inspected_qty ≠ expected_qty → inbound_discrepancies (status='pending')

棚入れ実行
  POST /api/putaway/:lineId  { location_code }
  → inbound_schedule_lines.status = 'completed'
  → inventory (1AK-99-001, qty -= inspected_qty)        ← 仮置き減算
  → inventory (location_code, qty += inspected_qty)     ← 実ロケ加算
  → inventory_transactions (tx_type='putaway') × 2件
```

---

## 事前確認：テスト前のクリーン状態チェック

```sql
-- 在庫ゼロ確認
SELECT COUNT(*) AS inv_count FROM inventory;
-- 0 であること（テスト前の前提）

-- 処理中の入荷明細ゼロ確認
SELECT COUNT(*) AS active_lines
FROM inbound_schedule_lines
WHERE status IN ('planned', 'inspected');
-- 0 であること（既存シードが未処理の場合は事前処理 or クリアが必要）

-- 未処理差異ゼロ確認
SELECT COUNT(*) AS pending_disc
FROM inbound_discrepancies WHERE status = 'pending';
-- 0 であること
```

---

## SC-WMS-01: 正常入荷（入荷予定 → 検品 → 棚入れ 完走）

**荷主**：MK001（株式会社マルキ食品）  
**入荷品**：S-00001（濃口醤油 1L）× 10ケース  
**ロット**：なし  
**棚入れ先**：1AP-01-101（パレットロケ）

---

### Step 0: テストデータ投入（入荷予定登録）

**API 呼び出し：**

```bash
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先A",
    "scheduled_date": "2026-05-18",
    "inspection_method": "standard",
    "note": "SC-WMS-01 E2E テスト用",
    "lines": [
      { "product_code": "S-00001", "expected_qty": 10, "putaway_priority": 50 }
    ]
  }'
# → { "ok": true, "id": <schedule_id> }  ← id をメモ
```

**DB 確認 SQL：**

```sql
-- 入荷予定ヘッダー確認
SELECT id, schedule_no, owner_code, supplier_name, scheduled_date, inspection_method
FROM inbound_schedules
WHERE supplier_name = 'テスト仕入先A'
ORDER BY id DESC LIMIT 1;

-- 入荷予定明細確認
SELECT id, schedule_id, product_code, expected_qty, status
FROM inbound_schedule_lines
WHERE schedule_id = (
  SELECT id FROM inbound_schedules WHERE supplier_name = 'テスト仕入先A' ORDER BY id DESC LIMIT 1
);
-- status = 'planned', expected_qty = 10 であること
```

---

### Step 1: 検品待ち一覧の確認

**API 呼び出し：**

```bash
curl -s http://localhost:3000/api/inspect/pending | python3 -m json.tool | head -30
# → status='planned' の明細一覧が返ること
```

**DB 確認 SQL：**

```sql
-- 検品待ち一覧（SC-WMS-01 のみ絞り込み）
SELECT l.id AS line_id, l.product_code, l.expected_qty, l.status,
       s.schedule_no, s.owner_code
FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE l.status = 'planned'
  AND s.supplier_name = 'テスト仕入先A';
-- line_id をメモ（次ステップで使用）
```

**合否：**
- ✅ S-00001 の line が `status='planned'` で表示される

---

### Step 2: 検品実行（正常・数量一致）

`<line_id>` を Step 1 で取得した line_id に置き換えること。

**API 呼び出し：**

```bash
LINE_ID=<line_id>
curl -s -X POST http://localhost:3000/api/inspect/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "inspected_qty": 10,
    "lot_no": "",
    "expiry_date": "",
    "note": "SC-WMS-01 検品 OK"
  }'
# 期待レスポンス:
# { "ok": true, "staging_location": "1AK-99-001", "discrepancy_id": null, "difference": 0 }
# → discrepancy_id が null であること（差異なし）
# → difference が 0 であること
```

**DB 確認 SQL（仮置き在庫の生成）：**

```sql
-- inbound_schedule_lines のステータス更新確認
SELECT id, status, inspected_qty, inspected_at
FROM inbound_schedule_lines WHERE id = <line_id>;
-- status = 'inspected', inspected_qty = 10, inspected_at NOT NULL

-- 仮置き在庫（1AK-99-001）への格納確認
SELECT product_code, location_code, lot_no, qty
FROM inventory
WHERE product_code = 'S-00001' AND location_code = '1AK-99-001';
-- qty = 10 であること

-- inventory_transactions の検品レコード確認
SELECT tx_type, product_code, location_code, qty, ref_type, ref_id, created_at
FROM inventory_transactions
WHERE product_code = 'S-00001' AND tx_type = 'inbound_inspect'
ORDER BY id DESC LIMIT 1;
-- tx_type = 'inbound_inspect', qty = 10, ref_type = 'inbound_line', ref_id = <line_id>

-- 差異レコードが作成されていないことを確認
SELECT COUNT(*) AS disc_count
FROM inbound_discrepancies WHERE line_id = <line_id>;
-- 0 であること
```

**合否：**
- ✅ レスポンス `"discrepancy_id": null`（差異なし）
- ✅ `inbound_schedule_lines.status = 'inspected'`
- ✅ `inventory` に 1AK-99-001 で qty=10 が登録された
- ✅ `inventory_transactions` に `tx_type='inbound_inspect'` が登録された

---

### Step 3: 棚入れ待ち一覧の確認

**API 呼び出し：**

```bash
curl -s http://localhost:3000/api/putaway/pending | python3 -m json.tool | head -20
# → status='inspected' の明細一覧が返ること
```

**DB 確認 SQL：**

```sql
-- 棚入れ待ち確認
SELECT l.id, l.product_code, l.inspected_qty, l.status
FROM inbound_schedule_lines l
WHERE l.status = 'inspected' AND l.id = <line_id>;
-- status = 'inspected' であること
```

---

### Step 4: 棚入れ実行

棚入れ先は `1AP-01-101`（パレットロケ）。事前に `status='active'` であることを確認すること。

```sql
-- 棚入れ先ロケーション確認（事前）
SELECT code, status, note FROM locations WHERE code = '1AP-01-101';
-- status = 'active' であること
```

**API 呼び出し：**

```bash
curl -s -X POST http://localhost:3000/api/putaway/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "1AP-01-101" }'
# 期待レスポンス: { "ok": true }
```

**DB 確認 SQL（棚入れ完了後の在庫確認）：**

```sql
-- inbound_schedule_lines の最終ステータス確認
SELECT id, status, putaway_at, putaway_location
FROM inbound_schedule_lines WHERE id = <line_id>;
-- status = 'completed', putaway_at NOT NULL, putaway_location = '1AP-01-101'

-- 仮置き（1AK-99-001）から在庫が減算されていること
SELECT product_code, location_code, qty
FROM inventory
WHERE product_code = 'S-00001' AND location_code = '1AK-99-001';
-- qty = 0（または行が削除）

-- 実ロケ（1AP-01-101）に在庫が加算されていること
SELECT product_code, location_code, lot_no, qty
FROM inventory
WHERE product_code = 'S-00001' AND location_code = '1AP-01-101';
-- qty = 10 であること

-- inventory_transactions の棚入れレコード確認（2件：仮置き減 + 実ロケ増）
SELECT tx_type, location_code, qty, ref_type, ref_id, created_at
FROM inventory_transactions
WHERE product_code = 'S-00001' AND tx_type = 'putaway'
ORDER BY id DESC LIMIT 2;
-- 1件目: location_code='1AP-01-101', qty=+10
-- 2件目: location_code='1AK-99-001', qty=-10
```

### 合否判定チェックリスト（SC-WMS-01）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 入荷予定登録成功 | API レスポンス + inbound_schedules | ok:true, schedule_no 生成 | □ |
| 2 | 明細 planned 状態 | inbound_schedule_lines.status | 'planned' | □ |
| 3 | 差異なしで検品完了 | API レスポンス difference | 0 | □ |
| 4 | 仮置き在庫加算 | inventory（1AK-99-001） | qty=10 | □ |
| 5 | inbound_inspect TX 生成 | inventory_transactions | tx_type='inbound_inspect', qty=+10 | □ |
| 6 | 棚入れ後 completed | inbound_schedule_lines.status | 'completed' | □ |
| 7 | 仮置き在庫ゼロ | inventory（1AK-99-001） | qty=0 | □ |
| 8 | 実ロケ在庫加算 | inventory（1AP-01-101） | qty=10 | □ |
| 9 | putaway TX 2件生成 | inventory_transactions（putaway × 2） | 仮置き -10 / 実ロケ +10 | □ |

---

## SC-WMS-02: 数量差異（少入荷・shortage）

**荷主**：MK001  
**入荷品**：S-00001 × 10（予定） → 実数 8（shortage -2）  
**差異承認**：`accept_actual`（実数受入）

---

### Step 0: テストデータ投入

```bash
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先B",
    "scheduled_date": "2026-05-18",
    "note": "SC-WMS-02 数量差異テスト",
    "lines": [{ "product_code": "S-00001", "expected_qty": 10 }]
  }'
# → id をメモ → lines の line_id を取得
```

```sql
-- line_id 取得
SELECT l.id FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE s.supplier_name = 'テスト仕入先B' AND l.status = 'planned';
```

---

### Step 1: 検品実行（少入荷 8個）

```bash
LINE_ID=<line_id>
curl -s -X POST http://localhost:3000/api/inspect/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 8, "lot_no": "", "note": "SC-WMS-02 少入荷" }'
# 期待レスポンス:
# { "ok": true, "staging_location": "1AK-99-001", "discrepancy_id": <disc_id>, "difference": -2 }
# → discrepancy_id が NULL でないこと（差異あり）
# → difference = -2（shortage）
```

**DB 確認 SQL：**

```sql
-- 差異レコードの確認
SELECT id, line_id, expected_qty, inspected_qty, difference, reason_category, status
FROM inbound_discrepancies WHERE line_id = <line_id>;
-- difference = -2, reason_category = 'shortage', status = 'pending'

-- 仮置きに 8個（10個ではなく実数）格納されていること
SELECT product_code, location_code, qty
FROM inventory WHERE product_code = 'S-00001' AND location_code = '1AK-99-001';
-- qty = 8
```

**合否：**
- ✅ `discrepancy_id` が非 null で返る
- ✅ `difference = -2`（shortage）
- ✅ `inbound_discrepancies.reason_category = 'shortage'`
- ✅ 仮置き在庫 qty = 8（予定数 10 でなく実数 8）

---

### Step 2: 差異一覧確認

```bash
curl -s "http://localhost:3000/api/discrepancies?status=pending" | python3 -m json.tool
# → 上記で作成した差異レコードが含まれること
```

---

### Step 3: 差異承認（実数受入）

`<disc_id>` を Step 1 で取得した discrepancy_id に置き換えること。

```bash
DISC_ID=<disc_id>
curl -s -X POST http://localhost:3000/api/discrepancies/${DISC_ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "accept_actual",
    "approval_note": "SC-WMS-02 実数受入承認",
    "discrepancy_type": "quantity"
  }'
# 期待レスポンス: { "ok": true }
```

**DB 確認 SQL：**

```sql
-- 差異レコードが承認済みになること
SELECT status, approval_action, discrepancy_type, approved_at
FROM inbound_discrepancies WHERE id = <disc_id>;
-- status = 'approved', approval_action = 'accept_actual', approved_at NOT NULL

-- 明細は inspected のままで棚入れ可能状態を確認
SELECT status, inspected_qty FROM inbound_schedule_lines WHERE id = <line_id>;
-- status = 'inspected', inspected_qty = 8
```

---

### Step 4: 棚入れ実行（8個のみ）

```bash
curl -s -X POST http://localhost:3000/api/putaway/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "1AP-01-101" }'
# 期待レスポンス: { "ok": true }
```

**DB 確認 SQL：**

```sql
-- 実ロケに 8個のみ格納（10個ではないこと）
SELECT product_code, location_code, qty
FROM inventory WHERE product_code = 'S-00001' AND location_code = '1AP-01-101';
-- qty = 8（差異 2個は計上されない）
```

### 合否判定チェックリスト（SC-WMS-02）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 差異検出（shortage） | API レスポンス difference | -2 | □ |
| 2 | 差異レコード生成 | inbound_discrepancies | reason_category='shortage', status='pending' | □ |
| 3 | 仮置き在庫（実数） | inventory（1AK-99-001） | qty=8（10ではない） | □ |
| 4 | 差異承認成功 | inbound_discrepancies.status | 'approved' | □ |
| 5 | 実ロケ在庫（実数） | inventory（1AP-01-101） | qty=8（10ではない） | □ |
| 6 | 差異 2個が在庫計上されない | inventory 合計 | qty=8 のみ | □ |

---

## SC-WMS-03: 数量差異（多入荷・overage）

**荷主**：MK001  
**入荷品**：S-00001 × 10（予定） → 実数 12（overage +2）

---

### Step 0: テストデータ投入 + 検品（12個）

```bash
# 入荷予定登録
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先C",
    "scheduled_date": "2026-05-18",
    "note": "SC-WMS-03 多入荷テスト",
    "lines": [{ "product_code": "S-00001", "expected_qty": 10 }]
  }'
```

```sql
-- line_id 取得
SELECT l.id FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE s.supplier_name = 'テスト仕入先C' AND l.status = 'planned';
```

```bash
# 12個で検品（予定 10個を超過）
curl -s -X POST http://localhost:3000/api/inspect/<line_id> \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 12, "note": "SC-WMS-03 多入荷" }'
# 期待: difference = +2, discrepancy_id NOT NULL, reason_category = 'overage'
```

**DB 確認 SQL：**

```sql
-- overage 差異レコード確認
SELECT difference, reason_category, status
FROM inbound_discrepancies WHERE line_id = <line_id>;
-- difference = 2, reason_category = 'overage', status = 'pending'

-- 仮置きに 12個格納
SELECT qty FROM inventory
WHERE product_code = 'S-00001' AND location_code = '1AK-99-001';
-- qty = 12
```

**合否判定チェックリスト（SC-WMS-03）**

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 過剰差異検出 | API レスポンス difference | +2 | □ |
| 2 | overage レコード生成 | inbound_discrepancies | reason_category='overage', status='pending' | □ |
| 3 | 仮置き在庫（実数 12） | inventory（1AK-99-001） | qty=12 | □ |

---

## SC-WMS-04: 差異承認 re_inspect（再検品 → 在庫ロールバック）

**シナリオ**：SC-WMS-02 の差異を「再検品」として承認 → 仮置き在庫がロールバックされ、明細が planned に戻ること。

このシナリオは **SC-WMS-02 の Step 2 まで実施後**（差異 status='pending' の状態）で実行する。

---

### Step 1: 再検品承認（action='re_inspect'）

```bash
curl -s -X POST http://localhost:3000/api/discrepancies/<disc_id>/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "re_inspect",
    "approval_note": "SC-WMS-04 再検品指示"
  }'
# 期待レスポンス: { "ok": true }
```

**DB 確認 SQL（ロールバック確認）：**

```sql
-- 差異レコードが rejected になること
SELECT status, approval_action FROM inbound_discrepancies WHERE id = <disc_id>;
-- status = 'rejected', approval_action = 're_inspect'

-- inbound_schedule_lines が planned に戻ること
SELECT id, status, inspected_qty, inspected_at
FROM inbound_schedule_lines WHERE id = <line_id>;
-- status = 'planned', inspected_qty = NULL, inspected_at = NULL

-- 仮置き在庫が減算（ロールバック）されていること
SELECT qty FROM inventory
WHERE product_code = 'S-00001' AND location_code = '1AK-99-001';
-- qty = 0（または存在しない）

-- 在庫戻しトランザクションが記録されていること
SELECT tx_type, location_code, qty, ref_type, ref_id
FROM inventory_transactions
WHERE product_code = 'S-00001' AND tx_type = 'adjust' AND qty < 0
ORDER BY id DESC LIMIT 1;
-- tx_type = 'adjust', qty = -8（またはロールバック数量）, ref_type = 'discrepancy'
```

### 合否判定チェックリスト（SC-WMS-04）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 差異が rejected | inbound_discrepancies.status | 'rejected' | □ |
| 2 | 明細が planned に戻る | inbound_schedule_lines.status | 'planned' | □ |
| 3 | inspected_qty クリア | inbound_schedule_lines.inspected_qty | NULL | □ |
| 4 | 仮置き在庫ロールバック | inventory（1AK-99-001） | qty=0 | □ |
| 5 | adjust TX 生成（在庫戻し） | inventory_transactions tx_type='adjust' | qty=-8, ref_type='discrepancy' | □ |

---

## SC-WMS-05: ロット番号・賞味期限付き入荷

**荷主**：MK001  
**入荷品**：S-00002（減塩味噌 500g・冷蔵）× 5ケース  
**ロット番号**：`LOT-MK001-2026-001`  
**賞味期限**：`2026-12-31`  
**棚入れ先**：2BF-01-101（冷蔵流動棚）

---

### Step 0: テストデータ投入

```bash
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先D",
    "scheduled_date": "2026-05-18",
    "note": "SC-WMS-05 ロット番号テスト",
    "lines": [{ "product_code": "S-00002", "expected_qty": 5 }]
  }'
```

```sql
-- line_id 取得
SELECT l.id FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE s.supplier_name = 'テスト仕入先D' AND l.status = 'planned';
```

---

### Step 1: 検品実行（ロット番号・賞味期限付き）

```bash
LINE_ID=<line_id>
curl -s -X POST http://localhost:3000/api/inspect/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "inspected_qty": 5,
    "lot_no": "LOT-MK001-2026-001",
    "expiry_date": "2026-12-31",
    "note": "SC-WMS-05 ロット入荷"
  }'
# 期待: { "ok": true, "discrepancy_id": null, "difference": 0 }
```

**DB 確認 SQL（ロット番号・賞味期限の保存確認）：**

```sql
-- inbound_schedule_lines にロット情報が記録されること
SELECT id, status, inspected_qty, lot_no, expiry_date, inspected_at
FROM inbound_schedule_lines WHERE id = <line_id>;
-- lot_no = 'LOT-MK001-2026-001', expiry_date = '2026-12-31'

-- 仮置き在庫（ロット番号付き）
SELECT product_code, location_code, lot_no, qty, expiry_date
FROM inventory
WHERE product_code = 'S-00002' AND location_code = '1AK-99-001';
-- lot_no = 'LOT-MK001-2026-001', qty = 5, expiry_date = '2026-12-31'
```

---

### Step 2: 棚入れ実行（冷蔵ロケ 2BF-01-101）

```bash
# 冷蔵ロケーション確認
# ⚠️ 2BF-01-101 が active であることを事前確認
curl -s http://localhost:3000/api/putaway/${LINE_ID} \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "2BF-01-101" }'
```

**DB 確認 SQL（ロット込みの在庫確認）：**

```sql
-- 実ロケ（2BF-01-101）にロット番号・賞味期限付きで格納
SELECT product_code, location_code, lot_no, qty, expiry_date
FROM inventory
WHERE product_code = 'S-00002' AND location_code = '2BF-01-101';
-- lot_no = 'LOT-MK001-2026-001', qty = 5, expiry_date = '2026-12-31'

-- 同一 product_code・同一 lot_no でも別ロケは別レコードであること
SELECT product_code, location_code, lot_no, qty
FROM inventory
WHERE product_code = 'S-00002'
ORDER BY location_code;
-- 1AK-99-001: qty=0（仮置きはゼロ）
-- 2BF-01-101: qty=5, lot_no='LOT-MK001-2026-001'
```

### 合否判定チェックリスト（SC-WMS-05）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | ロット番号保存 | inbound_schedule_lines.lot_no | 'LOT-MK001-2026-001' | □ |
| 2 | 賞味期限保存 | inbound_schedule_lines.expiry_date | '2026-12-31' | □ |
| 3 | 仮置き（ロット付き） | inventory（1AK-99-001） | lot_no='LOT-MK001-2026-001', qty=5 | □ |
| 4 | 実ロケ（ロット・賞味期限付き） | inventory（2BF-01-101） | lot_no + expiry_date 正しく保持 | □ |
| 5 | inventory PRIMARY KEY 整合 | (product_code, location_code, lot_no) | 重複なし | □ |

---

## SC-WMS-06: 無効ロケーション指定（棚入れエラー確認）

**目的**：`status='active'` でないロケーション・存在しないロケーションへの棚入れが正しくエラーになること。

---

### Step 0: テストデータ投入 + 検品

```bash
# 入荷予定登録
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先E",
    "scheduled_date": "2026-05-18",
    "note": "SC-WMS-06 エラーテスト",
    "lines": [{ "product_code": "S-00001", "expected_qty": 3 }]
  }'

LINE_ID=<line_id>
curl -s -X POST http://localhost:3000/api/inspect/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 3 }'
```

---

### Step 1: 存在しないロケーションへの棚入れ

```bash
curl -s -X POST http://localhost:3000/api/putaway/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "INVALID-LOC-999" }'
# 期待レスポンス: HTTP 400
# { "error": "ロケ INVALID-LOC-999 は存在しません" }
```

**確認項目：**
- ✅ HTTP 400 が返ること
- ✅ `inbound_schedule_lines.status` が `'inspected'` のまま変わらないこと（ロールバック）
- ✅ `inventory` に INVALID-LOC-999 のレコードが存在しないこと

---

### Step 2: location_code 省略（必須チェック）

```bash
curl -s -X POST http://localhost:3000/api/putaway/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{}'
# 期待レスポンス: HTTP 400
# { "error": "格納先ロケを指定してください" }
```

### 合否判定チェックリスト（SC-WMS-06）

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 無効ロケ → 400エラー | API レスポンス | HTTP 400 + error メッセージ | □ |
| 2 | 明細 status 不変 | inbound_schedule_lines.status | 'inspected'（rollback されていない） | □ |
| 3 | location_code 省略 → 400 | API レスポンス | HTTP 400 | □ |

---

## SC-WMS-07: 破損品の2ライン分割棚入れ（SC-INB-03 対応）

**対応 QA1 シナリオ**：SC-INB-03（破損品発見・良品/不良品の分別棚入れ）  
**wms-impl の制約**：`/api/inspect` に不良品報告フィールドがないため、1スケジュール2ライン（良品ライン + 破損品ライン）に分割する方式を採用する。

---

### Step 0: テストデータ投入（QUARANTINE ロケーション作成 + 2ライン入荷予定）

```bash
# QUARANTINE ロケーション作成（存在しない場合のみ）
curl -s -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -d '{
    "code": "1AK-QUAR-001",
    "floor": "1",
    "floor_zone": "A",
    "type_char": "K",
    "aisle": "00",
    "position": "001",
    "note": "検疫エリア（破損品・不良品の一時格納）"
  }'
# 期待: { "ok": true }
```

```sql
-- QUARANTINE ロケーション存在確認
SELECT code, status, note FROM locations WHERE code = '1AK-QUAR-001';
-- status = 'active' であること
```

```bash
# 1スケジュール・2ライン（良品57 + 破損品3）で入荷予定登録
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先F",
    "scheduled_date": "2026-05-18",
    "inspection_method": "full",
    "note": "SC-WMS-07 破損品分割テスト",
    "lines": [
      { "product_code": "S-00001", "expected_qty": 57, "putaway_priority": 50 },
      { "product_code": "S-00001", "expected_qty": 3,  "putaway_priority": 99 }
    ]
  }'
# → { "id": <schedule_id>, "schedule_no": "..." }
```

```sql
-- 2ライン登録確認（同一 product_code で別 id）
SELECT l.id AS line_id, l.product_code, l.expected_qty, l.status
FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE s.supplier_name = 'テスト仕入先F'
ORDER BY l.id;
-- 2件: expected_qty=57 と expected_qty=3
-- GOOD_LINE_ID と DAMAGE_LINE_ID をメモ
```

---

### Step 1: 良品ライン（57個）を検品 → 通常ロケへ棚入れ

```bash
GOOD_LINE_ID=<57個のline_id>
curl -s -X POST http://localhost:3000/api/inspect/${GOOD_LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 57, "note": "SC-WMS-07 良品57個" }'
# 期待: { "ok": true, "discrepancy_id": null, "difference": 0 }

curl -s -X POST http://localhost:3000/api/putaway/${GOOD_LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "1AP-01-101" }'
# 期待: { "ok": true }
```

---

### Step 2: 破損品ライン（3個）を検品 → QUARANTINE ロケへ棚入れ

```bash
DAMAGE_LINE_ID=<3個のline_id>
curl -s -X POST http://localhost:3000/api/inspect/${DAMAGE_LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 3, "note": "SC-WMS-07 破損品3個" }'
# 期待: { "ok": true, "discrepancy_id": null, "difference": 0 }

curl -s -X POST http://localhost:3000/api/putaway/${DAMAGE_LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "1AK-QUAR-001" }'
# 期待: { "ok": true }
```

---

### Step 3: 在庫分別確認（✅ 分離確認）

```sql
-- 良品・破損品が別ロケーションに分かれていること
SELECT product_code, location_code, qty
FROM inventory
WHERE product_code = 'S-00001'
  AND location_code IN ('1AP-01-101', '1AK-QUAR-001', '1AK-99-001');
-- 1AP-01-101: qty=57（良品）
-- 1AK-QUAR-001: qty=3（破損品）
-- 1AK-99-001: qty=0（仮置きゼロ）

-- 出荷可能在庫確認（QUARANTINE 分を除外）
-- ⚠️ wms-impl は在庫の status フィールドを持たないため、ロケーションコードで識別する
SELECT SUM(qty) AS normal_stock
FROM inventory
WHERE product_code = 'S-00001'
  AND location_code NOT LIKE '%QUAR%'
  AND location_code != '1AK-99-001';
-- → 57（破損品の3個は合計に含まれない）

-- transactions 確認（良品 2件 + 破損品 2件 = 計4件の putaway TX）
SELECT tx_type, location_code, qty
FROM inventory_transactions
WHERE product_code = 'S-00001' AND tx_type = 'putaway'
ORDER BY id DESC LIMIT 4;
```

### 合否判定チェックリスト（SC-WMS-07）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | QUARANTINE ロケーション存在 | locations SELECT | status='active' | □ |
| 2 | 2ライン登録 | inbound_schedule_lines | 57個と3個の2件 | □ |
| 3 | 良品 57個が通常ロケに格納 | inventory（1AP-01-101） | qty=57 | □ |
| 4 | 破損品 3個が QUARANTINE に格納 | inventory（1AK-QUAR-001） | qty=3 | □ |
| 5 | 仮置き在庫がゼロ | inventory（1AK-99-001） | qty=0 | □ |
| 6 | 出荷可能在庫が 57（破損除外） | SUM WHERE NOT QUAR | 57 | □ |

---

## SC-WMS-08: ASN なし入荷（asn_no 省略 / SC-INB-04 対応）

**対応 QA1 シナリオ**：SC-INB-04（事前通知なし入荷・アドホック入荷）  
**wms-impl の実装**：`asn_no` フィールドは省略可（NULL 許容）。`schedule_no` は自動採番される。

---

### Step 0: ASN なしでのスケジュール登録

```bash
# asn_no を省略して登録（NULL になる）
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先G（アドホック）",
    "scheduled_date": "2026-05-18",
    "note": "SC-WMS-08 ASNなし入荷テスト",
    "lines": [
      { "product_code": "S-00003", "expected_qty": 20 }
    ]
  }'
# → { "id": <schedule_id>, "schedule_no": "SC-YYYYMMDD-XX", "rma_no": null }
# asn_no を渡していないため rma_no も null であること
```

**DB 確認 SQL（ASN なし確認）：**

```sql
-- asn_no が NULL で登録されていること
SELECT id, schedule_no, asn_no, supplier_name, owner_code, inspection_method
FROM inbound_schedules
WHERE supplier_name = 'テスト仕入先G（アドホック）'
ORDER BY id DESC LIMIT 1;
-- asn_no = NULL
-- schedule_no は自動採番（例: SC-20260518-XX）
```

---

### Step 1: 通常どおり検品 → 棚入れ

```bash
# line_id 取得
LINE_ID=$(sqlite3 /Users/tokiyoshiyusuke/github/wms-impl/server/db.sqlite \
  "SELECT l.id FROM inbound_schedule_lines l JOIN inbound_schedules s ON l.schedule_id=s.id WHERE s.supplier_name='テスト仕入先G（アドホック）' AND l.status='planned' LIMIT 1;")

curl -s -X POST http://localhost:3000/api/inspect/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 20, "note": "SC-WMS-08 ASNなし入荷 検品OK" }'
# 期待: { "ok": true, "discrepancy_id": null, "difference": 0 }

curl -s -X POST http://localhost:3000/api/putaway/${LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "1AT-02-101" }'
# 期待: { "ok": true }
```

---

### Step 2: 在庫・スケジュール確認

```sql
-- ASN なしでも正常に在庫計上されること
SELECT product_code, location_code, qty
FROM inventory
WHERE product_code = 'S-00003' AND location_code = '1AT-02-101';
-- qty = 20

-- スケジュールの asn_no が NULL のまま完了していること
SELECT s.schedule_no, s.asn_no, l.status, l.putaway_location
FROM inbound_schedules s
JOIN inbound_schedule_lines l ON l.schedule_id = s.id
WHERE s.supplier_name = 'テスト仕入先G（アドホック）';
-- asn_no = NULL, status = 'completed', putaway_location = '1AT-02-101'
```

### 合否判定チェックリスト（SC-WMS-08）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | asn_no なしで登録成功 | API レスポンス | ok:true, schedule_no 生成 | □ |
| 2 | asn_no = NULL で保存 | inbound_schedules.asn_no | NULL | □ |
| 3 | 検品・棚入れ正常完了 | inbound_schedule_lines.status | 'completed' | □ |
| 4 | 在庫計上 OK | inventory（1AT-02-101） | qty=20 | □ |
| 5 | schedule_no は自動採番 | inbound_schedules.schedule_no | 'SC-YYYYMMDD-XX' 形式 | □ |

---

## SC-WMS-09: putaway_priority 確認（SC-INB-05 対応・仕様ギャップ含む）

**対応 QA1 シナリオ**：SC-INB-05（緊急入荷・優先フラグ付き）  
**⚠️ 既知の仕様ギャップ**：`putaway/pending` は `inspected_at` 順でソートされ、`putaway_priority` は未使用（`server/index.js L780`）。  
本シナリオでは `putaway_priority` の保存動作を確認しつつ、緊急入荷の運用ワークアラウンドを示す。

---

### Step 0: 通常スケジュール3件 + 緊急スケジュール1件を登録

```bash
# 通常スケジュール 3件（putaway_priority=50）
for i in 1 2 3; do
  curl -s -X POST http://localhost:3000/api/inbound-schedules \
    -H "Content-Type: application/json" \
    -d "{
      \"owner_code\": \"MK001\",
      \"supplier_name\": \"テスト仕入先H-通常${i}\",
      \"scheduled_date\": \"2026-05-18\",
      \"note\": \"SC-WMS-09 通常スケジュール${i}\",
      \"lines\": [{ \"product_code\": \"S-00004\", \"expected_qty\": 5, \"putaway_priority\": 50 }]
    }"
done

# 緊急スケジュール 1件（putaway_priority=1）
curl -s -X POST http://localhost:3000/api/inbound-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "owner_code": "MK001",
    "supplier_name": "テスト仕入先H-緊急",
    "scheduled_date": "2026-05-18",
    "note": "SC-WMS-09 緊急入荷テスト EMERGENCY",
    "lines": [
      { "product_code": "S-00004", "expected_qty": 5, "putaway_priority": 1 }
    ]
  }'
```

```sql
-- 4件とも登録確認
SELECT l.id AS line_id, l.product_code, l.expected_qty, l.putaway_priority,
       s.supplier_name
FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE s.supplier_name LIKE 'テスト仕入先H%'
ORDER BY l.putaway_priority ASC, l.id ASC;
-- 緊急: putaway_priority=1
-- 通常3件: putaway_priority=50
-- URGENT_LINE_ID をメモ
```

---

### Step 1: 緊急スケジュールを最初に検品（優先ワークアラウンド）

```bash
# ⚠️ wms-impl は putaway_priority でソートしないため、緊急品は「先に検品する」ことで putaway キューの先頭に来る
URGENT_LINE_ID=<緊急スケジュールのline_id>
curl -s -X POST http://localhost:3000/api/inspect/${URGENT_LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "inspected_qty": 5, "note": "SC-WMS-09 緊急入荷 検品OK（優先処理）" }'
```

---

### Step 2: 通常スケジュール 3件を後から検品

```bash
# 通常スケジュール 3件の line_id を取得して検品
for SUPPLIER in "テスト仕入先H-通常1" "テスト仕入先H-通常2" "テスト仕入先H-通常3"; do
  LINE_ID=$(sqlite3 /Users/tokiyoshiyusuke/github/wms-impl/server/db.sqlite \
    "SELECT l.id FROM inbound_schedule_lines l JOIN inbound_schedules s ON l.schedule_id=s.id WHERE s.supplier_name='${SUPPLIER}' AND l.status='planned' LIMIT 1;")
  curl -s -X POST http://localhost:3000/api/inspect/${LINE_ID} \
    -H "Content-Type: application/json" \
    -d "{\"inspected_qty\": 5, \"note\": \"SC-WMS-09 通常検品\"}"
done
```

---

### Step 3: putaway/pending キューで順序確認

```bash
curl -s http://localhost:3000/api/putaway/pending | python3 -m json.tool | grep -E '"id"|"putaway_priority"|"supplier_name"|"inspected_at"'
```

**期待動作の確認：**

```sql
-- inspected_at 順でソートされていること（putaway_priority 順ではない）
SELECT l.id, l.putaway_priority, l.inspected_at, s.supplier_name
FROM inbound_schedule_lines l
JOIN inbound_schedules s ON l.schedule_id = s.id
WHERE l.status = 'inspected' AND s.supplier_name LIKE 'テスト仕入先H%'
ORDER BY l.inspected_at ASC, l.id ASC;
-- 緊急スケジュール（putaway_priority=1）が先に検品済みのため inspected_at が最小値 → キュー先頭に表示
-- → 緊急先処理の意図通りの順序
```

**⚠️ 仕様ギャップの確認：**

```sql
-- putaway_priority=1 が DB に保存されていること
SELECT id, putaway_priority FROM inbound_schedule_lines WHERE id = <URGENT_LINE_ID>;
-- putaway_priority = 1 で保存されている（DB 書き込みは正常）

-- ただし putaway/pending API の ORDER BY は inspected_at のみ（putaway_priority は無視）
-- → 緊急入荷の優先度を保証するには「緊急品を先に検品する」運用フローが必要
```

---

### Step 4: 緊急スケジュールを最初に棚入れ

```bash
curl -s -X POST http://localhost:3000/api/putaway/${URGENT_LINE_ID} \
  -H "Content-Type: application/json" \
  -d '{ "location_code": "1AP-01-102" }'
# 期待: { "ok": true }

# 在庫確認（緊急品が先に棚入れ完了）
```

```sql
SELECT product_code, location_code, qty FROM inventory
WHERE product_code = 'S-00004' AND location_code = '1AP-01-102';
-- qty = 5（緊急品が先に棚入れ完了）
```

### 合否判定チェックリスト（SC-WMS-09）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | putaway_priority=1 が DB に保存 | inbound_schedule_lines | putaway_priority=1 | □ |
| 2 | putaway/pending は inspected_at 順 | API レスポンス順序 + SQL ORDER BY | 先に検品した緊急品が先頭 | □ |
| 3 | ⚠️ putaway_priority ソート未実装を確認 | SQL ORDER BY putaway_priority vs inspected_at | 仕様ギャップの記録 | □ |
| 4 | 緊急品を先に棚入れ完了できる | inbound_schedule_lines.status | 緊急ライン: 'completed' | □ |
| 5 | 在庫計上 OK | inventory（1AP-01-102） | qty=5 | □ |

---

## テストデータクリーンアップ

全シナリオ完了後、以下 SQL で wms-impl SQLite DB のテストデータをクリアする。

```sql
-- 在庫トランザクション削除（テスト荷主分）
DELETE FROM inventory_transactions
WHERE product_code IN ('S-00001', 'S-00002', 'S-00003', 'S-00004', 'S-00005');

-- 在庫削除（テスト荷主分）
DELETE FROM inventory
WHERE product_code IN ('S-00001', 'S-00002', 'S-00003', 'S-00004', 'S-00005');

-- 差異レコード削除
DELETE FROM inbound_discrepancies
WHERE line_id IN (
  SELECT id FROM inbound_schedule_lines
  WHERE schedule_id IN (
    SELECT id FROM inbound_schedules WHERE supplier_name LIKE 'テスト仕入先%'
  )
);

-- 入荷明細削除
DELETE FROM inbound_schedule_lines
WHERE schedule_id IN (
  SELECT id FROM inbound_schedules WHERE supplier_name LIKE 'テスト仕入先%'
);

-- 入荷ヘッダー削除
DELETE FROM inbound_schedules WHERE supplier_name LIKE 'テスト仕入先%';

-- SC-WMS-07 で作成した QUARANTINE ロケーションを削除
DELETE FROM locations WHERE code = '1AK-QUAR-001';

-- クリーン状態確認
SELECT COUNT(*) AS inv_count FROM inventory;
-- → 0

SELECT COUNT(*) AS lines_count FROM inbound_schedule_lines
WHERE schedule_id IN (SELECT id FROM inbound_schedules WHERE supplier_name LIKE 'テスト仕入先%');
-- → 0

SELECT COUNT(*) AS quar_loc FROM locations WHERE code = '1AK-QUAR-001';
-- → 0
```

---

## 実行チェックリスト（全シナリオ）

| # | シナリオ | 検証内容 | LOT | 担当者 | 実施日 | 結果 | 備考 |
|---|---------|---------|-----|-------|-------|------|------|
| 1 | SC-WMS-01 | 正常入荷・完走（SC-INB-01 対応） | 不要 | | | □OK / □NG | |
| 2 | SC-WMS-02 | shortage 差異 → accept_actual（SC-INB-02 対応） | 不要 | | | □OK / □NG | |
| 3 | SC-WMS-03 | overage 差異検出 | 不要 | | | □OK / □NG | |
| 4 | SC-WMS-04 | re_inspect → 在庫ロールバック | 不要 | | | □OK / □NG | SC-WMS-02 の差異を流用 |
| 5 | SC-WMS-05 | ロット・賞味期限付き入荷 | 必要 | | | □OK / □NG | |
| 6 | SC-WMS-06 | 無効ロケ棚入れ → 400エラー | 不要 | | | □OK / □NG | |
| 7 | SC-WMS-07 | 破損品の2ライン分割棚入れ（SC-INB-03 対応） | 不要 | | | □OK / □NG | QUARANTINE ロケ作成が前提 |
| 8 | SC-WMS-08 | ASN なし入荷（SC-INB-04 対応） | 不要 | | | □OK / □NG | asn_no=NULL 確認 |
| 9 | SC-WMS-09 | putaway_priority 確認（SC-INB-05 対応） | 不要 | | | □OK / □NG | 仕様ギャップ含む |

---

## 既知の仕様・注意事項

| 項目 | 内容 | 参照 |
|------|------|------|
| 仮置きエリア | 検品時は必ず `1AK-99-001` に格納される（固定値） | `server/index.js L420` |
| 棚入れ対象 | `status='inspected'` の line のみ棚入れ可能 | `server/index.js L789` |
| 在庫 PRIMARY KEY | `(product_code, location_code, lot_no)` の複合 PK | `server/schema.js L133` |
| lot_no デフォルト | ロット未指定時は空文字列 `''` として扱われる | `server/schema.js L128` |
| 差異自動生成 | `inspected_qty ≠ expected_qty` の場合に自動作成 | `server/index.js L458-465` |
| 再検品ロールバック | `action='re_inspect'` 時に `inspected_qty > 0` の場合のみ在庫戻しが実行される | `server/index.js L499-508` |
| ロケーション有効性 | 棚入れ時に `locations.status='active'` を必ず確認する | `server/index.js L792` |
| putaway_priority ⚠️ | DB には保存されるが `putaway/pending` の ORDER BY には未使用（`inspected_at` 順） | `server/index.js L780` |
| 破損品処理 | ネイティブの不良品報告フィールドなし。2ライン分割（良品+破損品）で対応 | SC-WMS-07 参照 |
| ASN なし入荷 | `asn_no` 省略で NULL 登録・`schedule_no` は自動採番。別途ステータス管理は手動 | SC-WMS-08 参照 |

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| Supabase本番スキーマ向けE2E（旧） | `specs/e2e_inbound_putaway_qa3.md` |
| 入荷実装論点 | `specs/process_04_inbound_implementation.md` |
| 検品機能論点 | `specs/process_05_inspection_implementation.md` |
| ロケーション管理論点 | `specs/process_06_putaway_implementation.md` |
| wms-impl API 実装 | `wms-impl/server/index.js` |
| wms-impl DBスキーマ | `wms-impl/server/schema.js` |

---

*本ドキュメントはにーちゃん（id=7）が Phase 9-QA3（#1004）として作成。wms-impl の SQLite 実装（inbound_schedules / inbound_schedule_lines / inventory / inventory_transactions）に対応した検証手順と curl コマンド・SQL を整備した。*  
*#1005 にて SC-WMS-07〜09（破損品2ライン分割・ASN なし入荷・putaway_priority 確認）を追記し、QA1 シナリオ SC-INB-03〜05 との対応を完結させた。putaway_priority のソート未実装（仕様ギャップ）も本ドキュメントに記録済み。*  
*Supabase 本番環境向けの検証は `e2e_inbound_putaway_qa3.md` を参照すること。*
