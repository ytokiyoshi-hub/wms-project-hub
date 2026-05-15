# 工程8：ピッキング方式実装仕様（BF-3）

> 起票：2026-05-16 / Phase 9-BF3 さーちゃん（id=5）タスク#880
> 前提ファイル：`process_07_to_09_outbound_chain.md`（工程8 セクション）から分離・詳細化
> 依存：BF-2引当仕様（`process_07_outbound_allocation.md` / #873完了）
> SQL実装：`sql/phase9_stage3_picking.sql`（feature/849）

---

## 確定値サマリー

| 項目 | 確定値 | 根拠 |
|------|--------|------|
| BF-3 ピッキング方式 | D（ウェーブ生成+荷主切替） | MORNING_DECISION_SHEET 2026-05-14 時吉さん判断 |
| ピッキングFIFO | 強制（E-6） | process_01_requirements.md「FIFO強制」 |
| 温度帯分割 | 自動（lot_attributes ベース） | 食品衛生・コールドチェーン要件 |
| 荷主スコープ | owner_id 厳格分離 | DB-4 方針（RLS） |

---

## 1. ピッキング方式定義

`owners.picking_strategy` で荷主ごとに切替。

| strategy | 名称 | ウェーブ分割単位 | 主な適用荷主 |
|----------|------|----------------|-------------|
| `single` | シングルピッキング（**デフォルト**） | 出荷指示1件ずつ | 少量多品種・単品仕分け不要 |
| `wave` | ウェーブピッキング | owner × エリア × 温度帯 | 高頻度・大量出荷 |
| `batch` | バッチピッキング | owner × SKU | 同一SKUを複数注文向けにまとめ取り |
| `zone` | ゾーンピッキング | owner × ロケエリア | 倉庫エリア固定担当・大型施設 |

### FIFO強制ルール（E-6）

- ウェーブ内のタスク `sort_order` は **エリア→アイル→ラック→レベル→expiry_date ASC** で決定
- strategy に関わらず同一ロケ内では期限の近いロットを必ず先にピッキング
- HT 画面はこの `sort_order` 順に表示（作業員が迷わない動線）

---

## 2. 温度帯別自動分割

### 温度帯定義

`lots.lot_attributes->>'temperature_zone'` から取得。

| 値 | 名称 | 保管条件 |
|----|------|---------|
| `ambient` | 常温（デフォルト・NULL時） | 常温保管区画 |
| `chilled` | 冷蔵 | 0〜10℃ |
| `frozen` | 冷凍 | -18℃以下 |

### 分割ルール

1. 同一ウェーブに **異なる温度帯のタスクを混在させない**（食品衛生法・コールドチェーン要件）
2. `lot_attributes->>'temperature_zone'` が NULL → `ambient` として扱う
3. `wave` / `zone` strategy では temperature_zone も分割キーに加える
4. `single` strategy でも温度帯が異なるSKUは別ウェーブ（同一注文内でも自動分割）

### 温度帯取得ロジック

```sql
-- lot_attributes から temperature_zone を取得（NULL → ambient）
COALESCE(l.lot_attributes->>'temperature_zone', 'ambient') AS temperature_zone
```

---

## 3. 荷主切替ロジック

```
ウェーブ生成リクエスト（owner_id, shipment_order_ids[]）
  ↓
owner_id でスコープを確定（跨ぎ禁止）
  ↓
allocation_results を WHERE owner_id = p_owner_id で絞込
  ↓
strategy に応じた分割グループを生成
  ↓
各グループに picking_waves レコードを作成
  ↓
allocation_results を picking_tasks に展開
  ↓
RLS: picking_waves.owner_id / picking_tasks.owner_id がユーザーアクセス可能な owner_id か検証
```

- 荷主をまたぐウェーブは **DB制約・アプリロジック両方で禁止**
- `picking_waves.owner_id REFERENCES owners(id)` の FK で物理制約
- RLS で `owner_id IN (SELECT owner_id FROM user_owners WHERE user_id = auth.uid())`

---

## 4. テーブル設計

### 4-1. picking_waves（ウェーブ管理）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | BIGSERIAL | PK | |
| owner_id | BIGINT | NOT NULL FK→owners | 荷主スコープ（跨ぎ禁止） |
| wave_number | TEXT | NOT NULL | 識別番号（例：W-20260516-001） |
| strategy_used | TEXT | NOT NULL CHECK | single/wave/batch/zone |
| area | TEXT | | zone/wave 分割時のエリアコード |
| temperature_zone | TEXT | NOT NULL DEFAULT 'ambient' CHECK | ambient/chilled/frozen |
| status | TEXT | NOT NULL DEFAULT 'created' CHECK | created/in_progress/completed/cancelled |
| scheduled_date | DATE | | 作業予定日 |
| assigned_staff_id | BIGINT | FK→wms_staff（NULL可） | 担当スタッフ |
| total_tasks | INT | NOT NULL DEFAULT 0 | ウェーブ内タスク総数 |
| completed_tasks | INT | NOT NULL DEFAULT 0 | 完了タスク数 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| UNIQUE | (owner_id, wave_number) | | 荷主内で番号一意 |

