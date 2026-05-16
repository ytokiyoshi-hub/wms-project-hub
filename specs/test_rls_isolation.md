# Phase 9-QA4: 荷主切替 RLS 検証シナリオ（owner_id 分離確認）

作成日：2026-05-10  
作成者：にーちゃん（id=7）  
対応タスク：#832 Phase 9-QA4  
依存：Phase 9-AU1（user_owners テーブル）/ Phase 9-DB4（業務テーブル RLS）

---

## 概要

**目的**：荷主 A のユーザーが荷主 B のデータに絶対にアクセスできないことを、Supabase RLS の仕組みレベルで検証する。

対象テーブル：`owners` / `skus` / `locations` / `lots` / `serials` / `inventory`  
検証軸：
1. **水平分離**：荷主 A ユーザーが荷主 B 行を SELECT/INSERT/UPDATE/DELETE できないこと
2. **ロール別アクセス**：viewer は読み取り専用・shipper は自荷主のみ閲覧
3. **共有ロケーション**：`locations.owner_id = NULL` は全ロールから閲覧可
4. **クロス荷主書き込みブロック**：WITH CHECK が荷主越境 INSERT を拒否すること

---

## テスト環境

| 項目 | 値 |
|------|-----|
| Supabase Project ID | wqjsemttubzbpauvgyai |
| Supabase URL | https://wqjsemttubzbpauvgyai.supabase.co |
| SQL 実行手段 | Supabase Dashboard SQL Editor |
| RLS 実施前提 SQL | `sql/phase9_stage1_auth.sql` / `sql/phase9_stage1_rls.sql` |

### 荷主マスタ（既存データ）

| id | code | name |
|----|------|------|
| 1 | TKY | 東京通販株式会社 |
| 2 | FDB | 富士食品工業株式会社 |
| 3 | PRC | 精和プレシジョン株式会社 |

---

## Step 0: 前提確認（テスト前チェックリスト）

### 0-1. RLS 有効化確認

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('owners', 'skus', 'locations', 'lots', 'serials', 'inventory', 'user_owners')
ORDER BY tablename;
```

**期待値**：全テーブル `rowsecurity = true`  
→ 1つでも `false` があればテスト不可。`phase9_stage1_auth.sql` / `phase9_stage1_rls.sql` を apply してから再確認。

### 0-2. RLS ポリシー一覧確認

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('owners', 'skus', 'locations', 'lots', 'serials', 'inventory')
ORDER BY tablename, policyname;
```

**期待値（各テーブル 2 ポリシー）**：

| tablename | policyname | cmd |
|-----------|-----------|-----|
| inventory | inventory_owner_access | ALL |
| inventory | inventory_shipper_read | SELECT |
| locations | locations_owner_access | ALL |
| locations | locations_shipper_read | SELECT |
| lots | lots_owner_access | ALL |
| lots | lots_shipper_read | SELECT |
| serials | serials_owner_access | ALL |
| serials | serials_shipper_read | SELECT |
| skus | skus_owner_access | ALL |
| skus | skus_shipper_read | SELECT |

### 0-3. ヘルパー関数確認

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_owner_ids', 'handle_new_user');
```

**期待値**：2行返ること

---

## Step 1: テストデータ投入

### 1-1. テストユーザー作成

RLS は `auth.uid()` を参照するため、Supabase Auth でテストユーザーを2名作成する。

**作成方法**：Supabase Dashboard → Authentication → Users → "Add user"

| ユーザー | email | password | 目的 |
|---------|-------|----------|------|
| TKY User | qa-tky@wms-test.local | TestPass123! | 荷主 TKY (id=1) の operator |
| FDB User | qa-fdb@wms-test.local | TestPass123! | 荷主 FDB (id=2) の operator |

作成後、各 UUID を記録する。

```sql
-- 作成後の UUID を確認
SELECT id, email, created_at
FROM auth.users
WHERE email IN ('qa-tky@wms-test.local', 'qa-fdb@wms-test.local')
ORDER BY email;
-- → 返ってきた id を <tky_user_id> / <fdb_user_id> としてメモ
```

### 1-2. user_owners へのアクセス権登録（service_role で実行）

```sql
-- TKY User → TKY 荷主（id=1）operator として登録
INSERT INTO user_owners (user_id, owner_id, role, granted_by)
VALUES (
  '<tky_user_id>',   -- qa-tky@wms-test.local の UUID に置換
  1,                 -- TKY（東京通販株式会社）
  'operator',
  '<tky_user_id>'
)
ON CONFLICT (user_id, owner_id) DO UPDATE SET role = 'operator';

