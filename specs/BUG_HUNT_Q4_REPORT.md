# BUG_HUNT_Q4: 全画面フィルタ動作 網羅検証レポート

> 検証担当: にーちゃん (assigned_to=7)  
> 検証日時: 2026-05-30  
> 対象: test2-mirror/pc/ 配下 filter-row 含有 144 ファイル  
> タスク: #1065

---

## 1. 検証概要

### 対象・手法

| 項目 | 値 |
|------|-----|
| filter-row 含有ファイル総数 | **144ファイル** |
| 検証ディレクトリ | `test2-mirror/pc/` |
| 検索キーワード | `filter-row`, `f-status`, `f-owner`, `id="f-*"` |
| 検証方法 | grep による全ファイル走査 + 個別 HTML 読み込みによるコード確認 |

### バグ分類サマリー

| 分類 | 件数 | 説明 |
|------|------|------|
| **BUG-A** | **9件** | 検索ボタンがモックアラート、フィルタ関数未実装 |
| **BUG-B** | **8件** | `onclick="render()"` あるが `render` 関数未定義 → ReferenceError |
| **BUG-C** | **2件** | f-* 入力あり、検索ボタンなし、JS なし → フィルタ操作不可 |
| 正常（alert あり・実動作） | 2件 | alert ボタンあるが `oninput` で動作 |
| 静的モック（後続フェーズ） | ~57件 | filter-row あるが JS 未実装（設計上の後回し） |

**確認済みバグ合計: 19件**

---

## 2. BUG-A: 検索ボタンがモックアラート、フィルタ未実装（9件）

クリックしても `alert('「検索」モック動作（実装は後続フェーズ）')` が出るだけで、  
フィルタ関数（render / loadData / filterRows）も `oninput` / `onchange` も存在しない。

| ファイル | フィルタ入力要素 | 備考 |
|---------|--------------|------|
| `pc/workforce/employees.html` | `f-q` (氏名/従業員No) | 従業員一覧 |
| `pc/stocktake/sessions.html` | `f-q` (セッションNo) | 棚卸セッション一覧 |
| `pc/master/routes.html` | `f-q` (便名/方面) | 配送ルートマスタ |
| `pc/master/materials.html` | `f-q` (資材名) | 資材マスタ |
| `pc/master/drivers.html` | `f-q` (氏名/配送業者) | ドライバーマスタ |
| `pc/master/picking_areas.html` | `f-q` (エリア名) | ピッキングエリアマスタ |
| `pc/master/carriers.html` | `f-q` (キャリア名) | 配送業者マスタ |
| `pc/outbound/tracking.html` | `f-q`, `f-date` | 配送追跡 |
| `pc/outbound/waves.html` | `f-status`, `f-owner`, `f-date` (推定) | ウェーブ一覧 |

**再現手順（共通）:**
1. 画面を開く
2. フィルタ入力欄に値を入力
3. 「検索」ボタンをクリック
4. `alert('「検索」モック動作（実装は後続フェーズ）')` が表示されるだけでテーブルは変化しない

---

## 3. BUG-B: onclick="render()" あるが render 関数未定義（8件）

検索ボタンに `onclick="render()"` が設定されているが、ページ内に `render` 関数が定義されていない。  
ブラウザコンソールに `Uncaught ReferenceError: render is not defined` が出力され、フィルタが動作しない。

| ファイル | フィルタ入力要素 | 備考 |
|---------|--------------|------|
| `pc/master/rates.html` | `f-owner`, `f-type` | レートマスタ |
| `pc/inventory/snapshots.html` | `f-owner`, `f-date` | 在庫スナップショット |
| `pc/outbound/order_actuals.html` | `f-owner`, `f-date` | 出荷実績 |
| `pc/outbound/shipment_send.html` | `f-owner`, `f-date`, `f-status` | 出荷送信 |
| `pc/returns/list.html` | `f-no`, `f-owner`, `f-st` | 返品一覧 |
| `pc/billing/invoice.html` | `f-year`, `f-owner`, `f-status` | 請求書一覧 |
| `pc/billing/monthly.html` | `f-month`, `f-owner` | 月次請求 |
| `pc/reports/kpi.html` | `f-period`, `f-owner`, `f-type` | KPIレポート |

**再現手順（共通）:**
1. 画面を開く（ブラウザ DevTools Console を開いておく）
2. フィルタ入力欄に値を入力
3. 「検索」ボタンをクリック
4. Console に `Uncaught ReferenceError: render is not defined` が出力される
5. テーブルは変化しない

**確認コード（対象ファイル共通パターン）:**
```html
<!-- 検索ボタン: render() を呼ぶが... -->
<button class="btn primary" onclick="render()">検索</button>

<!-- JavaScript: f-owner の option を動的に追加するだけで render 関数なし -->
<script>
(async () => {
  const owners = await fetch('/api/owners').then(r=>r.json()).catch(()=>[]);
  const sel = document.getElementById('f-owner');
  owners.forEach(o => { ... sel.appendChild(opt); });
})();
</script>
```

