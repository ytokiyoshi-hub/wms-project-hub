# Phase 9-QA3: 入荷〜棚入れ E2E 検証シナリオ詳細化

作成日：2026-05-10  
更新日：2026-05-13（#867 Phase 9-DB5 対応・picking_priority 列追加・PRC PICK ロケ追記）  
作成者：にーちゃん（id=7）  
対応タスク：#820 Phase 9-QA3 / #866 Phase 9-QA3（再実行・DB照合強化版）/ #867 Phase 9-DB5 対応  
ベース：docs/wms-test-scenarios.md（Phase 9-QA1 SC-INB-01〜05）

---

## 概要

Phase 9-QA1 で作成した SC-INB-01〜SC-INB-05（入荷〜棚入れ）に対し、  
**テストデータ投入 SQL・各ステップの DB 確認 SQL・操作手順詳細** を追記し、  
staging 環境で手順書として実際に動かせる形式に整備する。

#866 更新（2026-05-11）：Supabase MCP で実 DB を照合し、以下を確認・追記した。
- FDB SKU は `lot_required=true` → SC-INB-02/03 に LOT 登録ステップを追加
- PRC SKU は `lot_required=true かつ serial_required=true` → SC-INB-04 に LOT+SERIAL 登録ステップを追加
- 全荷主の実ロケーションコード・容量（capacity）を実データから確認・反映

#867 更新（2026-05-13）：Phase 9-DB5 による locations テーブル変更に対応
- `picking_priority` 列の追加を全ロケーション確認 SQL に反映
- PRC に `location_type='picking'` の新ロケーション（PRC-PICK-*）が追加 → ロケーション一覧更新
- 空きロケーション候補 SQL の ORDER BY を `picking_priority ASC` に更新（棚入れ優先度が正確に反映される）

---

## ⚠️ スキーマ対応状況（2026-05-11 時点）

| テーブル | 状態 | 用途 |
|---------|------|------|
| `owners` | ✅ Deploy済み | 荷主マスタ・検品/棚入れ/差異処理方式フラグ |
| `skus` | ✅ Deploy済み | 商品マスタ・lot/serial 要否 |
| `locations` | ✅ Deploy済み（Phase 9-DB5 で `picking_priority` 列追加・PICK ロケ種別追加） | ロケーション管理 |
| `lots` | ✅ Deploy済み | ロット管理（lot_number, mfg_date, expiry_date） |
| `serials` | ✅ Deploy済み | シリアル管理（serial_number, current_inventory_id） |
| `inventory` | ✅ Deploy済み | 在庫（棚入れ完了後の最終確認対象） |
| `work_orders` | ✅ Deploy済み | 作業指示（現フェーズでは ASN 代替として使用） |
| `inbound_plans` | 📋 Phase 9 Stage2 | 入荷予定（ASN 登録先） |
| `inbound_movements` | 📋 Phase 9 Stage2 | 入荷登録 |
| `inspection_results` | 📋 Phase 9 Stage2 | 検品結果 |
| `inbound_discrepancies` | 📋 Phase 9 Stage2 | 差異記録 |
| `putaway_orders` | 📋 Phase 9 Stage2 | 棚入れ指示 |

**現在実行可能な検証**：テストデータ投入・在庫加算（inventory）・LOT/SERIAL 登録・ロケーション消費量の確認  
**Stage2 Deploy 後に追加実行**：入荷〜検品〜棚入れ指示の中間ステップ SQL 確認

---

## テスト環境

| 項目 | 値 |
|------|-----|
| Supabase Project ID | wqjsemttubzbpauvgyai |
| Supabase URL | https://wqjsemttubzbpauvgyai.supabase.co |
| Staging URL | https://shacho-shitsu-git-develop-ytokiyoshi-2875s-projects.vercel.app |
| SQL 実行手段 | Supabase Table Editor / Dashboard SQL Editor |

---

## 事前確認：現在の DB 実データ

シナリオ実施前に以下 SQL を実行し、テスト基盤データの状態を確認する。

### 荷主マスタ確認

```sql
SELECT id, code, name, inspection_strategy, putaway_strategy, discrepancy_strategy
FROM owners ORDER BY id;
```

**実 DB 確認済み（2026-05-11）：**

