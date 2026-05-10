# Phase 9-QA5: 請求・コスト計算シナリオ（CA-1/CA-2 対応）

作成日：2026-05-10  
作成者：にーちゃん（id=7）  
対応タスク：#839 Phase 9-QA5  
依存：Phase 9-DB4（owners / billing_rules）/ Phase 9-DB1（inventory.unit_cost）

---

## 概要

**CA-1（請求賃率）**：`billing_rules` テーブルを参照した請求計算の正確性を検証する。  
**CA-2（原価評価）**：`inventory.unit_cost` の移動平均更新ロジックを検証する。

| 区分 | シナリオ数 |
|------|-----------|
| CA-1: billing_rules 請求計算 | 10件 |
| CA-2: inventory.unit_cost 移動平均 | 5件 |
| 合計 | **15件** |

---

## テーブル定義（参照）

### billing_rules

```sql
CREATE TABLE billing_rules (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     BIGINT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  rule_type    TEXT NOT NULL,          -- '保管料' / '入庫料' / '出庫料' / '期間外料' / 'その他'
  period_type  TEXT NOT NULL           -- '3-period' / '2-period' / 'daily' / 'monthly' / 'tsubo'
    CHECK (period_type IN ('3-period','2-period','daily','monthly','tsubo')),
  unit         TEXT NOT NULL           -- 'case' / 'piece' / 'tsubo' / 'sqm'
    CHECK (unit IN ('case','piece','tsubo','sqm')),
  unit_price   NUMERIC NOT NULL,
  valid_from   DATE NOT NULL,
  valid_to     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### inventory（unit_cost 部分）

```sql
CREATE TABLE inventory (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     BIGINT NOT NULL REFERENCES owners(id),
  sku_id       BIGINT NOT NULL REFERENCES skus(id),
  lot_id       BIGINT REFERENCES lots(id),
  location_id  BIGINT NOT NULL REFERENCES locations(id),
  quantity     NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  status       TEXT NOT NULL DEFAULT 'available',
  unit_cost    NUMERIC NOT NULL DEFAULT 0,   -- CA-2: 移動平均単価
  ...
);
```

---

## テスト環境

| 項目 | 値 |
|------|-----|
| Supabase Project ID | wqjsemttubzbpauvgyai |
| SQL 実行手段 | Supabase MCP `execute_sql` |
| 前提 migration | `MIGRATION_DRAFT.sql` Stage 1〜4 apply 済み |

### 荷主マスタ（テスト前提データ）

| id | code | name | billing_period_type |
|----|------|------|---------------------|
| 1 | TKY | 東京通販株式会社 | 3-period |
| 2 | FDB | 富士食品工業株式会社 | 2-period |
| 3 | PRC | 精和プレシジョン株式会社 | monthly |

---

## Step 0: 前提確認

```sql
-- billing_rules テーブル存在確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'billing_rules';

-- inventory.unit_cost カラム存在確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inventory' AND column_name = 'unit_cost';
```

**期待値**：両クエリとも1行返ること。0行の場合はマイグレーション未適用。

---

## Part 1: billing_rules 請求計算シナリオ（CA-1）

---

### CA-1-01: 保管料（3期制・ケース単位）正常計算

**目的**：3期制（上旬/中旬/下旬）における保管料が `期末在庫 × unit_price` で正しく計算されること。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (1, '保管料', '3-period', 'case', 50.00, '2026-04-01');
-- 東京通販（owner_id=1）: 1ケースあたり50円/期
```

**テスト手順**:
```sql
-- 期末在庫（第1期末：4/10）スナップショット想定 = 200ケース
-- 請求計算クエリ
SELECT
  br.rule_type,
  br.period_type,
  200 AS qty,          -- 期末在庫数
  br.unit_price,
  200 * br.unit_price  AS billing_amount
FROM billing_rules br
WHERE br.owner_id = 1
  AND br.rule_type = '保管料'
  AND br.period_type = '3-period'
  AND br.valid_from <= '2026-04-10'
  AND (br.valid_to IS NULL OR br.valid_to >= '2026-04-10');
```

**期待値**:

| rule_type | period_type | qty | unit_price | billing_amount |
|-----------|-------------|-----|-----------|----------------|
| 保管料 | 3-period | 200 | 50.00 | 10000.00 |