-- FDB User → FDB 荷主（id=2）operator として登録
INSERT INTO user_owners (user_id, owner_id, role, granted_by)
VALUES (
  '<fdb_user_id>',   -- qa-fdb@wms-test.local の UUID に置換
  2,                 -- FDB（富士食品工業株式会社）
  'operator',
  '<fdb_user_id>'
)
ON CONFLICT (user_id, owner_id) DO UPDATE SET role = 'operator';
```

**確認 SQL（service_role）：**

```sql
SELECT u.email, uo.owner_id, o.code, uo.role
FROM user_owners uo
JOIN auth.users   u ON u.id = uo.user_id
JOIN owners       o ON o.id = uo.owner_id
WHERE u.email IN ('qa-tky@wms-test.local', 'qa-fdb@wms-test.local')
ORDER BY u.email;
```

**期待値**：

| email | owner_id | code | role |
|-------|---------|------|------|
| qa-fdb@wms-test.local | 2 | FDB | operator |
| qa-tky@wms-test.local | 1 | TKY | operator |

### 1-3. テスト用 SKU 投入（service_role で実行）

```sql
-- TKY の SKU（既存データを確認してから実行）
INSERT INTO skus (owner_id, sku_code, name, lot_required, serial_required)
VALUES (1, 'RLS-TKY-001', 'RLS検証用TKY商品', false, false)
ON CONFLICT DO NOTHING
RETURNING id, owner_id, sku_code;