| id | code | name | inspection_strategy | putaway_strategy | discrepancy_strategy |
|----|------|------|--------------------|-----------------|--------------------|
| 1 | TKY | 東京通販株式会社 | sampling（抜き取り） | free（フリーロケ） | hold（保留） |
| 2 | FDB | 富士食品工業株式会社 | full（全数） | abc（ABC分析） | hold（保留） |
| 3 | PRC | 精和プレシジョン株式会社 | full（全数） | fixed（固定ロケ） | post（事後加算） |

### SKU マスタ確認（TKY）

```sql
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 1 ORDER BY id LIMIT 5;
```

**実 DB 確認済み（TKY は lot_required=false）：**

| id | sku_code | jan | name | lot_required | serial_required |
|----|---------|-----|------|-------------|----------------|
| 1 | TKY-001 | 4901234000001 | Tシャツ（白・M） | false | false |
| 2 | TKY-002 | 4901234000002 | Tシャツ（白・L） | false | false |

### SKU マスタ確認（FDB）

```sql
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 2 ORDER BY id LIMIT 5;
```

**実 DB 確認済み（FDB は lot_required=true・賞味期限管理が必要）：**

| id | sku_code | jan | name | lot_required | serial_required |
|----|---------|-----|------|-------------|----------------|
| 11 | FDB-001 | 4902234000001 | みかんジュース 200ml | **true** | false |
| 12 | FDB-002 | 4902234000002 | みかんジュース 500ml | **true** | false |
| 13 | FDB-003 | 4902234000003 | りんごジュース 200ml | **true** | false |

⚠️ **FDB の全 SKU は `lot_required=true`**：入荷・検品・棚入れの各ステップでロット番号・製造日・賞味期限の入力が必要。

### SKU マスタ確認（PRC）

```sql
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 3 ORDER BY id;
```

**実 DB 確認済み（PRC は lot+serial 両方必須）：**

| id | sku_code | jan | name | lot_required | serial_required |
|----|---------|-----|------|-------------|----------------|
| 19 | PRC-001 | 4903234000001 | センサーユニットAX-10 | **true** | **true** |
| 20 | PRC-002 | 4903234000002 | センサーユニットAX-20 | **true** | **true** |

⚠️ **PRC の全 SKU は `lot_required=true` かつ `serial_required=true`**：1個ずつシリアル番号を登録する必要あり。

### ロケーション確認（TKY）

```sql
SELECT id, code, area, abc_class, picking_priority, capacity, current_volume, status
FROM locations WHERE owner_id = 1 ORDER BY picking_priority, code LIMIT 10;
```

**実 DB 確認済み（2026-05-13 / Phase 9-DB5 後）：**

| code | area | abc_class | picking_priority | capacity | current_volume | status |
|------|------|-----------|-----------------|---------|---------------|--------|
| TKY-A-01-01-1 | A | A | 10 | 200 | 0 | active |
| TKY-A-01-01-2 | A | A | 10 | 200 | 0 | active |
| TKY-A-01-01-3 | A | A | 10 | 200 | 0 | active |
| TKY-A-02-01-1 | A | B | 30 | 200 | 0 | active |
| TKY-B-01-01-1 | B | B | 40 | 200 | 0 | active |
| TKY-B-02-01-1 | B | C | 60 | 200 | 0 | active |

### ロケーション確認（FDB）

```sql
SELECT id, code, area, abc_class, picking_priority, capacity, current_volume, status
FROM locations WHERE owner_id = 2 ORDER BY picking_priority, code LIMIT 10;
```

**実 DB 確認済み（FDB は COOL/DRY エリア・capacity=150 / Phase 9-DB5 後）：**

| code | area | abc_class | picking_priority | capacity | current_volume | status |
|------|------|-----------|-----------------|---------|---------------|--------|
| FDB-COOL-01-01-1 | COOL | A | 10 | 150 | 0 | active |
| FDB-COOL-01-01-2 | COOL | A | 10 | 150 | 0 | active |
| FDB-COOL-01-02-1 | COOL | A | 10 | 150 | 0 | active |
| FDB-COOL-02-01-1 | COOL | B | 30 | 150 | 0 | active |
| FDB-DRY-01-01-1 | DRY | B | 30 | 150 | 0 | active |
| FDB-DRY-02-01-1 | DRY | C | 60 | 150 | 0 | active |

### ロケーション確認（PRC）

```sql
SELECT id, code, area, abc_class, picking_priority, location_type, capacity, current_volume, status
FROM locations WHERE owner_id = 3 ORDER BY picking_priority, code;
```