### 4-2. picking_tasks（ピッキング作業単位）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | BIGSERIAL | PK | |
| wave_id | BIGINT | NOT NULL FK→picking_waves ON DELETE CASCADE | |
| owner_id | BIGINT | NOT NULL FK→owners | 荷主（波と一致強制） |
| allocation_result_id | BIGINT | NOT NULL FK→allocation_results | 引当元 |
| shipment_order_id | BIGINT | NOT NULL FK→shipment_orders | 出荷指示 |
| sku_id | BIGINT | NOT NULL FK→skus | |
| lot_id | BIGINT | FK→lots（NULL可） | lot_required=false は NULL |
| location_id | BIGINT | NOT NULL FK→locations | ピック元ロケーション |
| sort_order | INT | NOT NULL DEFAULT 0 | HT表示順（FIFO経路順） |
| requested_qty | NUMERIC | NOT NULL CHECK > 0 | 要求数 |
| picked_qty | NUMERIC | NOT NULL DEFAULT 0 CHECK >= 0 | 実績数 |
| status | TEXT | NOT NULL DEFAULT 'pending' CHECK | pending/in_progress/completed/short/cancelled |
| assigned_staff_id | BIGINT | FK→wms_staff（NULL可） | 個別担当 |
| started_at | TIMESTAMPTZ | | |
| completed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

## 5. SQL関数仕様

### `generate_picking_wave(p_owner_id, p_shipment_order_ids[], p_scheduled_date)`

```
引数:
  p_owner_id              BIGINT      -- 対象荷主 ID
  p_shipment_order_ids    BIGINT[]    -- ウェーブに含める出荷指示 ID 配列
  p_scheduled_date        DATE        -- 作業予定日（DEFAULT CURRENT_DATE）

戻り値: BIGINT[]  -- 生成した wave_id の配列

処理:
  1. owners.picking_strategy を取得
  2. allocation_results を shipment_order_ids AND owner_id でフィルタ
  3. strategy に応じたグループキーを決定:
       single → (shipment_order_id)
       wave   → (area, temperature_zone)
       batch  → (sku_id)
       zone   → (area)
     ※ 全 strategy で temperature_zone は必ず分割キーに加える（混在禁止）
  4. グループごとに picking_waves を INSERT（wave_number は YYYYMMDD-NNN 形式）
  5. 各 allocation_result を picking_tasks に展開
     - sort_order: area → aisle → rack → level → expiry_date ASC でランク付け
  6. picking_waves.total_tasks を更新
  7. shipment_orders.status を 'picking' に更新
  8. wave_id 配列を返す
```

### `complete_picking_task(p_task_id, p_actual_qty, p_serial_ids[])`

```
引数:
  p_task_id       BIGINT      -- 完了するタスク ID
  p_actual_qty    NUMERIC     -- 実際にピックした数量
  p_serial_ids    BIGINT[]    -- シリアル管理商品の場合（skus.serial_required=true）

戻り値: TEXT  -- 'completed' | 'short'

処理:
  1. picking_tasks の status を 'pending' または 'in_progress' から検証
  2. picked_qty = p_actual_qty, status = CASE（完了/short）, completed_at = now() で更新
  3. inventory(reserved) を確認:
     - 完全ピック: status を 'picked' に変更（次工程=出荷確定で消費）
     - ショート: reserved 量を差し戻し（deallocate に委譲）
  4. skus.serial_required = true の場合:
     - p_serial_ids の件数 = p_actual_qty を検証
     - serials.status を 'in_stock' → 'outbound_pending' に更新
  5. picking_waves.completed_tasks += 1
  6. 全タスク完了なら picking_waves.status = 'completed'
  7. 出荷指示全タスク完了なら shipment_orders.status = 'packed' に更新

エラー:
  - タスク ID 不在 / 既完了 → EXCEPTION
  - p_actual_qty > requested_qty → EXCEPTION '超過ピック禁止'
  - serial_required かつ serial_ids 件数不一致 → EXCEPTION
```

### `cancel_picking_wave(p_wave_id)`

```
引数:
  p_wave_id BIGINT

処理:
  1. 完了済みタスクが1件以上あれば EXCEPTION（部分完了ウェーブはキャンセル不可）
  2. 全 picking_tasks を 'cancelled' に更新
  3. picking_waves.status = 'cancelled'
  4. allocation_results は保持（再ウェーブ生成で再利用可能）
```

---

## 6. 正常系テストシナリオ

### シナリオ1: wave strategy + 温度帯自動分割

