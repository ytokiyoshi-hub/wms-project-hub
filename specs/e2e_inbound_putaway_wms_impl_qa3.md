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

-- クリーン状態確認
SELECT COUNT(*) AS inv_count FROM inventory;
-- → 0

SELECT COUNT(*) AS lines_count FROM inbound_schedule_lines
WHERE schedule_id IN (SELECT id FROM inbound_schedules WHERE supplier_name LIKE 'テスト仕入先%');
-- → 0
```

---

## 実行チェックリスト（全シナリオ）

| # | シナリオ | 検証内容 | LOT | 担当者 | 実施日 | 結果 | 備考 |
|---|---------|---------|-----|-------|-------|------|------|
| 1 | SC-WMS-01 | 正常入荷・完走 | 不要 | | | □OK / □NG | |
| 2 | SC-WMS-02 | shortage 差異 → accept_actual | 不要 | | | □OK / □NG | |
| 3 | SC-WMS-03 | overage 差異検出 | 不要 | | | □OK / □NG | |
| 4 | SC-WMS-04 | re_inspect → 在庫ロールバック | 不要 | | | □OK / □NG | SC-WMS-02 の差異を流用 |
| 5 | SC-WMS-05 | ロット・賞味期限付き入荷 | 必要 | | | □OK / □NG | |
| 6 | SC-WMS-06 | 無効ロケ棚入れ → 400エラー | 不要 | | | □OK / □NG | |

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
*Supabase 本番環境向けの検証は `e2e_inbound_putaway_qa3.md` を参照すること。*