**実 DB 確認済み（PRC は PART/PICK エリア・capacity=100・固定ロケ / Phase 9-DB5 後）：**

| code | area | abc_class | picking_priority | location_type | capacity | current_volume | status |
|------|------|-----------|-----------------|--------------|---------|---------------|--------|
| PRC-PICK-01-01-1 | PICK | A | **5** | **picking** | 100 | 0 | active |
| PRC-PICK-01-01-2 | PICK | A | **5** | **picking** | 100 | 0 | active |
| PRC-PART-01-01-1 | PART | A | 10 | storage | 100 | 0 | active |
| PRC-PART-01-01-2 | PART | A | 10 | storage | 100 | 0 | active |
| PRC-PART-01-02-1 | PART | A | 10 | storage | 100 | 0 | active |
| PRC-PART-01-02-2 | PART | A | 10 | storage | 100 | 0 | active |
| PRC-PICK-02-01-1 | PICK | B | 20 | picking | 100 | 0 | active |
| PRC-PICK-02-01-2 | PICK | B | 20 | picking | 100 | 0 | active |
| PRC-PART-02-01-1 | PART | B | 30 | storage | 100 | 0 | active |

⚠️ **Phase 9-DB5 で PICK ロケーション追加**：`PRC-PICK-*` は `picking_priority=5`（storage の 10 より高優先）のため、棚入れ指示時は PICK ロケが最優先候補として表示される。固定ロケ（fixed）方式の PRC ではシステム提案を手動で上書き可能。

### 在庫ゼロ確認（テスト前のクリーン状態）

```sql
SELECT COUNT(*) AS inv_count FROM inventory;
-- 2026-05-11 確認: 0 件 ✅
```

→ `0` であること。0 でない場合はクリーンアップ後に実施する。

---

## SC-INB-01 詳細：正常入荷（ASN 照合→検品→棚入れ完走）

**荷主**：東京通販株式会社（TKY, id=1）  
**検品方式**：sampling（抜き取り検品）  
**棚入れ方式**：free（フリーロケーション）  
**入荷品**：TKY-001（Tシャツ白M）× 50枚、TKY-002（Tシャツ白L）× 30枚  
**棚入れ先**：TKY-A-01-01-1（capacity=200, current_volume=0）  
**LOT/SERIAL**：不要（TKY は lot_required=false, serial_required=false）

---

### Step 0: テストデータ投入

```sql
-- ASN を work_orders で登録（Stage2 移行後は inbound_plans に置き換え）
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
SELECT id, owner_id, order_type, status, priority, external_ref, notes
FROM work_orders WHERE external_ref = 'ASN-QA3-001';
```

---

### Step 1: ASN 照合（WMS-INB-001）

**操作手順：**

1. staging URL → WMS 入荷フロー画面（`/inbound-flow.html`）にアクセス
2. 荷主「東京通販株式会社（TKY）」を選択
3. ASN 番号「`ASN-QA3-001`」をバーコードスキャンまたは手入力
4. 画面に品目リスト（TKY-001 × 50 / TKY-002 × 30）が表示されることを確認
5. 「入荷開始」ボタンをタップ

**DB 確認 SQL（照合後）：**

```sql
-- ステータスが in_progress に更新されること
SELECT id, status, updated_at
FROM work_orders WHERE external_ref = 'ASN-QA3-001';
-- status = 'in_progress' であること
```

**合否：**
- ✅ 品目リスト（2品目）が正しく表示される
- ✅ `work_orders.status` が `in_progress` に更新される

---

### Step 2: 検品（WMS-INB-002）

**TKY は抜き取り検品（sampling）の確認：**

```sql
SELECT inspection_strategy FROM owners WHERE id = 1;
-- → 'sampling'
```

**操作手順：**

1. WMS-INB-002（検品画面）にて TKY-001 の JAN コード `4901234000001` をスキャン
2. 抜き取り指示（例：50個中 5個スキャン）に従い HT でスキャン実施
3. 5個全数 OK → 「検品完了（抜取 5/50 OK）」を選択して全数受入判定
4. TKY-002 の JAN コード `4901234000002` を同様に抜き取り検品
5. 「全品目検品完了」をタップ

**DB 確認 SQL（Stage2 inspection_results 用・現在は参考）：**

```sql
-- Stage2 Deploy 後に実行
-- SELECT id, work_order_id, sku_id, inspected_qty, ok_qty, ng_qty, inspection_type, result
-- FROM inspection_results WHERE work_order_id = <wo_id_01>;

-- 現在は work_orders ステータスで代替確認
SELECT id, status FROM work_orders WHERE external_ref = 'ASN-QA3-001';
```