```
前提データ:
  owner: TKY（picking_strategy='wave'）
  出荷指示 SO-001（2件の明細）:
    明細1: sku=食品A（lot_required=true）
      allocation_result: lot1（temperature_zone='chilled'）@ loc-C1（area='C', aisle='01'）, qty=10
    明細2: sku=食品B（lot_required=true）
      allocation_result: lot2（temperature_zone='ambient'）@ loc-A1（area='A', aisle='01'）, qty=5

generate_picking_wave(owner_id=TKY, [SO-001], '2026-05-16')

期待結果:
  wave1（area='C', temperature_zone='chilled'）:
    task1: sku=食品A, loc=C1, qty=10, sort_order=1
    total_tasks=1
  wave2（area='A', temperature_zone='ambient'）:
    task2: sku=食品B, loc=A1, qty=5, sort_order=1
    total_tasks=1
  → 2ウェーブ生成（温度帯混在なし）
  → shipment_orders SO-001.status = 'picking'
```

### シナリオ2: complete_picking_task 正常完了

```
前提: wave1 / task1（qty=10 chilled食品A）

complete_picking_task(task_id=task1, actual_qty=10, serial_ids=NULL)

期待結果:
  picking_tasks.status = 'completed', picked_qty = 10
  inventory(reserved) → status = 'picked'
  picking_waves.completed_tasks = 1（全タスク完了でwave.status='completed'）
  戻り値: 'completed'
```

### シナリオ3（異常系）: ショートピック

```
前提: wave2 / task2（qty=5 ambient食品B）

complete_picking_task(task_id=task2, actual_qty=3, serial_ids=NULL)

期待結果:
  picking_tasks.status = 'short', picked_qty = 3
  inventory(reserved) の残2個は deallocate_inventory 経由で available に戻す
  戻り値: 'short'
  ※ 上位処理で部分出荷 or バックオーダー判断が必要
```

---

## 7. 異常系・エラーハンドリング

| ケース | 挙動 |
|--------|------|
| 温度帯混在の allocation_results | generate 時に自動分割（エラーではなく分岐） |
| 出荷指示に引当結果がない | EXCEPTION 'no allocation_results for order %' |
| 完了済みタスクを再完了 | EXCEPTION 'task % already completed' |
| actual_qty > requested_qty | EXCEPTION '超過ピック禁止' |
| serial_required かつ serial_ids NULL | EXCEPTION 'serial_ids required for sku %' |
| serial_ids 件数不一致 | EXCEPTION 'serial_ids count mismatch: expected X, got Y' |
| ウェーブ部分完了後のキャンセル | EXCEPTION 'cannot cancel wave with completed tasks' |
| wms_staff 不在（assigned_staff_id=NULL） | 許容（未割り当てウェーブ） |

---

## 8. RLS設計方針

```sql
-- picking_waves: 荷主ユーザーのみアクセス可
CREATE POLICY rls_picking_waves_select ON picking_waves
  FOR SELECT USING (
    owner_id IN (SELECT owner_id FROM user_owners WHERE user_id = auth.uid())
  );

-- picking_tasks: 同上（wave経由ではなく owner_id を直保持）
CREATE POLICY rls_picking_tasks_select ON picking_tasks
  FOR SELECT USING (
    owner_id IN (SELECT owner_id FROM user_owners WHERE user_id = auth.uid())
  );

-- wms_staff は全owner参照可（スタッフ管理者用途）
-- → 本番適用前に roles テーブル設計後に再設計（残課題 PK-5）
```

---

## 9. 残課題（Phase 9 以降）

| ID | 内容 | 優先度 |
|----|------|--------|
| PK-1 | picking_tasks の HT 画面 API（F-804） | high |
| PK-2 | 部分出荷（short）発生時のバックオーダー連携フロー | high |
| PK-3 | ウェーブ再生成（引当変更後） | medium |
| PK-4 | wms_staff × picking_waves アサイン API | medium |
| PK-5 | wms_staff 用 RLS（storekeeper ロール）設計 | medium |
| PK-6 | batch strategy の仕分けラベル生成（F-803 後半） | medium |
| PK-7 | `SELECT ... FOR UPDATE SKIP LOCKED` 排他制御（AL-1 引継ぎ） | high |
| PK-8 | inventory(reserved) → (picked) → (shipped) ステータス遷移完成 | high |

---

## 10. BF-2 との連携インターフェース（AL-5 解決）

```
BF-2（引当）が作る:                  BF-3（ピッキング）が消費する:
  allocation_results               →  generate_picking_wave() の入力
  inventory(reserved)              →  complete_picking_task() で 'picked' に遷移
  shipment_order_items.status='allocated' → generate 後 'picking' に更新
  shipment_orders.status='allocated'      → generate 後 'picking' に更新
```

- `allocation_results` は BF-3 がウェーブ生成後も保持（ピック完了の根拠）
- `complete_picking_task` でピック完了後、inventory(reserved) → 'picked' に遷移
- 出荷確定（BF-4）で inventory(picked) を消費して在庫残高を確定

---

*最終更新: 2026-05-16 / Phase 9-BF3 さーちゃん（id=5）タスク#880*