-- FDB の SKU
INSERT INTO skus (owner_id, sku_code, name, lot_required, serial_required)
VALUES (2, 'RLS-FDB-001', 'RLS検証用FDB商品', false, false)
ON CONFLICT DO NOTHING
RETURNING id, owner_id, sku_code;
```

**確認 SQL：**

```sql
SELECT id, owner_id, sku_code, name
FROM skus WHERE sku_code IN ('RLS-TKY-001', 'RLS-FDB-001');
-- → 2行返ること。owner_id=1 と owner_id=2 が存在すること
```

### 1-4. 共有ロケーション投入（owner_id = NULL）

```sql
INSERT INTO locations (owner_id, code, area, aisle, rack, level, location_type, capacity, current_volume, status)
VALUES (NULL, 'SHARED-DOCK-01', 'RECEIVING', '00', '00', '0', 'dock', 9999, 0, 'active')
ON CONFLICT DO NOTHING
RETURNING id, owner_id, code;
```

---

## SC-RLS-01: 荷主 A ユーザーが荷主 B の SKU を SELECT できないこと

**テストユーザー**：TKY User（owner_id=1 のみアクセス権あり）  
**期待動作**：FDB の SKU（owner_id=2）が SELECT 結果に含まれないこと

### SQL（TKY User の JWT トークンで実行）

```sql
-- TKY User としてログイン後、SQL Editor で実行
SELECT id, owner_id, sku_code, name
FROM skus
ORDER BY owner_id, sku_code;
```

**期待結果**：

| id | owner_id | sku_code | name |
|----|---------|---------|------|
| （TKY行のみ） | 1 | RLS-TKY-001 | RLS検証用TKY商品 |

- `owner_id = 2` の行が**含まれないこと**
- `RLS-FDB-001` が**見えないこと** ← これが RLS の核心

### 合否判定

| # | 確認項目 | 期待値 | 判定 |
|---|---------|-------|------|
| 1 | TKY User の skus SELECT 結果 | owner_id=1 行のみ | □ |
| 2 | FDB SKU が結果に含まれない | 0行（RLS 拒否） | □ |

---

## SC-RLS-02: 荷主 B ユーザーが荷主 A の SKU を SELECT できないこと

**テストユーザー**：FDB User（owner_id=2 のみアクセス権あり）

### SQL（FDB User の JWT トークンで実行）

```sql
SELECT id, owner_id, sku_code, name
FROM skus
ORDER BY owner_id, sku_code;
```

**期待結果**：

| id | owner_id | sku_code | name |
|----|---------|---------|------|
| （FDB行のみ） | 2 | RLS-FDB-001 | RLS検証用FDB商品 |

- `owner_id = 1` の行が**含まれないこと**
- `RLS-TKY-001` が**見えないこと**

### 合否判定

| # | 確認項目 | 期待値 | 判定 |
|---|---------|-------|------|
| 1 | FDB User の skus SELECT 結果 | owner_id=2 行のみ | □ |
| 2 | TKY SKU が結果に含まれない | 0行（RLS 拒否） | □ |

---

## SC-RLS-03: 荷主 A ユーザーが荷主 B へのクロス INSERT をブロックされること

**テストユーザー**：TKY User  
**期待動作**：owner_id=2（FDB）への INSERT が WITH CHECK でブロックされること

### SQL（TKY User の JWT トークンで実行）

```sql
-- これは失敗するはず（RLS WITH CHECK 違反）
INSERT INTO skus (owner_id, sku_code, name, lot_required, serial_required)
VALUES (2, 'CROSS-ATTACK-001', '不正クロス荷主INSERT', false, false);
```

**期待結果**：

```
ERROR: new row violates row-level security policy for table "skus"
```

- エラーが返ること
- `skus` テーブルに `CROSS-ATTACK-001` が**存在しないこと**を確認する

### 確認 SQL（service_role で実行）

```sql
SELECT id, owner_id, sku_code FROM skus WHERE sku_code = 'CROSS-ATTACK-001';
-- → 0行（INSERT が通っていないこと）
```

### 合否判定

| # | 確認項目 | 期待値 | 判定 |
|---|---------|-------|------|
| 1 | クロス INSERT のエラー | RLS 違反エラー | □ |
| 2 | クロス INSERT 後の DB確認 | 0行（挿入されていない） | □ |

---

## SC-RLS-04: inventory の荷主分離確認

**テストユーザー**：TKY User と FDB User を交互に使用  
**前提**：inventory に TKY・FDB 双方のデータが存在すること

### 4-1. テスト在庫データ投入（service_role で実行）

```sql
-- TKY 在庫
INSERT INTO inventory (owner_id, sku_id, location_id, quantity, status)
SELECT
  1,
  (SELECT id FROM skus WHERE sku_code = 'RLS-TKY-001'),
  (SELECT id FROM locations WHERE code = 'SHARED-DOCK-01'),
  100,
  'available'
ON CONFLICT DO NOTHING
RETURNING id, owner_id, quantity;

-- FDB 在庫
INSERT INTO inventory (owner_id, sku_id, location_id, quantity, status)
SELECT
  2,
  (SELECT id FROM skus WHERE sku_code = 'RLS-FDB-001'),
  (SELECT id FROM locations WHERE code = 'SHARED-DOCK-01'),
  200,
  'available'