**合否：**
- ✅ TKY-001・TKY-002 両方の検品ステータスが「OK」
- ✅ 抜き取り検品で「全数受入判定」が適用される（全量カウント不要）

---

### Step 3: 棚入れ指示・実行（WMS-INB-003）

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
-- TKY-A-01-01-1（abc_class=A, picking_priority=10, capacity=200）が最上位候補として表示される想定
```

**操作手順：**

1. WMS-INB-003 にてシステム提案ロケーション「`TKY-A-01-01-1`」を確認
2. HT でロケーションバーコード `TKY-A-01-01-1` をスキャンして照合
3. TKY-001 を 50枚収納 →「完了」をタップ
4. TKY-002 を 30枚収納 →「完了」をタップ
5. 「棚入れ完了」ボタンをタップ

---

### Step 4: 棚入れ完了 DB 照合（✅ 現在実行可能）

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
-- current_volume = 80 であること（capacity=200 に対して余裕あり）

-- ASN 完了ステータス確認
SELECT id, status, completed_at
FROM work_orders WHERE external_ref = 'ASN-QA3-001';
-- status = 'completed', completed_at NOT NULL であること
```

### 合否判定チェックリスト（SC-INB-01）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | TKY-001 在庫計上 | inventory SELECT | quantity=50, status='available' | □ |
| 2 | TKY-002 在庫計上 | inventory SELECT | quantity=30, status='available' | □ |
| 3 | ロケーション消費量 | locations.current_volume | 80（capacity=200） | □ |
| 4 | ASN 完了 | work_orders.status | 'completed' | □ |
| 5 | 荷主 ID 一致 | inventory.owner_id | 1（TKY） | □ |
| 6 | 棚入れ先が ABC=A ロケ | locations.abc_class | 'A' | □ |

---

## SC-INB-02 詳細：数量差異（実入荷数 ≠ ASN 数量）

**荷主**：富士食品工業株式会社（FDB, id=2）  
**検品方式**：full（全数検品）  
**差異処理方式**：hold（保留 → 荷主確認）  
**入荷品**：FDB-001（みかんジュース 200ml）× 200個予定 → 実入荷 180個（差異 -20個）  
**LOT/SERIAL**：LOT 登録必須（FDB は lot_required=true, serial_required=false）

---

### Step 0: テストデータ投入

```sql
-- FDB-001（みかんジュース 200ml）の SKU 確認
SELECT id, sku_code, jan, name, lot_required
FROM skus WHERE owner_id = 2 AND sku_code = 'FDB-001';
-- id=11, lot_required=true を確認

-- ASN 登録（200個予定）
INSERT INTO work_orders (
    owner_id, order_type, status, priority, external_ref, notes, scheduled_date
)
VALUES (
    2, 'inbound', 'pending', 2,
    'ASN-QA3-002',
    'QA3テスト用 SC-INB-02 差異シナリオ / FDB-001（みかんジュース200ml）×200予定',
    CURRENT_DATE
)
RETURNING id;
-- → 返ってきた id を <wo_id_02> としてメモ
```

---

### Step 1: 差異発生の確認

**FDB の差異処理方式確認：**

```sql
SELECT inspection_strategy, discrepancy_strategy FROM owners WHERE id = 2;
-- inspection_strategy = 'full'（全数検品）
-- discrepancy_strategy = 'hold'（保留して荷主確認）
```

**操作手順：**

1. WMS-INB-001 にて `ASN-QA3-002` をスキャンして入荷開始
2. WMS-INB-002 にて FDB-001 の JAN コード `4902234000001` を全数スキャン（FDB は全数スキャン必須）
3. 実物 180個のスキャン完了時点で「検品完了」をタップ
4. システムが「数量差異：-20個（200予定 → 180実数）」警告を表示することを確認

---

### Step 2: LOT 番号・賞味期限登録（⚠️ FDB は lot_required=true）

**操作手順：**

1. 検品完了後、「ロット情報登録」画面が自動表示されることを確認
2. 以下のロット情報を入力：
   - ロット番号：`LOT-FDB-QA3-002`
   - 製造日：`2026-04-01`
   - 賞味期限：`2027-04-01`
3. 「ロット登録完了」をタップ

**DB 確認 SQL（LOT 登録確認・✅ 現在実行可能）：**

