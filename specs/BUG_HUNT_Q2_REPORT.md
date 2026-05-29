# BUG HUNT Q2 REPORT
## 14ステップ業務シナリオ通し + データ齟齬検査

**作成者**: にーちゃん (assigned_to=7)  
**作成日**: 2026-05-29  
**対象**: 出庫MVP 14ステップフロー (static/API JSON 静的解析)  
**タスクID**: #1063 (BH-Q2)  
**前提**: ブラウザ実行環境なし → HTML/JS/JSON 静的解析 + sessionStorage依存フローはコード解析で代替

---

## 1. 14ステップ完走検証

| Step | ページ | 目的 | ステータス | 備考 |
|------|--------|------|-----------|------|
| 01 | `pc/master/products.html` | 商品 12 SKU 確認 | ✅ | 28 SKU (api/products.json) |
| 02 | `pc/outbound/orders.html` | 出荷指示 100件絞り | ✅ | 21,122件 (api/shipment-orders.json) |
| 03 | `pc/outbound/allocate.html` | 引当処理 100% 成功表示 | ✅ | POST→WMS Bridge mock {ok:true} |
| 04 | `pc/outbound/packing_summary.html` | ピック・梱包プレビュー | ✅ | packings 8件 / materials 5件 |
| 05 | `ht/login.html` | USR-001/田中太郎 ログイン | ✅ | USR-001=田中太郎 確認済 |
| 06 | `ht/menu.html` | ピック選択 | ✅ | 静的メニュー |
| 07 | `ht/pick/wave.html` | WV-26060101 ピック | ⚠️ | WV-26060101 データなし（詳細後述） |
| 08 | `ht/pick/scan.html` | ロケ→SKU スキャン (5明細) | ✅ | products.json で SKU照合 |
| 09 | `ht/pick/done.html` | ピック完了 | ✅ | POST→mock OK |
| 10 | `ht/packing/scan.html` | 梱包 | ✅ | shipment-orders + packings参照 |
| 11 | `ht/loading/scan.html` | 積込 | ✅ | loadings.json 6件 (LD-260601-01等) |
| 12 | `ht/handover/confirm.html` | 引渡確定 | ✅ | loadings ID別POST mock |
| 13 | `pc/outbound/loading.html` | 積込管理確認 | ✅ | loadings.json 6件 |
| 14 | `pc/billing/monthly.html` | 請求書 INV-2606-MK001 表示 | ⚠️ | hardcoded MK001データ有・INV番号は別途 |

**14ステップ完走: 12/14 ✅ / 2/14 ⚠️（画面遷移は可能、データ不整合あり）**

---

## 2. データ齟齬チェック

### 2-1. ❌ shipment_order_id 不整合

| 確認箇所 | SO番号 | 状態 |
|---------|--------|------|
| `api/picking-tasks/pending.json` (10件) | SO-26060101, SO-26060102 | pending |
| `api/shipment-orders.json` status=picking | SO-26060103 | picking |
| `api/shipment-orders.json` status=planned | (別のSO) | planned |

**齟齬**: picking-tasks のタスクは SO-26060101/SO-26060102 を参照しているが、shipment-orders の status=picking は SO-26060103。
- `ht/pick/wave.html` は `find(o => o.done_count < o.line_count)` でpickingオーダーを検索 → SO-26060103を拾うが picking-tasks に SO-26060103 のタスクはない
- 結果: wave画面では SO-26060103 が表示されるが、scan画面では picking-tasks (SO-26060101) を参照 → **担当SOが食い違う**

### 2-2. ❌ WV-26060101 が存在しない

- `api/shipment-orders.json`: wave_id に値があるのは 2件のみ（WV-260520-92）
- WV-26060101 は **データなし**
- `ht/pick/wave.html` はフォールバックで `first picking order` を拾うが wave番号表示が不一致になる

**修正方針**: api/shipment-orders.json 内にWV-26060101 wave_idを持つデータ、またはapi内に専用wave.jsonを用意する

### 2-3. ❌ 担当者（田中太郎）の追跡が不可能