ON CONFLICT DO NOTHING
RETURNING id, owner_id, quantity;
```

**投入確認（service_role）：**

```sql
SELECT i.id, i.owner_id, o.code, i.quantity, i.status
FROM inventory i
JOIN owners o ON o.id = i.owner_id
WHERE i.owner_id IN (1, 2)
ORDER BY i.owner_id;
-- → TKY 100個 / FDB 200個 の2行が存在すること
```

### 4-2. TKY User の inventory 確認

```sql
-- TKY User のJWT で実行
SELECT i.id, i.owner_id, i.quantity, i.status
FROM inventory i
ORDER BY i.owner_id;
```

**期待値**：`owner_id=1`（100個）の1行のみ。FDB の 200個行は見えない。

### 4-3. FDB User の inventory 確認

```sql
-- FDB User のJWT で実行
SELECT i.id, i.owner_id, i.quantity, i.status
FROM inventory i
ORDER BY i.owner_id;
```

**期待値**：`owner_id=2`（200個）の1行のみ。TKY の 100個行は見えない。

### 合否判定

| # | 確認項目 | ユーザー | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | TKY User の inventory 件数 | TKY User | 1行（owner_id=1のみ） | □ |
| 2 | TKY User に FDB 在庫が見えない | TKY User | FDB 行 0件 | □ |
| 3 | FDB User の inventory 件数 | FDB User | 1行（owner_id=2のみ） | □ |
| 4 | FDB User に TKY 在庫が見えない | FDB User | TKY 行 0件 | □ |

---

## SC-RLS-05: 共有ロケーション（owner_id = NULL）は全ユーザーから閲覧可

**テストユーザー**：TKY User・FDB User どちらでも同じ結果であること

### SQL（各ユーザーの JWT で実行）

```sql
SELECT id, owner_id, code, location_type
FROM locations
WHERE code = 'SHARED-DOCK-01';
```

**期待結果（両ユーザーとも同じ）**：

| id | owner_id | code | location_type |
|----|---------|------|--------------|
| （id） | NULL | SHARED-DOCK-01 | dock |

- `owner_id = NULL` の共有ロケーションが**両荷主ユーザーから見えること**

### 合否判定

| # | 確認項目 | ユーザー | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 共有ロケーション閲覧（TKY） | TKY User | 1行返る | □ |
| 2 | 共有ロケーション閲覧（FDB） | FDB User | 1行返る | □ |
| 3 | owner_id=NULL 行が見える | 両User | NULL が表示される | □ |

---

## SC-RLS-06: viewer ロールは READ のみ（書き込みブロック）

**テストユーザー**：TKY Viewer（viewer ロールで user_owners に追加）

### 6-1. viewer ユーザー作成

```sql
-- TKY Viewer として user_owners に追加（service_role で実行）
-- 前提：Supabase Auth で qa-tky-viewer@wms-test.local を作成し、UUID を取得
INSERT INTO user_owners (user_id, owner_id, role, granted_by)
VALUES (
  '<tky_viewer_user_id>',  -- viewer ユーザーの UUID
  1,                       -- TKY
  'viewer',
  '<tky_user_id>'
)
ON CONFLICT (user_id, owner_id) DO UPDATE SET role = 'viewer';
```

### 6-2. viewer の SELECT（成功するはず）

```sql
-- TKY Viewer のJWT で実行
SELECT id, owner_id, sku_code FROM skus WHERE owner_id = 1;
```

**期待値**：TKY SKU 行が返る（SELECT は viewer 許可）

### 6-3. viewer の INSERT（ブロックされるはず）

```sql
-- TKY Viewer のJWT で実行
INSERT INTO skus (owner_id, sku_code, name, lot_required, serial_required)
VALUES (1, 'VIEWER-ATTEMPT-001', 'viewer書き込み試行', false, false);
```

**期待値**：

```
ERROR: new row violates row-level security policy for table "skus"
```

### 合否判定

| # | 確認項目 | ユーザー | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | viewer SELECT | TKY Viewer | 自荷主行が返る | □ |
| 2 | viewer INSERT ブロック | TKY Viewer | RLS 違反エラー | □ |
| 3 | INSERT 後の DB 確認 | service_role | 0行（挿入されていない） | □ |

---

## SC-RLS-07: shipper ロールは自荷主 SELECT のみ

**テストユーザー**：TKY Shipper（shipper ロール）

```sql
-- TKY Shipper として user_owners に追加
INSERT INTO user_owners (user_id, owner_id, role, granted_by)
VALUES (
  '<tky_shipper_user_id>',
  1,
  'shipper',
  '<tky_user_id>'
)
ON CONFLICT (user_id, owner_id) DO UPDATE SET role = 'shipper';
```

### shipper の SELECT（自荷主のみ）

```sql
-- TKY Shipper のJWT で実行
SELECT id, owner_id, sku_code FROM skus;
```

**期待値**：owner_id=1 行のみ（shipper_read ポリシー）

### shipper の INSERT（ブロック）

```sql
-- TKY Shipper のJWT で実行
INSERT INTO skus (owner_id, sku_code, name, lot_required, serial_required)
VALUES (1, 'SHIPPER-ATTEMPT-001', 'shipper書き込み試行', false, false);
```

**期待値**：RLS 違反エラー（shipper は skus_owner_access の WITH CHECK に含まれない）

### 合否判定

| # | 確認項目 | ユーザー | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | shipper SELECT（自荷主） | TKY Shipper | owner_id=1 行のみ | □ |
| 2 | shipper SELECT（他荷主） | TKY Shipper | 0行（FDB 見えない） | □ |
| 3 | shipper INSERT ブロック | TKY Shipper | RLS 違反エラー | □ |

---

## SC-RLS-08: ヘルパー関数 get_my_owner_ids() の動作確認

### 各ロールの get_my_owner_ids() 結果

**TKY operator（ログイン時）：**

```sql
-- TKY User のJWT で実行
SELECT get_my_owner_ids();           -- viewer 以上 → [1]
SELECT get_my_owner_ids('operator'); -- operator 以上 → [1]
SELECT get_my_owner_ids('admin');    -- admin のみ → [] (empty)
```

| 関数呼び出し | 期待値 |
|-----------|-------|
| `get_my_owner_ids()` | `{1}` |
| `get_my_owner_ids('operator')` | `{1}` |
| `get_my_owner_ids('admin')` | `{}` (空) |

**TKY viewer（ログイン時）：**

```sql
SELECT get_my_owner_ids();           -- viewer 以上 → [1]
SELECT get_my_owner_ids('operator'); -- operator 以上 → [] (empty: viewer は含まれない)
```

### 合否判定

| # | 確認項目 | ユーザー | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | operator の viewer以上 owner_ids | TKY operator | `{1}` | □ |
| 2 | operator の admin owner_ids | TKY operator | `{}` (空) | □ |
| 3 | viewer の viewer以上 owner_ids | TKY viewer | `{1}` | □ |
| 4 | viewer の operator以上 owner_ids | TKY viewer | `{}` (空) | □ |

---

## SC-RLS-09: billing_rules の荷主分離確認

**対象ポリシー**：`billing_rules_owner_access`（ALL / admin・operator ロールのみ）

### 9-1. billing_rules RLS 有効確認（service_role で実行）

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'billing_rules';
-- 期待値: rowsecurity = true
```