**合否判定**：`billing_amount = 10000.00` であること。

---

### CA-1-02: 保管料（2期制・ケース単位）正常計算

**目的**：2期制（前半15日/後半16日〜月末）の保管料計算が正しいこと。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (2, '保管料', '2-period', 'case', 80.00, '2026-04-01');
-- 富士食品（owner_id=2）: 1ケースあたり80円/期
```

**テスト手順**:
```sql
-- 第1期末（4/15）: 在庫150ケース
-- 第2期末（4/30）: 在庫120ケース
-- 月間保管料 = (150 + 120) × 80
SELECT
  (150 + 120) AS total_qty,
  80.00 AS unit_price,
  (150 + 120) * 80.00 AS monthly_billing
FROM billing_rules br
WHERE br.owner_id = 2 AND br.rule_type = '保管料' AND br.period_type = '2-period'
  AND br.valid_from <= '2026-04-01'
  AND (br.valid_to IS NULL OR br.valid_to >= '2026-04-30');
```

**期待値**：`monthly_billing = 21600.00`

---

### CA-1-03: 保管料（日割・ケース単位）正常計算

**目的**：日割課金（daily）で入荷日から月末まで日数按分して計算されること。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (1, '保管料', 'daily', 'case', 10.00, '2026-05-01');
-- 東京通販（owner_id=1）: 1ケース1日あたり10円
```

**テスト手順**:
```sql
-- 4/16 に 50ケース入荷。4月末（4/30）まで 15日間保管
-- 保管料 = 50 × 10 × 15 = 7500円
SELECT
  50 AS qty,
  10.00 AS unit_price_per_day,
  ('2026-04-30'::DATE - '2026-04-16'::DATE + 1) AS storage_days,
  50 * 10.00 * ('2026-04-30'::DATE - '2026-04-16'::DATE + 1) AS billing_amount;
```

**期待値**：`storage_days = 15`, `billing_amount = 7500.00`

---

### CA-1-04: 保管料（月額・坪単位）正常計算

**目的**：坪貸し（tsubo/sqm）で月額固定の保管料が計算されること。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (3, '保管料', 'tsubo', 'tsubo', 3000.00, '2026-04-01');
-- 精和プレシジョン（owner_id=3）: 1坪あたり3,000円/月
```

**テスト手順**:
```sql
-- 使用面積 = 30坪
-- 保管料 = 30 × 3000 = 90000円
SELECT
  30 AS tsubo_used,
  br.unit_price,
  30 * br.unit_price AS billing_amount
FROM billing_rules br
WHERE br.owner_id = 3 AND br.rule_type = '保管料' AND br.period_type = 'tsubo'
  AND br.valid_from <= '2026-04-01'
  AND (br.valid_to IS NULL OR br.valid_to >= '2026-04-30');
```

**期待値**：`billing_amount = 90000.00`

---

### CA-1-05: 入庫料（ケース単位）正常計算

**目的**：入荷件数 × 入庫料単価が正しく計算されること。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (1, '入庫料', '3-period', 'case', 30.00, '2026-04-01');
-- 東京通販（owner_id=1）: 1ケースあたり30円
```

**テスト手順**:
```sql
-- 4月入庫 = 300ケース
-- 入庫料 = 300 × 30 = 9000円
SELECT
  300 AS inbound_cases,
  br.unit_price,
  300 * br.unit_price AS billing_amount
FROM billing_rules br
WHERE br.owner_id = 1 AND br.rule_type = '入庫料'
  AND br.valid_from <= '2026-04-01'
  AND (br.valid_to IS NULL OR br.valid_to >= '2026-04-30');
```

**期待値**：`billing_amount = 9000.00`

---

### CA-1-06: 出庫料（ケース単位）正常計算

**目的**：出荷件数 × 出庫料単価が正しく計算されること。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (1, '出庫料', '3-period', 'case', 25.00, '2026-04-01');
-- 東京通販（owner_id=1）: 1ケースあたり25円
```

**テスト手順**:
```sql
-- 4月出荷 = 250ケース
-- 出庫料 = 250 × 25 = 6250円
SELECT
  250 AS outbound_cases,
  br.unit_price,
  250 * br.unit_price AS billing_amount