```sql
-- lots テーブルに登録されていること
SELECT id, sku_id, lot_number, mfg_date, expiry_date, created_at
FROM lots
WHERE owner_id = 2 AND lot_number = 'LOT-FDB-QA3-002';
-- lot_number, mfg_date, expiry_date が正しく登録されていること
```

---

### Step 3: 差異処理選択

**画面操作：**

1. 差異警告ダイアログに以下の選択肢が表示されることを確認：
   - ① 短納品として受け付ける（180個のみ在庫計上）
   - ② 後納品待ち（全量保留）
   - ③ 荷主に確認後処理（`hold` 方式のデフォルト）
2. FDB（`discrepancy_strategy = hold`）では「③ 荷主に確認後処理」がデフォルト選択されていることを確認
3. 「① 短納品として受け付ける」を選択して処理を進める

**DB 確認 SQL（Stage2 用参考）：**

```sql
-- Stage2 Deploy 後に実行
-- SELECT work_order_id, planned_qty, actual_qty, discrepancy_qty, discrepancy_type, status
-- FROM inbound_discrepancies WHERE work_order_id = <wo_id_02>;

-- 現在：work_orders ステータス確認
SELECT id, status, notes FROM work_orders WHERE external_ref = 'ASN-QA3-002';
```

---

### Step 4: 棚入れ後の在庫確認（✅ 現在実行可能）

```sql
-- FDB の ABC 分析棚入れ先確認（abc 方式）
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
-- LOT が inventory と対応していること
```

### 合否判定チェックリスト（SC-INB-02）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 差異警告表示 | 画面目視 | 「-20個差異」が表示される | □ |
| 2 | hold 方式でデフォルト選択 | 画面目視 | 「③ 荷主確認」がデフォルト | □ |
| 3 | 在庫（短納品選択時） | inventory SELECT | quantity=180（200ではない） | □ |
| 4 | LOT 登録 | lots SELECT | lot_number='LOT-FDB-QA3-002', expiry_date 正しく登録 | □ |
| 5 | 差異記録 | inbound_discrepancies（Stage2） | discrepancy_qty=20 | □ |
| 6 | ASN ステータス | work_orders.status | 差異あり状態（'discrepancy' 等） | □ |
| 7 | ロケーション消費量 | locations.current_volume | 180（ABC=A の FDB-COOL-01-01-1）| □ |

---

## SC-INB-03 詳細：破損品発見（検品時に不良品を分離）

**荷主**：富士食品工業株式会社（FDB, id=2）  
**入荷品**：FDB-001（みかんジュース 200ml）× 60個 / うち 3個破損  
**分離先**：QUARANTINE（検疫）ロケーション  
**LOT/SERIAL**：LOT 登録必須（FDB は lot_required=true）

---

### Step 0: テストデータ投入

```sql
-- QUARANTINE ロケーション確認（2026-05-11 時点: 未存在のため作成が必要）
SELECT id, code, location_type, current_volume, status
FROM locations WHERE location_type = 'quarantine';
-- 存在しない場合は以下で作成

-- QUARANTINE ロケーション作成（テスト用）
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

-- ASN 登録（60個予定）
INSERT INTO work_orders (
    owner_id, order_type, status, priority, external_ref, notes, scheduled_date
)
VALUES (
    2, 'inbound', 'pending', 2,
    'ASN-QA3-003',
    'QA3テスト用 SC-INB-03 破損品シナリオ / FDB-001（みかんジュース200ml）×60予定（内3個破損）',
    CURRENT_DATE
)
RETURNING id;
```

---

### Step 1: 検品中の不良品報告

**操作手順：**

1. WMS-INB-001 にて `ASN-QA3-003` をスキャンして入荷開始
2. WMS-INB-002 にて FDB-001 の JAN コード `4902234000001` を全数スキャン（FDB は全数スキャン）
3. 破損品発見時点で「不良品報告」ボタンをタップ
4. 不良理由「外装破損」・数量「3」を入力して登録
5. 残り 57個のスキャンを継続
6. 「検品完了」をタップ（良品 57個 / 不良品 3個の内訳が表示されること）

---

### Step 2: LOT 番号・賞味期限登録（⚠️ FDB は lot_required=true）

**操作手順：**

1. 検品完了後、「ロット情報登録」画面が表示されることを確認
2. 良品（57個）・不良品（3個）で同一ロットとして登録：
   - ロット番号：`LOT-FDB-QA3-003`
   - 製造日：`2026-04-15`
   - 賞味期限：`2027-04-15`