### 9-2. billing_rules_owner_access ポリシー確認

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'billing_rules';
-- 期待値: billing_rules_owner_access が存在し cmd=ALL であること
```

### 9-3. 管理者レベルでのクロスリーク確認

```sql
-- owner_id ごとに独立したルール件数が返ること（他荷主のデータが混入しない）
SELECT owner_id, COUNT(*) AS rule_count
FROM billing_rules
WHERE owner_id IN (1, 2, 3)
GROUP BY owner_id
ORDER BY owner_id;
```

**期待値**：owner_id ごとに独立したルール件数が返ること（行が owner 間で混入していないこと）

### 9-4. TKY User で FDB の billing_rules が見えないこと

```sql
-- TKY User のJWT で実行（admin/operator ロール）
SELECT owner_id, charge_type, unit_price
FROM billing_rules
ORDER BY owner_id;
-- 期待値: owner_id=1 行のみ。owner_id=2,3 の行が含まれないこと
```

**補足**：`billing_rules_owner_access` は admin・operator ロールのみ適用。viewer/shipper ロールは billing_rules にアクセス不可。

### 合否判定

| # | 確認項目 | 期待値 | 判定 |
|---|---------|-------|------|
| 1 | billing_rules rowsecurity | true | □ |
| 2 | billing_rules_owner_access ポリシー存在 | cmd=ALL 存在 | □ |
| 3 | 管理者レベル クロスリーク確認 | owner 別に独立（混入なし） | □ |
| 4 | TKY User から FDB 行が見えない | 0行（RLS 拒否） | □ |

---

## SC-RLS-10: allocation_results の荷主分離確認

**対象ポリシー**：`allocation_results_owner_isolation`（ALL / 全 user_owners ロール）

### 10-1. allocation_results RLS 有効確認

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'allocation_results';
-- 期待値: rowsecurity = true
```