FROM billing_rules br
WHERE br.owner_id = 1 AND br.rule_type = '出庫料'
  AND br.valid_from <= '2026-04-01'
  AND (br.valid_to IS NULL OR br.valid_to >= '2026-04-30');
```

**期待値**：`billing_amount = 6250.00`

---

### CA-1-07: 複数 rule_type 合算（月次請求書合計）

**目的**：保管料・入庫料・出庫料を合算した月次請求金額が正しく計算されること。

**前提**：CA-1-01（保管料10000）・CA-1-05（入庫料9000）・CA-1-06（出庫料6250）のルールが登録済み。

**テスト手順**:
```sql
-- 各 rule_type の件数・単価を集計
WITH monthly_fees AS (
  SELECT br.rule_type, br.unit_price
  FROM billing_rules br
  WHERE br.owner_id = 1
    AND br.valid_from <= '2026-04-01'
    AND (br.valid_to IS NULL OR br.valid_to >= '2026-04-30')
)
SELECT
  SUM(CASE WHEN rule_type = '保管料' THEN 200 * unit_price ELSE 0 END) AS storage_fee,
  SUM(CASE WHEN rule_type = '入庫料' THEN 300 * unit_price ELSE 0 END) AS inbound_fee,
  SUM(CASE WHEN rule_type = '出庫料' THEN 250 * unit_price ELSE 0 END) AS outbound_fee,
  SUM(CASE WHEN rule_type = '保管料' THEN 200 * unit_price ELSE 0 END)
  + SUM(CASE WHEN rule_type = '入庫料' THEN 300 * unit_price ELSE 0 END)
  + SUM(CASE WHEN rule_type = '出庫料' THEN 250 * unit_price ELSE 0 END) AS total
FROM monthly_fees;
```

**期待値**：

| storage_fee | inbound_fee | outbound_fee | total |
|-------------|-------------|--------------|-------|
| 10000.00 | 9000.00 | 6250.00 | 25250.00 |

---

### CA-1-08: 有効期間境界値（valid_from / valid_to）

**目的**：ルールの有効期間外（期間前・期間後）は適用されないこと。

**前提データ**:
```sql
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from, valid_to)
VALUES (1, 'その他', 'monthly', 'case', 100.00, '2026-04-01', '2026-04-30');
-- 2026/4月のみ有効なルール
```

**テスト手順**:
```sql
-- パターン1: 有効期間内（4/15）→ 1件ヒットすること
SELECT COUNT(*) AS hit_count
FROM billing_rules
WHERE owner_id = 1 AND rule_type = 'その他'
  AND valid_from <= '2026-04-15'
  AND (valid_to IS NULL OR valid_to >= '2026-04-15');
-- 期待値: hit_count = 1

-- パターン2: 有効期間前（3/31）→ 0件（適用なし）
SELECT COUNT(*) AS hit_count
FROM billing_rules
WHERE owner_id = 1 AND rule_type = 'その他'
  AND valid_from <= '2026-03-31'
  AND (valid_to IS NULL OR valid_to >= '2026-03-31');
-- 期待値: hit_count = 0

-- パターン3: 有効期間後（5/1）→ 0件（適用なし）
SELECT COUNT(*) AS hit_count
FROM billing_rules
WHERE owner_id = 1 AND rule_type = 'その他'
  AND valid_from <= '2026-05-01'
  AND (valid_to IS NULL OR valid_to >= '2026-05-01');
-- 期待値: hit_count = 0
```

**期待値**：パターン1 = 1、パターン2 = 0、パターン3 = 0

---

### CA-1-09: 荷主 RLS 分離（荷主 A は荷主 B の billing_rules を参照できない）

**目的**：billing_rules に RLS が有効で、他荷主のルールが漏れないこと。

**前提**：RLS ポリシー `billing_rules_owner_access` が適用済み（admin / operator のみ自荷主のルールを参照可）。

**テスト手順**:
```sql
-- RLS 有効確認
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'billing_rules';
-- 期待値: billing_rules_owner_access ポリシーが存在すること