---

## 4. BUG-C: f-* 入力あり・ボタンなし・JS なし（2件）

フィルタ入力要素（`id="f-*"` パターン）があるが、  
検索ボタンも `oninput` / `onchange` イベントも存在せず、入力しても何も起きない。

| ファイル | フィルタ入力要素 | 備考 |
|---------|--------------|------|
| `pc/master/jan_check.html` | `f-jan`, `f-owner` | JANコード確認 |
| `pc/master/postal_regions.html` | `f-zip` | 郵便番号地域マップ |

---

## 5. 正常動作（alert あるが実際はフィルタ動作する）

以下2ファイルは、検索ボタンに alert が設定されているが、  
`addEventListener('input', render)` によるリアルタイムフィルタが実装されており動作する。

| ファイル | 実装方式 | 備考 |
|---------|---------|------|
| `pc/master/owners.html` | `oninput` → `function render()` | 荷主マスタ（検索ボタンは後続）|
| `pc/master/warehouses.html` | `oninput` → `function render()` | 倉庫マスタ（検索ボタンは後続）|

---

## 6. フィルタ実装済み（正常）代表例

以下の画面はフィルタが完全実装されており、正常動作を確認済み。

| ファイル | フィルタ要素 | 動作方式 | JS実装 |
|---------|-----------|---------|--------|
| `pc/outbound/orders.html` | f-owner, f-status, f-customer | onclick → render() | ✅ |
| `pc/inventory/transactions.html` | f-owner, f-type, f-loc | onclick → render() | ✅ |
| `pc/master/products.html` | f-owner, f-code, f-name, f-temp | onclick → render() | ✅ |
| `pc/inbound/plans.html` | f-owner, f-status, f-date, f-supplier | onclick → render() | ✅ |
| `pc/inventory/lot_traceability.html` | f-product, f-lot | onclick → loadData() | ✅ |
| `pc/master/users.html` | f-q, f-owner, f-role | oninput → render() | ✅ |
| `pc/master/customers.html` | f-q, f-owner | oninput → render() | ✅ |
| `pc/master/locations.html` | f-q, f-zone, f-type | oninput → render() | ✅ |

---

## 7. 静的モック（後続フェーズ設計）

以下カテゴリの画面は filter-row を持つが JS 未実装。  
これらは画面レイアウト確定済み・機能実装は後続フェーズという設計方針による。

| カテゴリ | ファイル数 | 代表画面 |
|---------|---------|--------|
| `pc/audit/` | 8 | log.html, data_change.html, sox_compliance.html |
| `pc/stocktake/` | 3 | detail.html, cycle_history.html, request.html |
| `pc/workforce/` | 4 | shifts.html, attendance.html, assignment.html |
| `pc/integration/` | 5 | erp_sync.html, data_sync_dashboard.html |
| `pc/master/` (その他) | ~20 | notification_rules.html, sku_branches.html 等 |
| `pc/inventory/` (一部) | ~10 | lot_rotation.html, forecast.html 等 |
| 合計 | ~57 | — |

---

## 8. バグ候補の検証結果

タスク仕様書に記載されていた3つのバグ候補について:

### 候補1: 検索ボタンが存在しない画面 (oninput onchange なし)

**→ 確認済み: BUG-C として 2件 該当 + BUG-A の 9件が実質的に同状態**

oninput/onchange もなく、ボタンクリックで何も起きない実質フィルタ不能画面が **11件**。

### 候補2: option value=未設定で「全件」が空文字でフィルタが効かない

**→ 誤検知: 実際はバグではない**

多数の画面で `<option value="">全件</option>` が使用されているが、  
JavaScript 側のフィルタロジックは `if (o && r.owner_code !== o) return false;` のパターンで実装されており、  
空文字列 `""` は falsy のためフィルタスキップ = 全件表示として正しく動作している。

```javascript
// orders.html 検証コード（正常動作）
const o = document.getElementById('f-owner').value;  // "" のとき
if (o && r.owner_code !== o) return false;  // "" は falsy → この条件スキップ → 全件表示 ✅
```

### 候補3: table.list-full に対する filter 実装漏れ (id="tb" 直接 innerHTML する画面)

**→ 誤検知: id="tb" 直接操作は実装の標準パターン**

`getElementById('tb').innerHTML` による直接操作は 20件以上で使用されているが、  
XSS 対策として全ファイルに `esc()` / `escapeHtml()` 関数が定義されており、  
データは適切にエスケープされて挿入されている。実装漏れではなく標準実装パターン。

```javascript
// transactions.html 確認コード（正常パターン）
const tb = document.getElementById('tb');
tb.innerHTML = rows.map(r => `
  <tr>
    <td>${esc(r.date)}</td>      <!-- esc() でエスケープ済み -->
    <td>${esc(r.product)}</td>
  </tr>
`).join('');
```

---

## 9. 起票推奨バグ

