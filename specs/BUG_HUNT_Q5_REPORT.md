# BUG_HUNT_Q5: api/*.json 外部キー整合性検査レポート

作成日: 2026-05-29  
担当: さーちゃん (assigned_to=5)  
タスク: #1066

---

## 1. 検査概要

`~/github/wms-project-hub/wms-project-hub/test2-mirror/api/` 配下の30ファイルに対し、以下のFKペアを検査した。

| FKペア | 参照元フィールド | マスター |
|--------|----------------|---------|
| owner_code→owners | owner_code | owners.json (5件) |
| location_code→locations | location_code | locations.json |
| putaway_location→locations | putaway_location | locations.json |
| from/to_location_code→locations | from_location_code, to_location_code | locations.json |
| product_code→products | product_code | products.json |
| carrier_code→carriers | carrier_code | carriers.json (4件) |
| warehouse_code→warehouses | warehouse_code | warehouses.json (3件) |

---

## 2. 検査対象ファイル一覧（30ファイル）

```
billing-snapshots.json        carrier-routes.json
carriers.json                 csv-format-masters.json       ← 空ファイル（除外）
customers.json                discrepancies.json
inbound-actuals.json          inbound-schedules.json
inventory-adjustments.json    inventory-snapshots.json      ← 空ファイル（除外）
inventory.json                inventory/lots.json
inventory/move.json           ← 空ファイル（除外）
inventory/transactions.json   loadable-orders.json
loadings.json                 locations.json（マスター）
owners.json（マスター）       packing-materials.json
packings.json                 picking-tasks/pending.json
products.json（マスター）     putaway-instructions.json
putaway/pending.json          returns.json
shipment-actuals.json         shipment-orders.json
stocktake-sessions.json       ← 空ファイル（除外）
system-users.json             warehouses.json（マスター）
```

空ファイル4件（csv-format-masters.json / inventory-snapshots.json / inventory/move.json / stocktake-sessions.json）は読み込み不可のため除外。

---

## 3. 検査結果サマリー（修正前）

| FKペア | 不整合件数 | 対象ファイル |
|--------|-----------|-------------|
| location_code→locations | **30件** | inventory.json, inventory/transactions.json, picking-tasks/pending.json |
| product_code→products | **16件** | inventory.json |
| owner_code→owners | 0件 | — |
| carrier_code→carriers | 0件 | — |
| warehouse_code→warehouses | 0件 | — |
| **合計** | **46件** | |

---

## 4. 不整合詳細（修正前・上位10件サンプル）

### 4-1. location_code→locations（30件）

| ファイル | row# | id | 不正値 |
|---------|------|----|--------|
| inventory.json | 2 | 2 | 3AP-01-001 |
| inventory.json | 3 | 3 | 3AP-01-002 |
| inventory.json | 7 | 7 | 3BT-02-002 |
| inventory.json | 8 | 8 | 1AM-01-001 |
| inventory.json | 9 | 9 | 1AM-01-002 |
| inventory.json | 10 | 10 | 3BT-01-003 |
| inventory.json | 11 | 11 | 3BT-01-004 |
| inventory.json | 12 | 12 | 3AP-01-003 |
| inventory.json | 13 | 13 | 3AP-01-004 |
| inventory.json | 14 | 14 | 3AP-03-001 |
| ... (以下20件省略) | | | |

**不整合ユニーク値（22種）:**
```
1AM-01-001, 1AM-01-002, 1AM-02-001, 1AM-02-002,
1AR-99-001,
3AP-01-001, 3AP-01-002, 3AP-01-003, 3AP-01-004, 3AP-01-005, 3AP-01-006,
3AP-03-001, 3AP-04-001,
3BT-01-003, 3BT-01-004,
3BT-02-001, 3BT-02-002, 3BT-02-003, 3BT-02-004, 3BT-02-005, 3BT-02-006,
3BT-03-001
```

### 4-2. product_code→products（16件）

| ファイル | row# | id | 不正値 |
|---------|------|----|--------|
| inventory.json | 7 | 7 | SKU-EC001-002 |
| inventory.json | 9 | 9 | SKU-PR001-002 |
| inventory.json | 10 | 10 | SKU-AP001-003 |
| inventory.json | 11 | 11 | SKU-AP001-004 |
| inventory.json | 12 | 12 | SKU-MK001-004 |
| inventory.json | 13 | 13 | SKU-MK001-005 |
| inventory.json | 14 | 14 | SKU-MK001-006 |
| inventory.json | 15 | 15 | SKU-EC001-003 |
| inventory.json | 16 | 16 | SKU-EC001-004 |
| inventory.json | 17 | 17 | SKU-PR001-003 |
| ... (以下6件省略) | | | |

**不整合ユニーク値（16種）:**
```
SKU-AP001-003, SKU-AP001-004, SKU-AP001-005, SKU-AP001-006,
SKU-EC001-002, SKU-EC001-003, SKU-EC001-004, SKU-EC001-005,
SKU-MK001-004, SKU-MK001-005, SKU-MK001-006, SKU-MK001-007, SKU-MK001-008,
SKU-PR001-002, SKU-PR001-003, SKU-PR001-004
```