### 10-2. allocation_results_owner_isolation ポリシー確認

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'allocation_results';
-- 期待値: allocation_results_owner_isolation が存在し cmd=ALL であること
```

### 10-3. 管理者レベルでのクロスリーク確認

```sql
-- owner_id=2 の allocation_results が owner_id=1 クエリに混入していないか確認
SELECT owner_id, COUNT(*) AS alloc_count
FROM allocation_results
WHERE owner_id IN (1, 2)
GROUP BY owner_id
ORDER BY owner_id;
-- 期待値: 0件またはowner_id ごとに独立したレコード件数
```

### 10-4. TKY User で FDB の allocation_results が見えないこと

```sql
-- TKY User のJWT で実行
SELECT owner_id, COUNT(*) AS alloc_count
FROM allocation_results;
-- 期待値: owner_id=1 のレコードのみ（0件含む）。owner_id=2 のデータが含まれないこと
```

### 合否判定

| # | 確認項目 | 期待値 | 判定 |
|---|---------|-------|------|
| 1 | allocation_results rowsecurity | true | □ |
| 2 | allocation_results_owner_isolation ポリシー存在 | cmd=ALL 存在 | □ |
| 3 | 管理者レベル クロスリーク確認 | owner 別に独立（混入なし） | □ |
| 4 | TKY User から FDB allocation 行が見えない | 0行（RLS 拒否） | □ |

---

## 全体クリーンアップ SQL

テスト完了後、以下を実行してテストデータを削除する。

```sql
-- inventory クリア（テスト分）
DELETE FROM inventory
WHERE owner_id IN (1, 2)
  AND sku_id IN (
    SELECT id FROM skus WHERE sku_code IN ('RLS-TKY-001', 'RLS-FDB-001')
  );

-- SKU クリア
DELETE FROM skus WHERE sku_code IN ('RLS-TKY-001', 'RLS-FDB-001', 'CROSS-ATTACK-001', 'VIEWER-ATTEMPT-001', 'SHIPPER-ATTEMPT-001');

-- 共有ロケーション削除
DELETE FROM locations WHERE code = 'SHARED-DOCK-01';

-- user_owners クリア（テストユーザー分）
DELETE FROM user_owners
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'qa-tky@wms-test.local',
    'qa-fdb@wms-test.local',
    'qa-tky-viewer@wms-test.local',
    'qa-tky-shipper@wms-test.local'
  )
);

-- Auth ユーザー削除（Dashboard から手動削除 or service_role）
-- Supabase Dashboard → Authentication → Users → 該当ユーザーを削除