### Priority HIGH（ユーザー影響大）

| # | ファイル | バグ種別 | 推定影響 |
|---|---------|---------|---------|
| 1 | `pc/returns/list.html` | BUG-B (ReferenceError) | 返品一覧が検索不可 |
| 2 | `pc/billing/invoice.html` | BUG-B (ReferenceError) | 請求書一覧が検索不可 |
| 3 | `pc/billing/monthly.html` | BUG-B (ReferenceError) | 月次請求が検索不可 |
| 4 | `pc/outbound/shipment_send.html` | BUG-B (ReferenceError) | 出荷送信が絞り込み不可 |
| 5 | `pc/outbound/tracking.html` | BUG-A (モックのみ) | 配送追跡の検索が機能しない |

### Priority MEDIUM（業務フロー影響）

| # | ファイル | バグ種別 | 推定影響 |
|---|---------|---------|---------|
| 6 | `pc/outbound/order_actuals.html` | BUG-B | 出荷実績絞り込み不可 |
| 7 | `pc/inventory/snapshots.html` | BUG-B | 在庫スナップショット絞り込み不可 |
| 8 | `pc/reports/kpi.html` | BUG-B | KPIレポートの絞り込み不可 |
| 9 | `pc/master/rates.html` | BUG-B | レートマスタ検索不可 |
| 10 | `pc/outbound/waves.html` | BUG-A | ウェーブ一覧の検索機能しない |

### Priority LOW（マスタ画面・後続フェーズ候補）

| # | ファイル | バグ種別 | 推定影響 |
|---|---------|---------|---------|
| 11 | `pc/master/materials.html` | BUG-A | 資材マスタ検索不可 |
| 12 | `pc/master/routes.html` | BUG-A | ルートマスタ検索不可 |
| 13 | `pc/master/carriers.html` | BUG-A | 配送業者マスタ検索不可 |
| 14 | `pc/master/drivers.html` | BUG-A | ドライバーマスタ検索不可 |
| 15 | `pc/master/picking_areas.html` | BUG-A | ピッキングエリア検索不可 |
| 16 | `pc/stocktake/sessions.html` | BUG-A | 棚卸セッション検索不可 |
| 17 | `pc/workforce/employees.html` | BUG-A | 従業員一覧検索不可 |
| 18 | `pc/master/jan_check.html` | BUG-C | JAN確認フォームのフィルタ不可 |
| 19 | `pc/master/postal_regions.html` | BUG-C | 郵便番号検索不可 |

---

## 10. 修正方針

### BUG-B（Priority HIGH）: render 関数の実装

**修正テンプレート（returns/list.html を例に）:**
```javascript
// 以下を <script> 内に追加
let allRows = [];

async function loadOwners() {
  const owners = await fetch('/api/owners').then(r=>r.json()).catch(()=>[]);
  const sel = document.getElementById('f-owner');
  owners.forEach(o => { const opt = document.createElement('option'); opt.value = o.code; opt.textContent = `${o.code} ${o.name}`; sel.appendChild(opt); });
}

async function loadData() {
  allRows = await fetch('/api/returns').then(r=>r.json()).catch(()=>[]);
  render();
}

function render() {
  const o = document.getElementById('f-owner').value;
  const st = document.getElementById('f-st').value;
  const no = document.getElementById('f-no').value.trim().toLowerCase();
  const rows = allRows.filter(r => {
    if (o && r.owner_code !== o) return false;
    if (st && r.status !== st) return false;
    if (no && !(r.return_no||'').toLowerCase().includes(no)) return false;
    return true;
  });
  const tb = document.getElementById('tb');
  tb.innerHTML = rows.map(r => `<tr>...</tr>`).join('');
}

loadOwners();
loadData();
```

### BUG-A（Priority MEDIUM）: alert を render() 呼び出しに置き換え

```html
<!-- 変更前 -->
<button class="btn primary" onclick="alert('「検索」モック動作（実装は後続フェーズ）')">検索</button>

<!-- 変更後 -->
<button class="btn primary" onclick="render()">検索</button>
```

---

## 11. 検証方法論

本検証で使用したコマンド:

```bash
# filter-row 含有ファイル一覧
grep -rl 'filter-row' --include='*.html'

# 検索ボタンがモックアラートのファイル
grep -rl "onclick.*alert.*検索.*モック動作" --include='*.html'

# filter-rowあり・render関数なし・f-*入力ありのファイル
for f in $(grep -rl 'filter-row' ...); do
  HAS_FUNC=$(grep -c 'function render|function loadData' "$f");
  HAS_INPUT=$(grep -c 'id="f-' "$f");
  if [ "$HAS_FUNC" -eq 0 ] && [ "$HAS_INPUT" -gt 0 ]; then echo "$f"; fi;
done

# onclick="render()" あるが render 定義なしのファイル
grep -n "render" <file> | grep -v "function render|render ="
```

---

*検証完了: 2026-05-30*  
*にーちゃん (QA担当, assigned_to=7)*