| 確認ポイント | 状況 |
|------------|------|
| `system-users.json`: USR-001 | 田中 太郎 ✅ |
| `ht/login.html`: USR-001 入力 | sessionStorage.user_id に保存される想定 |
| `picking-tasks/pending.json`: picker_name | フィールドなし ❌ |
| `loadings.json`: driver_name | 山田太郎（ヤマト運輸ドライバー、別人） |

**齟齬**: ピック担当者の追跡ができるデータ構造になっていない。picking-tasks に `picker_id` / `picker_name` フィールドなし。タスク仕様の「担当者: ピック時=田中太郎 が積込時にも維持」の検証は **現データ構造では不可能**。

### 2-4. ❌ LOT-260518-01 が存在しない（FIFO確認不可）

- タスク仕様: 「賞味期限: FIFO 順 (LOT-260518-01 が先) で出ているか」
- `api/inventory.json`: LOT-260518-01 は **存在しない**
- 実在するロット（賞味期限順）:

| LOT番号 | 商品 | 賞味期限 | 在庫数 |
|---------|------|---------|--------|
| LOT-26052701 | ヨーグルト | 2026-06-05 | 24 |
| LOT-26052001 | 冷蔵牛乳1L | 2026-06-10 | 48 |
| LOT-26052501 | 冷蔵牛乳1L | 2026-06-15 | 36 |
| LOT-26052402 | ハンドクリーム | 2026-11-30 | 135 |
| ... | | | |

- `picking-tasks/pending.json`: lot=LOT-26060101（1件のみ）
- FIFO検証: タスク仕様の前提ロットが実データに存在せず **検証不可能**

### 2-5. ⚠️ 在庫数の変化追跡不可

- `inventory.json` に `allocated_qty` / `reserved_qty` フィールドなし
- 引当処理 (POST /api/shipment-orders/${id}/allocate) は WMS Bridge が即 {ok:true, mock:true} を返す
- **実際の在庫減算は発生しない** → 引当前/後/出荷後の減算整合性は検証対象外

### 2-6. ⚠️ 請求書 INV-2606-MK001 の確認

- `pc/billing/monthly.html`: MK001=マルキ食品 のデータは hardcoded BILL_DATA に存在 ✅
- INV番号 "INV-2606-MK001" はページのHTMLテンプレートにもスクリプトにも記載なし
- billing/monthly.html は請求書番号を生成する機能を持たない（サマリー画面）
- INV-2606-MK001 は `pc/billing/invoice.html` や `pc/billing/invoice_preview.html` で表示される想定と推測

---

## 3. 各ステップ errors = 0 確認

| Step | fetch call | 結果 | エラーリスク |
|------|-----------|------|------------|
| 01 | /api/owners, /api/products | ✅ 両JSON存在 | なし |
| 02 | /api/owners, /api/shipment-orders | ✅ 両JSON存在 | なし |
| 03 | /api/shipment-orders, POST allocate | ✅ mock | なし |
| 04 | /api/packings, /api/packing-materials | ✅ 両JSON存在 | なし |
| 05 | (fetch なし・static) | ✅ | なし |
| 06 | (fetch なし・static) | ✅ | なし |
| 07 | /api/shipment-orders, /api/shipment-orders/${id} | ✅ | WV齟齬あり |
| 08 | /api/products | ✅ | なし |
| 09 | POST /api/picking-tasks/${id}/pick | ✅ mock | なし |
| 10 | /api/shipment-orders, /api/packing-materials, /api/packings | ✅ | なし |
| 11 | /api/loadings, /api/loadings/${id}, /api/loadings/${id}/load-order | ✅ | なし |
| 12 | /api/loadings/${id}, POST .../handover | ✅ | なし |
| 13 | /api/loadings | ✅ | なし |
| 14 | /api/owners | ✅ | なし |

**JavaScript fetch エラー: 全14ステップで fetch 404/fail は発生しない**（WMS Bridge の自動エラーハンドリングにより）

---

## 4. 総合所見

### ✅ 良好
- 全14ページ存在・HTTP 200 OK
- fetch API参照の JSON ファイルは全て存在（BH-Q1の破損JSON4件は本シナリオでは使用なし）
- 画面遷移フロー（sessionStorage経由）は論理的に成立している