-- クリーン確認
SELECT COUNT(*) FROM skus WHERE sku_code LIKE 'RLS-%' OR sku_code LIKE 'CROSS-%' OR sku_code LIKE 'VIEWER-%' OR sku_code LIKE 'SHIPPER-%';
-- → 0
SELECT COUNT(*) FROM locations WHERE code = 'SHARED-DOCK-01';
-- → 0
```

---

## 実行チェックリスト（全シナリオ）

| # | シナリオ | 検証内容 | 実施日 | 結果 | 備考 |
|---|---------|---------|-------|------|------|
| 1 | SC-RLS-01 | TKY User が FDB SKU を SELECT できない | | □OK / □NG | |
| 2 | SC-RLS-02 | FDB User が TKY SKU を SELECT できない | | □OK / □NG | |
| 3 | SC-RLS-03 | TKY User が FDB へのクロス INSERT をブロックされる | | □OK / □NG | |
| 4 | SC-RLS-04 | inventory の荷主別 SELECT 分離 | | □OK / □NG | |
| 5 | SC-RLS-05 | 共有ロケーション（owner_id=NULL）は全ユーザーから閲覧可 | | □OK / □NG | |
| 6 | SC-RLS-06 | viewer は READ のみ（INSERT ブロック） | | □OK / □NG | |
| 7 | SC-RLS-07 | shipper は自荷主 SELECT のみ（INSERT ブロック） | | □OK / □NG | |
| 8 | SC-RLS-08 | get_my_owner_ids() のロール別動作確認 | | □OK / □NG | |
| 9 | SC-RLS-09 | billing_rules の荷主分離（billing_rules_owner_access） | | □OK / □NG | |
| 10 | SC-RLS-10 | allocation_results の荷主分離（allocation_results_owner_isolation） | | □OK / □NG | |

---

## ⚠️ テスト実施上の注意

1. **service_role と anon/authenticated の切り替え**  
   RLS は `authenticated` ロールで動作する。SQL Editor では `service_role` で実行するとRLSをバイパスする。  
   → 各シナリオで「どのロールで実行するか」を必ず確認してから実行すること。

2. **JWT トークンの取り替え方法**  
   Supabase Dashboard の SQL Editor は service_role が基本。  
   RLS テストは Supabase client SDK か curl で anon key + JWT を使って実行する：

   ```bash
   # 例: curl でログイン→JWT取得→RLS付きクエリ実行
   # 1. ログイン
   TOKEN=$(curl -s -X POST \
     'https://wqjsemttubzbpauvgyai.supabase.co/auth/v1/token?grant_type=password' \
     -H 'apikey: <ANON_KEY>' \
     -H 'Content-Type: application/json' \
     -d '{"email":"qa-tky@wms-test.local","password":"TestPass123!"}' \
     | jq -r '.access_token')
   
   # 2. RLS 付きクエリ実行（TKY User の skus）
   curl -s \
     'https://wqjsemttubzbpauvgyai.supabase.co/rest/v1/skus?select=id,owner_id,sku_code' \
     -H "apikey: <ANON_KEY>" \
     -H "Authorization: Bearer $TOKEN"
   # → owner_id=1 行のみが返ること
   ```

3. **Stage2 以降のテーブル（inbound_plans / inspection_results 等）**  
   現時点（Stage1）では存在しない。Stage2 deploy 後に同様のシナリオを追加すること。

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| RLS SQL（業務テーブル） | `shacho-shitsu/sql/phase9_stage1_rls.sql` |
| Auth + user_owners SQL | `shacho-shitsu/sql/phase9_stage1_auth.sql` |
| マルチテナント設計相談 | `wms-project-hub/specs/CONSULTATION_DB4_MULTITENANCY.md` |
| Phase9 実装計画 | `wms-project-hub/specs/PHASE9_IMPLEMENTATION_PLAN.md` |
| 入荷〜棚入れ E2E（QA3） | `wms-project-hub/specs/e2e_inbound_putaway_qa3.md` |

---

*このドキュメントはにーちゃん（id=7）が Phase 9-QA4（#832）として作成した。*  
*RLS ポリシーが実際に deploy されたら、本シナリオを順番に実施して分離を実証すること。*  
*SC-RLS-09・SC-RLS-10 は Phase 9-QA7fix（#905）にて追加。QA7（#898）実施結果をもとに billing_rules / allocation_results のシナリオを補完。*

---

## Phase 9-QA7 実施確認記録（#898 / 2026-05-16）

QA7（Phase 9 Stage 3-4 統合検証）にて、以下の RLS 分離確認を実施済み。

**実施日**：2026-05-16  
**実施者**：にーちゃん（id=7）  
**関連 kurokun_memo**：#248

### 確認結果サマリー

| 確認項目 | 結果 |
|---------|------|
| 全対象テーブル rowsecurity=true（7テーブル） | ✅ PASS |
| 重要ポリシー3件存在（inventory_owner_access / billing_rules_owner_access / allocation_results_owner_isolation） | ✅ PASS |
| クロスリーク確認：owner_id=2 のデータが owner_id=1 クエリに含まれない（0件） | ✅ PASS |

### QA7 で使用した確認 SQL

```sql
-- RLS 有効テーブル確認（7テーブル全確認）
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'owners', 'skus', 'locations', 'lots', 'serials',
    'inventory', 'billing_rules', 'allocation_results', 'work_orders'
  )
ORDER BY tablename;
-- 期待値: 全テーブル rowsecurity = true

-- 重要ポリシー3件確認
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('inventory', 'billing_rules', 'allocation_results')
ORDER BY tablename, policyname;
-- 期待値: inventory_owner_access / billing_rules_owner_access / allocation_results_owner_isolation の3件

-- クロスリーク確認（billing_rules）
-- owner_id=2 のデータが owner_id=1 クエリに混入していないこと
SELECT owner_id, COUNT(*) AS rule_count
FROM billing_rules
WHERE owner_id IN (1, 2)
GROUP BY owner_id
ORDER BY owner_id;
-- 結果: owner_id=1 と owner_id=2 が独立して返り、混入なし ✅
```