-- 荷主 A（TKY）ユーザーで SELECT した場合、荷主 B（FDB）のルールが返らないこと
-- ※ set_config('request.jwt.claims', ...) で荷主Aユーザーに偽装して検証
-- 実際のテストは Supabase Auth ユーザーを用いた API レベルで実施
-- （以下は管理者権限での確認用）
SELECT owner_id, COUNT(*) AS rule_count
FROM billing_rules
WHERE owner_id IN (1, 2, 3)
GROUP BY owner_id;
-- 期待値: owner_id=1,2,3 それぞれのルール件数が独立して確認できること
```

**合否判定**：
- RLS ポリシーが存在すること
- 荷主 A ユーザーでの API 呼び出し結果に owner_id = B のレコードが含まれないこと

---

### CA-1-10: 新旧賃率切替（有効期間オーバーラップ禁止）

**目的**：賃率改定時に旧ルールと新ルールの有効期間が重複しないことを確認し、切替後は新ルールのみ適用されること。

**前提データ**:
```sql
-- 旧ルール（〜4/30）
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from, valid_to)
VALUES (2, '保管料', '2-period', 'case', 80.00, '2026-01-01', '2026-04-30');

-- 新ルール（5/1〜）
INSERT INTO billing_rules (owner_id, rule_type, period_type, unit, unit_price, valid_from)
VALUES (2, '保管料', '2-period', 'case', 90.00, '2026-05-01');
```

**テスト手順**:
```sql
-- 切替前（4/30）: 旧ルール(80円)が1件のみヒット
SELECT unit_price
FROM billing_rules
WHERE owner_id = 2 AND rule_type = '保管料'
  AND valid_from <= '2026-04-30'
  AND (valid_to IS NULL OR valid_to >= '2026-04-30');
-- 期待値: unit_price = 80.00 (1行)

-- 切替後（5/1）: 新ルール(90円)が1件のみヒット
SELECT unit_price
FROM billing_rules
WHERE owner_id = 2 AND rule_type = '保管料'
  AND valid_from <= '2026-05-01'
  AND (valid_to IS NULL OR valid_to >= '2026-05-01');
-- 期待値: unit_price = 90.00 (1行)

-- オーバーラップ確認（同一 owner / rule_type で有効期間が重複していないこと）
SELECT
  a.id AS rule_a, a.unit_price AS price_a, a.valid_from AS from_a, a.valid_to AS to_a,
  b.id AS rule_b, b.unit_price AS price_b, b.valid_from AS from_b, b.valid_to AS to_b
FROM billing_rules a
JOIN billing_rules b
  ON a.owner_id = b.owner_id
  AND a.rule_type = b.rule_type
  AND a.id < b.id
  AND a.valid_from <= COALESCE(b.valid_to, '9999-12-31')
  AND b.valid_from <= COALESCE(a.valid_to, '9999-12-31')
WHERE a.owner_id = 2 AND a.rule_type = '保管料';
-- 期待値: 0行（オーバーラップなし）
```

**期待値**：切替前 = 80円、切替後 = 90円、オーバーラップ = 0行

---

## Part 2: inventory.unit_cost 移動平均計算シナリオ（CA-2）

### 移動平均単価の計算式

```
新 unit_cost = (既存在庫量 × 既存 unit_cost + 入荷量 × 入荷単価)
               ÷ (既存在庫量 + 入荷量)
```

出庫時は unit_cost を変更しない（移動平均は入荷時のみ更新）。

---

### CA-2-01: 基本移動平均計算（既存在庫 + 新規入荷）

**目的**：新規入荷時に `inventory.unit_cost` が移動平均式で正しく更新されること。

**テストシナリオ**:

| ステップ | 操作 | 在庫数 | 入荷単価 | 期待 unit_cost |
|---------|------|--------|---------|----------------|
| 初期状態 | 入荷 100ケース @500円 | 100 | 500 | 500.00 |
| 追加入荷 | 入荷 50ケース @600円 | 150 | 600 | 533.33... |

**計算検証 SQL**:
```sql
-- 移動平均計算
SELECT
  100 AS existing_qty,
  500.00 AS existing_unit_cost,
  50 AS inbound_qty,
  600.00 AS inbound_unit_price,
  ROUND(
    (100 * 500.00 + 50 * 600.00) / (100 + 50),
    2
  ) AS new_unit_cost;