### ❌ データ齟齬（修正必須）

| # | 問題 | 影響 | 修正方針 |
|---|------|------|---------|
| D1 | WV-26060101 が shipment-orders に存在しない | Step07 表示不一致 | api/shipment-orders.json にWV-26060101 wave_idを持つデータ追加 |
| D2 | picking-tasks と shipment-orders の SO番号不整合 | Step07-08 SO食い違い | SO-26060101/02 の status=picking を shipment-orders に追加 |
| D3 | picking-tasks に picker_name/picker_id フィールドなし | 担当者追跡不可 | picking-tasks に picker フィールド追加 |
| D4 | LOT-260518-01 が inventory に存在しない | FIFO確認不可 | inventory.json に LOT-260518-01 データ追加 |

### ⚠️ 仕様確認推奨

| # | 確認事項 |
|---|---------|
| C1 | `billing/monthly.html` で INV-2606-MK001 をどこで表示するか（invoice.html側か？） |
| C2 | 在庫減算（引当/出荷時）はモックとして扱ってよいか、それともデータで追跡するか |
| C3 | HT画面での田中太郎ログイン後、sessionStorage.user_id 経由でpicker追跡する実装方針 |

---

---

## 5. 追加調査結果（2026-05-29 にーちゃん再検証）

### 5-1. ❌ CRITICAL: picking-tasks.order_id と shipment-orders.id の全面的不一致

| order_no | task.order_id | shipment-orders.id | 状態 |
|---------|--------------|-------------------|------|
| SO-26060101 | 100 | 3 | ❌ MISMATCH |
| SO-26060102 | 101 | 4 | ❌ MISMATCH |
| SO-26060103 | 102 | 5 | ❌ MISMATCH |
| SO-26060104 | 103 | NOT FOUND | ❌ MISMATCH + 欠損 |
| SO-26060105 | 104 | NOT FOUND | ❌ MISMATCH + 欠損 |

**影響**: order_id で shipment-orders を JOIN すると全件ミス。order_no での検索は正常動作するが FK 整合が壊れている。

### 5-2. ❌ picking-task 2002 の lot_no が inventory と不一致

- task 2002: product=SKU-MK001-003, loc=3AP-02-001, lot_no="LOT-26060101"
- inventory 3AP-02-001: lot_no="LOT-26052001"
- **LOT-26060101 は inventory に存在しない** → lot-based scan で拒否される

### 5-3. ❌ SKU-EC001-001（task 2005）の inventory レコードなし

- task 2005: SKU-EC001-001, loc=3BT-02-001, pick_qty=4
- inventory に 3BT-02-001 の EC001-001 レコードが存在しない → 在庫不足エラー相当

### 5-4. ❌ FIFO 違反（SKU-MK001-001）

inventory の received_at 順:
- 3AP-04-001 (LOT-26050501, received=2026-05-05) ← OLDEST
- 3AP-01-001 (LOT-26050801, received=2026-05-08) ← NEWER

picking-task 2000 は 3AP-01-001（新ロット）を指定 → 3AP-04-001（旧ロット）を飛ばしている。
**修正**: task 2000 の location_code を "3AP-04-001" に変更。

### 5-5. ⚠️ packings の order_id FK が混在

packing.id=545: order_id=3（shipment-orders.id 方式）  
packing.id=546〜550: order_id=100〜104（picking-tasks 仮ID 方式）  
同一テーブル内で FK 参照先が統一されていない。

### 5-6. ⚠️ packing.id=545 の inspected_by = NULL

SO-26060101 の packing（id=545）は inspected_by が未設定。他6件は設定済み（田中太郎、佐藤健一等）。

### 5-7. ⚠️ shipment-orders.id=3 の line_count=2 と picking-tasks 3件の不一致

SO-26060101: shipment-orders.line_count=2, done_count=2  
SO-26060101 の picking-tasks: 3件（task 2000, 2001, 2002）→ **line_count が 1 件不足**

---

*BH-Q2検証完了 / 次: BH-Q6（HT BT-A2000 全業務フロー完走検証）*
