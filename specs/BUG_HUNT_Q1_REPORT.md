# BUG HUNT Q1 REPORT
## 全479画面 preview 巡回・errors/console 全収集レポート

**作成者**: にーちゃん (assigned_to=7)  
**作成日**: 2026-05-29  
**対象**: https://ytokiyoshi-hub.github.io/wms-project-hub/test2-mirror 配下 全 479 HTML  
**タスクID**: #1062 (BH-Q1)

---

## 1. HTTP ステータス集計

| ステータス | 件数 |
|-----------|------|
| **200 OK** | **479** |
| Non-200 | 0 |
| **合計** | **479** |

**判定: ✅ 全479ページ HTTP 200 OK**

---

## 2. 静的リソース（JS/CSS）検査

| 検査項目 | 結果 |
|---------|------|
| 欠損 JS ファイル | 0件 ✅ |
| 欠損 CSS ファイル | 0件 ✅ (base タグにより正しく解決) |
| WMS Bridge 未搭載ページ | 0件 ✅ (全479ページ搭載) |

**補足**: `app/` 配下5画面は `href="css/app-mock.css"` を参照するが、WMS Bridge が `<base href="...test2-mirror/">` を設定するため `test2-mirror/css/app-mock.css` に正しく解決される（ファイル存在確認済み）。

---

## 3. ❌ CRITICAL: 破損 API JSON ファイル (HTML 404 ページが混入)

以下4ファイルは JSON ではなく GitHub Pages の `<!DOCTYPE html>` (404応答HTML) が格納されている。

| ファイル | サイズ | 内容 | 直接影響ページ |
|---------|--------|------|--------------|
| `api/csv-format-masters.json` | 161 bytes | `<!DOCTYPE html>...` | `pc/inbound/asn_template.html` |
| `api/inventory-snapshots.json` | 162 bytes | `<!DOCTYPE html>...` | (動的参照のみ・静的参照なし) |
| `api/stocktake-sessions.json` | 161 bytes | `<!DOCTYPE html>...` | (動的参照のみ・静的参照なし) |
| `api/inventory/move.json` | 157 bytes | `<!DOCTYPE html>...` | `pc/inventory/move.html` |

**ユーザー影響**: WMS Bridge の `.catch()` ハンドラが `logErr({fetchcatch: path})` を `localStorage.__wms_errs` に記録し、空配列 `[]` を返す。該当画面はデータ空表示になる。

**修正方針**: 各ファイルを正しい JSON データ（少なくとも `[]` または適切なスキーマの配列）に差し替えが必要。

### 直接影響ページ詳細

#### `pc/inbound/asn_template.html`
```
fetch('/api/csv-format-masters')
→ api/csv-format-masters.json が HTML 404 → 空配列返却 → テーブル空表示
```

#### `pc/inventory/move.html`
```
const r = await fetch('/api/inventory/move', { method: 'POST', ... })
→ api/inventory/move.json が HTML 404
→ POST は WMS Bridge が即座に {ok:true, mock:true} を返すため実は影響なし
  （GET の場合のみ影響あり）
```

---

## 4. ⚠️ WARNING: 空レコード JSON ファイル (有効な JSON だがデータなし)

| ファイル | レコード数 | 影響 |
|---------|-----------|------|
| `api/discrepancies.json` | 0件 | 検品差異画面が常に空表示 |
| `api/loadable-orders.json` | 0件 | 積込可能指示画面が空 |
| `api/putaway/pending.json` | 0件 | 棚入れ待ち画面が空 |
| `api/putaway-instructions.json` | 0件 | 棚入れ指示画面が空 |

**補足**: バグではなく「テストデータ未投入」の可能性が高い。実業務シナリオ検証（BH-Q2）の障害になるため確認要。

---

## 5. ⚠️ INFO: fetch() に .catch() なしのページ (27件)

WMS Bridge が `/api/` 全 fetch を傍受してエラー処理しているため実害は低いが、ブラウザの DevTools に Unhandled Rejection 警告が出る可能性がある。