3. 「ロット登録完了」をタップ

**DB 確認 SQL：**

```sql
SELECT id, sku_id, lot_number, mfg_date, expiry_date
FROM lots
WHERE owner_id = 2 AND lot_number = 'LOT-FDB-QA3-003';
```

---

### Step 3: 良品・不良品の分別棚入れ

**操作手順：**

1. WMS-INB-003 にて棚入れ先が 2パターン表示されることを確認：
   - 良品 57個 → 通常ロケーション（`FDB-COOL-01-01-1` / capacity=150）
   - 不良品 3個 → QUARANTINE（`FDB-QUAR-01`）
2. 各々 HT でロケーションをスキャンして棚入れ完了

---

### Step 4: 在庫分別確認（✅ 現在実行可能）

```sql
-- ロケーション種別ごとの在庫内訳確認
SELECT
    l.code          AS location_code,
    l.location_type,
    s.sku_code,
    s.name          AS sku_name,
    i.quantity,
    i.status
FROM inventory i
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 2
ORDER BY l.location_type;
```

**期待結果：**

| location_code | location_type | sku_code | sku_name | quantity | status |
|--------------|--------------|---------|---------|---------|--------|
| FDB-COOL-01-01-1 | storage | FDB-001 | みかんジュース 200ml | 57 | available |
| FDB-QUAR-01 | quarantine | FDB-001 | みかんジュース 200ml | 3 | quarantine |

```sql
-- QUARANTINE 在庫が出荷可能数に含まれないことを確認
SELECT SUM(quantity) AS available_qty
FROM inventory
WHERE owner_id = 2 AND status = 'available';
-- → 57（3個の quarantine 分は含まない）

-- FDB-COOL-01-01-1 の消費量確認（capacity=150 に対して 57個）
SELECT code, current_volume, capacity
FROM locations WHERE code = 'FDB-COOL-01-01-1';
-- current_volume = 57

-- LOT 確認
SELECT lot_number, mfg_date, expiry_date
FROM lots WHERE owner_id = 2 AND lot_number = 'LOT-FDB-QA3-003';
```

### 合否判定チェックリスト（SC-INB-03）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 良品 57個 が通常ロケ | inventory SELECT | quantity=57, status='available', location='FDB-COOL-01-01-1' | □ |
| 2 | 不良品 3個 が QUARANTINE | inventory SELECT | quantity=3, status='quarantine', location='FDB-QUAR-01' | □ |
| 3 | 出荷可能在庫に不良品が含まれない | SUM WHERE status='available' | 57 | □ |
| 4 | QUARANTINE ロケーション存在 | locations SELECT | location_type='quarantine' | □ |
| 5 | LOT 登録 | lots SELECT | lot_number='LOT-FDB-QA3-003', expiry_date 正しく登録 | □ |
| 6 | 不良品報告記録 | inspection_results（Stage2） | ng_qty=3, reason='外装破損' | □ |
| 7 | FDB-COOL-01-01-1 消費量 | locations.current_volume | 57（capacity=150 に対して余裕あり） | □ |

---

## SC-INB-04 詳細：事前通知なし入荷（ASN なし・アドホック入荷）

**荷主**：精和プレシジョン株式会社（PRC, id=3）  
**棚入れ方式**：fixed（固定ロケーション）  
**入荷品**：PRC-001（センサーユニットAX-10）× 30個（突然到着・ASN なし）  
**LOT/SERIAL**：LOT + SERIAL 両方必須（PRC は lot_required=true かつ serial_required=true）

---

### Step 0: PRC ロケーション・SKU 確認

```sql
-- PRC の固定ロケーション一覧（putaway_strategy=fixed / Phase 9-DB5 対応）
SELECT id, code, area, abc_class, picking_priority, location_type, capacity, current_volume, status
FROM locations WHERE owner_id = 3 ORDER BY picking_priority, code;
-- PRC-PICK-01-01-1（picking_priority=5, location_type='picking'）が最優先候補
-- PRC-PART-01-01-1（picking_priority=10, location_type='storage'）が次点

-- PRC-001 の SKU 確認（lot+serial 両方必須）
SELECT id, sku_code, jan, name, lot_required, serial_required
FROM skus WHERE owner_id = 3 AND sku_code = 'PRC-001';
-- id=19, lot_required=true, serial_required=true を確認
```