```

**期待値**：`new_unit_cost = 533.33`

**DB 更新 SQL（実装時）**:
```sql
-- 入荷処理時の unit_cost 更新（疑似コード）
UPDATE inventory
SET
  unit_cost = ROUND((quantity * unit_cost + :inbound_qty * :inbound_price) / (quantity + :inbound_qty), 4),
  quantity = quantity + :inbound_qty,
  updated_at = NOW()
WHERE owner_id = :owner_id AND sku_id = :sku_id AND lot_id = :lot_id AND location_id = :location_id;
```

---

### CA-2-02: 複数ロット混在時の移動平均

**目的**：SKU 単位の加重平均（ロット横断）が正しく計算されること。

**テストシナリオ**:

| lot_id | quantity | unit_cost |
|--------|----------|-----------|
| 1 | 100 | 500.00 |
| 2 | 80 | 620.00 |
| 3 | 60 | 480.00 |

**計算検証 SQL**:
```sql
-- ロット横断の加重平均単価
WITH mock_inventory AS (
  SELECT 1 AS lot_id, 100 AS qty, 500.00 AS unit_cost
  UNION ALL
  SELECT 2, 80, 620.00
  UNION ALL
  SELECT 3, 60, 480.00
)
SELECT
  SUM(qty) AS total_qty,
  SUM(qty * unit_cost) AS total_value,
  ROUND(SUM(qty * unit_cost) / SUM(qty), 2) AS weighted_avg_cost
FROM mock_inventory;
```

**期待値**：

| total_qty | total_value | weighted_avg_cost |
|-----------|-------------|-------------------|
| 240 | 121400.00 | 505.83 |

**検証ポイント**：ロット別の unit_cost は個別管理し、請求・原価集計時にロット横断加重平均を使用すること。

---

### CA-2-03: 出庫後の残高コスト（unit_cost は変化しない）

**目的**：出庫時に `quantity` が減少しても `unit_cost` は変わらないこと（移動平均の維持）。

**テストシナリオ**:

| ステップ | 操作 | 在庫数 | unit_cost |
|---------|------|--------|-----------|
| 初期 | 在庫100ケース @533.33円 | 100 | 533.33 |
| 出庫 | 30ケース出荷 | 70 | 533.33（変化なし）|

**計算検証 SQL**:
```sql
-- 出庫後も unit_cost は維持されること
WITH before_outbound AS (
  SELECT 100 AS qty, 533.33 AS unit_cost
),
after_outbound AS (
  SELECT 100 - 30 AS qty, 533.33 AS unit_cost  -- unit_cost 変化なし
)
SELECT
  b.qty AS before_qty,
  b.unit_cost AS before_cost,
  a.qty AS after_qty,
  a.unit_cost AS after_cost,
  (b.unit_cost = a.unit_cost) AS cost_unchanged
FROM before_outbound b, after_outbound a;
```

**期待値**：`cost_unchanged = true`

**在庫評価額の変化**：
```sql
SELECT
  100 * 533.33 AS before_total_value,  -- 53333.00
  70  * 533.33 AS after_total_value;   -- 37333.10（数量のみ減少）
```

---

### CA-2-04: ゼロ在庫からの再入荷（単価完全切替）

**目的**：在庫がゼロになった後の再入荷では、新しい入荷単価に完全切替されること。

**テストシナリオ**:

| ステップ | 操作 | 在庫数 | unit_cost |
|---------|------|--------|-----------|
| 初期 | 在庫100ケース @500円 | 100 | 500.00 |
| 出庫 | 100ケース全量出荷 | 0 | 500.00（ゼロ在庫）|
| 再入荷 | 50ケース @700円 | 50 | 700.00（完全切替）|

**計算検証 SQL**:
```sql
-- ゼロ在庫からの再入荷: 既存在庫 = 0 なので新単価に完全切替
SELECT
  CASE
    WHEN 0 = 0 THEN 700.00  -- ゼロ在庫の場合、新入荷単価がそのまま unit_cost
    ELSE ROUND((0 * 500.00 + 50 * 700.00) / (0 + 50), 2)
  END AS new_unit_cost;
-- 期待値: 700.00

-- 0除算防止のための実装確認
SELECT
  CASE
    WHEN (0 + 50) = 0 THEN 0  -- 除算エラー回避
    ELSE ROUND((0 * 500.00 + 50 * 700.00) / (0 + 50), 2)
  END AS safe_unit_cost;