| ページ | fetch件数 |
|--------|---------|
| `ht/handover/lane.html` | 1 |
| `ht/inspect/asn.html` | 2 |
| `ht/inspect/done.html` | 2 |
| `ht/loading/confirm.html` | 3 |
| `ht/owner/scan.html` | 3 |
| `ht/pick/list.html` | 1 |
| `ht/pick/scan.html` | 1 |
| `ht/pick/wave.html` | 2 |
| `ht/putaway/done.html` | 1 |
| `ht/putaway/instructions.html` | 1 |
| `ht/returns/scan.html` | 1 |
| `ht/stocktake/count.html` | 2 |
| `pc/inbound/diff_summary.html` | 1 |
| `pc/inbound/inbound_actions.html` | 2 |
| `pc/inbound/inbound_kpi.html` | 3 |
| `pc/inbound/inbound_priority.html` | 1 |
| `pc/inbound/inspection_status.html` | 3 |
| `pc/inbound/owner_acceptance.html` | 1 |
| `pc/inbound/partial_inbound.html` | 1 |
| `pc/inbound/plan_line_detail.html` | 2 |
| `pc/inventory/inventory_kpi.html` | 2 |
| `pc/inventory/lot_traceability.html` | 1 |
| `pc/inventory/summary.html` | 1 |
| `pc/inventory/transactions.html` | 1 |
| `pc/master/products.html` | 2 |
| `pc/outbound/loading.html` | 1 |
| `pc/outbound/packing_summary.html` | 2 |

---

## 6. API JSON ファイル整合性サマリー

| ファイル | レコード数 | 状態 |
|---------|-----------|------|
| `api/billing-snapshots.json` | 5 | ✅ |
| `api/carrier-routes.json` | 4 | ✅ |
| `api/carriers.json` | 4 | ✅ |
| `api/csv-format-masters.json` | - | ❌ HTML |
| `api/customers.json` | 4 | ✅ |
| `api/discrepancies.json` | 0 | ⚠️ 空 |
| `api/inbound-actuals.json` | 9,479 | ✅ |
| `api/inbound-schedules.json` | 6,337 | ✅ |
| `api/inventory.json` | 25 | ✅ |
| `api/inventory-adjustments.json` | 108 | ✅ |
| `api/inventory-snapshots.json` | - | ❌ HTML |
| `api/inventory/lots.json` | 5 | ✅ |
| `api/inventory/move.json` | - | ❌ HTML |
| `api/inventory/transactions.json` | 200 | ✅ |
| `api/loadable-orders.json` | 0 | ⚠️ 空 |
| `api/loadings.json` | 6 | ✅ |
| `api/locations.json` | 39 | ✅ |
| `api/owners.json` | 5 | ✅ |
| `api/packing-materials.json` | 5 | ✅ |
| `api/packings.json` | 8 | ✅ |
| `api/picking-tasks/pending.json` | 10 | ✅ |
| `api/products.json` | 28 | ✅ |
| `api/putaway-instructions.json` | 0 | ⚠️ 空 |
| `api/putaway/pending.json` | 0 | ⚠️ 空 |
| `api/returns.json` | 135 | ✅ |
| `api/shipment-actuals.json` | 21,119 | ✅ |
| `api/shipment-orders.json` | 21,122 | ✅ |
| `api/stocktake-sessions.json` | - | ❌ HTML |
| `api/system-users.json` | 10 | ✅ |
| `api/warehouses.json` | 3 | ✅ |

**集計**: ✅ 26件 / ❌ 4件(HTML混入) / ⚠️ 4件(空配列)

---

## 7. 完全空表示ページリスト (data取得失敗)

| ページ | 原因 | 症状 |
|--------|------|------|
| `pc/inbound/asn_template.html` | `csv-format-masters.json` が HTML | テーブル空表示 |
| `pc/inventory/move.html` | `inventory/move.json` が HTML (GET時のみ) | データ空表示 |

---

## 8. 総合所見

### ✅ 良好
- 全479ページ HTTP 200 OK
- WMS Bridge 全ページ搭載（fetchエラー自動ハンドリング・`localStorage.__wms_errs` ログ）
- JS/CSS 欠損ゼロ

### ❌ 修正必須
1. **api/csv-format-masters.json** → 正しいCSVフォーマット定義JSONに差し替え
2. **api/inventory-snapshots.json** → 在庫スナップショットJSONデータに差し替え（または `[]`）
3. **api/stocktake-sessions.json** → 棚卸セッションJSONデータに差し替え（または `[]`）
4. **api/inventory/move.json** → 在庫移動JSONデータに差し替え（または `[]`）

### ⚠️ 確認推奨
- `api/discrepancies.json`, `api/loadable-orders.json`, `api/putaway/pending.json`, `api/putaway-instructions.json` のデータ投入状況
- 27ページの fetch .catch() 追加（DevTools警告対策）

---

*BH-Q1検証完了 / 次: BH-Q2（14ステップ業務シナリオ通し検証）*