---

### Step 1: ASN なし入荷モード起動

**操作手順：**

1. WMS-INB-001 にて「ASN なし入荷」ボタンをタップ
2. 荷主「精和プレシジョン（PRC）」を選択
3. PRC-001 の JAN コード `4903234000001` をバーコードスキャンまたは手入力
4. 数量「30」を入力
5. 仮棚入れ先「RECEIVING-HOLD」への棚入れを実施
6. 「事後 ASN 登録依頼」フラグを ON にして完了

---

### Step 2: LOT 番号登録（⚠️ PRC は lot_required=true）

**操作手順：**

1. 入荷登録後、「ロット情報登録」画面が表示されることを確認
2. 以下のロット情報を入力：
   - ロット番号：`LOT-PRC-QA3-004`
   - 製造日：`2026-03-01`
   - 賞味期限（有効期限）：`2028-03-01`
3. 「ロット登録完了」をタップ

**DB 確認 SQL：**

```sql
SELECT id, sku_id, lot_number, mfg_date, expiry_date
FROM lots
WHERE owner_id = 3 AND lot_number = 'LOT-PRC-QA3-004';
-- lot_number, mfg_date, expiry_date が正しく登録されていること
```

---

### Step 3: シリアル番号登録（⚠️ PRC は serial_required=true・1個ずつ）

**操作手順（30個全件のシリアル番号を登録）：**

1. 「シリアル番号登録」画面が表示されることを確認
2. 1個ずつ HT でシリアルバーコードをスキャン（または手入力）
   - 例: `SN-PRC-001-QA3-0001` 〜 `SN-PRC-001-QA3-0030`
3. 30個全件登録完了後、「シリアル登録完了」をタップ

**DB 確認 SQL（✅ 現在実行可能）：**

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
-- status = 'in_stock' または 'on_hold' であること
```

---

### Step 4: 承認待ち状態・出荷ブロック確認（✅ 現在実行可能）

```sql
-- 仮棚入れ在庫（on_hold ステータス）
SELECT
    s.sku_code,
    s.name AS sku_name,
    i.quantity,
    i.status,
    l.code          AS location_code,
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

-- RECEIVING-HOLD ロケーション確認
SELECT id, code, location_type, current_volume
FROM locations
WHERE location_type = 'receiving_hold' OR code LIKE '%HOLD%';

-- work_orders による承認待ち状態確認
SELECT id, status, external_ref, notes
FROM work_orders
WHERE owner_id = 3 AND order_type = 'inbound'
ORDER BY created_at DESC LIMIT 1;
-- status = 'pending_approval' であること
```

### 合否判定チェックリスト（SC-INB-04）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 在庫 on_hold で計上 | inventory.status | 'on_hold' | □ |
| 2 | RECEIVING-HOLD に格納 | locations.location_type | 'receiving_hold' | □ |
| 3 | 出荷可能在庫に含まれない | SUM WHERE status='available' | 0 | □ |
| 4 | LOT 登録 | lots SELECT | lot_number='LOT-PRC-QA3-004', 有効期限 2028-03-01 | □ |
| 5 | SERIAL 登録 30件 | serials COUNT | 30件登録済み、status='on_hold' | □ |
| 6 | ASN なしフラグ記録 | work_orders.notes | 'ASN なし入荷' 等 | □ |
| 7 | 承認待ちステータス | work_orders.status | 'pending_approval' | □ |
| 8 | 承認後に available へ変化 | inventory.status（承認操作後） | 'available' | □ |
| 9 | 承認後 SERIAL status 変化 | serials.status（承認後） | 'in_stock' | □ |

---

## SC-INB-05 詳細：緊急入荷（優先フラグ付き）

**荷主**：東京通販株式会社（TKY, id=1）  
**入荷品**：翌日出荷確定品（緊急フラグ付き ASN）  
**シナリオ**：通常入荷 3件が並んでいる状態で緊急入荷が割り込む  
**LOT/SERIAL**：不要（TKY は lot_required=false, serial_required=false）

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
-- → 返ってきた id をメモ
```

---

### Step 1: 優先度順キュー確認

```sql
-- 入荷キューを優先度順で表示（priority=1 が最上位であること）
SELECT id, external_ref, priority, notes, status
FROM work_orders
WHERE owner_id = 1 AND order_type = 'inbound' AND status = 'pending'
ORDER BY priority ASC, created_at ASC;
```

**期待結果：**