---

## 5. 根本原因

**マスターファイルがデータより少ない状態。**

- `inventory.json` は25件の在庫レコードを持つが、`locations.json`（17件）と`products.json`（12件）がその全ロケーション・商品をカバーしていなかった
- `inventory/transactions.json` も存在しない `1AR-99-001`（返品エリア）を参照していた
- `picking-tasks/pending.json` も `inventory.json` と同じ欠損ロケーションを参照

---

## 6. 修正方針

**46件 < 50件** のため、api/*.json を直接修正する方針を採用（正規化スクリプトは不要）。

参照先データ（在庫・取引・ピッキング）が正であるとみなし、**マスターに不足レコードを追加**する方針とした。

---

## 7. 実施した修正

### 7-1. locations.json：22件追加（17→39件）

| 追加コード | floor | zone | type | aisle | owner_scope | owner_code |
|-----------|-------|------|------|-------|-------------|------------|
| 1AM-01-001 | 1 | A | M | 01 | dedicated | PR001 |
| 1AM-01-002 | 1 | A | M | 01 | dedicated | PR001 |
| 1AM-02-001 | 1 | A | M | 02 | dedicated | PR001 |
| 1AM-02-002 | 1 | A | M | 02 | dedicated | PR001 |
| 1AR-99-001 | 1 | A | R | 99 | shared | null |
| 3AP-01-001〜006 | 3 | A | P | 01 | dedicated | MK001 |
| 3AP-03-001 | 3 | A | P | 03 | dedicated | MK001 |
| 3AP-04-001 | 3 | A | P | 04 | dedicated | MK001 |
| 3BT-01-003〜004 | 3 | B | T | 01 | dedicated | AP001 |
| 3BT-02-001〜006 | 3 | B | T | 02 | dedicated | AP001 |
| 3BT-03-001 | 3 | B | T | 03 | dedicated | AP001 |

owner_code推定根拠：
- `3BT-*` → AP001（既存 3BT-01-001/002 が AP001 専用）
- `3AP-*` → MK001（既存 3AP-02-001/002 が MK001 専用）
- `1AM-*` → PR001（inventory.json で当ロケを参照する行の owner_code が PR001）
- `1AR-99-001` → shared（返品エリア・特定荷主専用でない）

### 7-2. products.json：16件追加（12→28件）

| 追加コード | owner_code | 商品名 | JAN |
|-----------|-----------|--------|-----|
| SKU-AP001-003 | AP001 | ポロシャツ Mサイズ | 4902345678003 |
| SKU-AP001-004 | AP001 | ジャケット Mサイズ | 4902345678004 |
| SKU-AP001-005 | AP001 | スニーカー 26cm | 4902345678005 |
| SKU-AP001-006 | AP001 | バッグ Mサイズ | 4902345678006 |
| SKU-EC001-002 | EC001 | EC人気商品A | 4903456789002 |
| SKU-EC001-003 | EC001 | EC人気商品B | 4903456789003 |
| SKU-EC001-004 | EC001 | EC人気商品C | 4903456789004 |
| SKU-EC001-005 | EC001 | EC人気商品D | 4903456789005 |
| SKU-MK001-004 | MK001 | 洗顔フォーム 200ml | 4901234567004 |
| SKU-MK001-005 | MK001 | ボディソープ 400ml | 4901234567005 |
| SKU-MK001-006 | MK001 | 化粧水 120ml | 4901234567006 |
| SKU-MK001-007 | MK001 | 乳液 120ml | 4901234567007 |
| SKU-MK001-008 | MK001 | 美容液 30ml | 4901234567008 |
| SKU-PR001-002 | PR001 | 産業用カメラB | 4904567890002 |
| SKU-PR001-003 | PR001 | 産業用センサーA | 4904567890003 |
| SKU-PR001-004 | PR001 | 産業用センサーB | 4904567890004 |

---

## 8. 修正後検証結果

```
✅ FK mismatches: 0 — all references resolved
locations master: 39件（修正後）
products master:  28件（修正後）
```

**全FKペア 不整合 0件 達成。**

---

## 9. 残課題・注意事項

1. **空ファイル4件**（csv-format-masters.json / inventory-snapshots.json / inventory/move.json / stocktake-sessions.json）は検査対象外。内容確認・復旧が必要。
2. **商品名はプレースホルダー**（EC人気商品A〜D 等）。実際の商品名が確定次第、products.jsonを更新すること。
3. **location owner_code の推定精度**：1AM 系は inventory.json の参照行から PR001 と推定したが、実際の倉庫レイアウト設計と照合推奨。
4. **JAN コード**：連番で付番したが、実際のバーコードとの突合は別途実施すること。

---

## 10. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `test2-mirror/api/locations.json` | 22件追加（17→39件） |
| `test2-mirror/api/products.json` | 16件追加（12→28件） |
| `specs/BUG_HUNT_Q5_REPORT.md` | 本レポート新規作成 |