-- 期待値: 700.00
```

**期待値**：`new_unit_cost = 700.00`

**実装上の注意**：`quantity = 0` の場合は `unit_cost = 入荷単価` として直接セットする（ゼロ除算防止）。

---

### CA-2-05: 複数ロケーション合算での在庫評価額

**目的**：同一 SKU が複数ロケーションに分散している場合、在庫評価額の合算が正しく計算されること。

**テストシナリオ**:

| location | quantity | unit_cost | 評価額 |
|----------|----------|-----------|--------|
| A1-01-3 | 50 | 500.00 | 25000.00 |
| A2-03-1 | 30 | 533.33 | 15999.90 |
| B1-02-2 | 20 | 480.00 | 9600.00 |

**計算検証 SQL**:
```sql
-- 複数ロケーションの在庫評価額合算
WITH mock_multi_location AS (
  SELECT 'A1-01-3' AS loc, 50 AS qty, 500.00 AS unit_cost
  UNION ALL
  SELECT 'A2-03-1', 30, 533.33
  UNION ALL
  SELECT 'B1-02-2', 20, 480.00
)
SELECT
  SUM(qty) AS total_qty,
  ROUND(SUM(qty * unit_cost), 2) AS total_value,
  ROUND(SUM(qty * unit_cost) / SUM(qty), 2) AS weighted_avg_cost
FROM mock_multi_location;
```

**期待値**：

| total_qty | total_value | weighted_avg_cost |
|-----------|-------------|-------------------|
| 100 | 50599.90 | 505.999... ≈ 506.00 |

**検証ポイント**：
- ロケーション別に `unit_cost` が異なることは許容（入荷タイミング差による）
- 荷主向け在庫表では全ロケーション合算の加重平均を表示
- 請求計算（保管料）は合計 `quantity` に対して `billing_rules.unit_price` を掛ける

---

## 検証結果記録テンプレート

```
## 検証結果（Phase 9-QA5 / #839）

### CA-1 billing_rules 請求計算
- CA-1-01 保管料（3期制）: OK / NG
- CA-1-02 保管料（2期制）: OK / NG
- CA-1-03 保管料（日割）:  OK / NG
- CA-1-04 保管料（坪単位）: OK / NG
- CA-1-05 入庫料:          OK / NG
- CA-1-06 出庫料:          OK / NG
- CA-1-07 月次合算:         OK / NG
- CA-1-08 有効期間境界値:   OK / NG
- CA-1-09 RLS 荷主分離:    OK / NG
- CA-1-10 新旧賃率切替:     OK / NG

### CA-2 inventory.unit_cost 移動平均
- CA-2-01 基本移動平均:     OK / NG
- CA-2-02 複数ロット加重平均: OK / NG
- CA-2-03 出庫後コスト維持:  OK / NG
- CA-2-04 ゼロ在庫再入荷:   OK / NG
- CA-2-05 複数ロケ合算:     OK / NG

総合: OK / NG
実行日: YYYY-MM-DD
確認者: にーちゃん（id=7）
```

---

## 実装時の注意事項

1. **billing_rules のオーバーラップ防止**：同一 `owner_id + rule_type` で有効期間が重複するルールを INSERT/UPDATE しようとした場合はアプリ側でバリデーションが必要（DB制約のみでは防げない）。

2. **unit_cost の精度**：移動平均は ROUND(..., 4) で4桁まで保持し、表示時に2桁に丸める。小数誤差が積み重なるため、評価額合計では SUM(qty * unit_cost) で計算すること（unit_cost を先に丸めてから掛け算しない）。

3. **ゼロ在庫の unit_cost**：在庫が 0 になっても unit_cost は直前値を保持する（次回入荷時に使用しない）。再入荷時は入荷単価を直接セットする。

4. **3期制の期末タイミング**：3期制の「第1期末」は毎月10日、「第2期末」は20日、「第3期末」は月末（月によって28〜31日）。アプリ側でカレンダー計算が必要。

5. **消費税**：billing_amount は税抜き金額。消費税（10% or 8%軽減）は請求書生成時に合計額に対して加算する（品目ごとではなく合計に対して）。