| external_ref | priority | 備考 |
|-------------|---------|------|
| ASN-QA3-URGENT | **1** | 最上位 |
| ASN-QA3-NORM-01 | 3 | 通常 |
| ASN-QA3-NORM-02 | 3 | 通常 |
| ASN-QA3-NORM-03 | 3 | 通常 |

**画面操作：**

1. WMS-INB-001 を開き、入荷キュー一覧で `ASN-QA3-URGENT` が最上位に表示されることを確認
2. 「緊急」バッジ（または赤色ハイライト）が付いていることを確認
3. 通常フローと同じ手順で検品 → 棚入れを実施

---

### Step 2: 棚入れ完了・出荷指示連携確認（✅ 現在実行可能）

```sql
-- 緊急入荷 work_order の完了確認
SELECT id, status, priority, completed_at, updated_at
FROM work_orders WHERE external_ref = 'ASN-QA3-URGENT';
-- status = 'completed', priority = 1, completed_at NOT NULL

-- 在庫計上確認
SELECT
    s.sku_code,
    i.quantity,
    i.status,
    l.code AS location_code
FROM inventory i
JOIN skus      s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = 1;
-- 緊急入荷品が status='available' で計上されていること

-- 通常入荷 3件が pending のまま残っていること
SELECT external_ref, status
FROM work_orders
WHERE external_ref LIKE 'ASN-QA3-NORM%'
ORDER BY external_ref;
-- 全件 status = 'pending'（緊急割り込みで通常が完了していないこと）
```

### 合否判定チェックリスト（SC-INB-05）

| # | 確認項目 | 確認 SQL / 方法 | 期待値 | 判定 |
|---|---------|---------------|-------|------|
| 1 | 緊急 ASN が最上位表示 | work_orders ORDER BY priority | priority=1 が最上位 | □ |
| 2 | 「緊急」バッジ表示 | 画面目視 | バッジ / 赤色ハイライトあり | □ |
| 3 | 在庫計上 OK | inventory SELECT | status='available' | □ |
| 4 | 緊急 ASN 完了 | work_orders.completed_at | NOT NULL | □ |
| 5 | 通常 ASN は pending のまま | work_orders SELECT | 3件とも status='pending' | □ |

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
SELECT COUNT(*) AS inv_count FROM inventory;
-- → 0

SELECT COUNT(*) AS lot_count FROM lots WHERE lot_number LIKE 'LOT-%QA3-%';
-- → 0

SELECT COUNT(*) AS serial_count FROM serials WHERE serial_number LIKE 'SN-PRC-001-QA3-%';
-- → 0

SELECT COUNT(*) AS qa3_count FROM work_orders WHERE external_ref LIKE 'ASN-QA3%';
-- → 0
```

---

## 実行チェックリスト（全シナリオ）

| # | シナリオ | 荷主 | LOT/SERIAL | 担当者 | 実施日 | 結果 | 備考 |
|---|---------|------|-----------|-------|-------|------|------|
| 1 | SC-INB-01 正常入荷（ASN照合→抜取検品→棚入れ） | TKY | 不要 | | | □OK / □NG | |
| 2 | SC-INB-02 数量差異（全数検品・-20個・hold処理） | FDB | LOT必須 | | | □OK / □NG | |
| 3 | SC-INB-03 破損品発見（全数検品・QUARANTINE分離） | FDB | LOT必須 | | | □OK / □NG | |
| 4 | SC-INB-04 ASN なし入荷（固定ロケ・on_hold） | PRC | LOT+SERIAL必須 | | | □OK / □NG | |
| 5 | SC-INB-05 緊急入荷（priority=1 割り込み） | TKY | 不要 | | | □OK / □NG | |

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
| 入荷仕様書（論点） | `specs/process_02_inbound.md` |
| 入荷実装論点 | `specs/process_04_inbound_implementation.md` |
| Phase9 実装計画 | `specs/PHASE9_IMPLEMENTATION_PLAN.md` |

---

*このドキュメントはにーちゃん（id=7）が Phase 9-QA3（#820）として作成し、#866 にて実 DB データ照合・LOT/SERIAL ステップ追記を行った。*  
*#867 にて Phase 9-DB5（locations テーブル完全版・picking_priority 列・PICK ロケ種別）に対応した全 SQL を更新した。*  
*Stage2 テーブル deploy 後に「Stage2 Deploy 後の追加確認 SQL」セクションを必ず実施すること。*
