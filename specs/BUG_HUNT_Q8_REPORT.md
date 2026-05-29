# BUG_HUNT_Q8_REPORT.md — エッジケース挙動検証

タスク: BH-Q8 (#1069)  
実施日: 2026-05-29  
担当: さーちゃん (assigned_to=5)

## 検証方法

ブラウザ非使用・静的コード解析により全ケース（A〜E）を検証。  
対象: `test2-mirror/` 配下の HTML / JS / JSON ファイル。  
主要調査ファイル:
- `pc/outbound/packing_summary.html`, `loading.html`, `handover.html`, `orders.html`
- `pc/master/products.html`
- `js/common-layout.js`, `js/common-inout-stats.js`, `js/common-master-stats.js`
- Bootstrap hook (全 HTML `<head>` インラインスクリプト)
- `api/owners.json`, `api/products.json`, `api/loadings.json`, `api/shipment-orders.json`

---

## 検証結果サマリ

| ケース | 判定 | バグ/注意点 |
|--------|------|------------|
| A. 空配列 fetch | ✅ 正常 | なし |
| B. null/undefined ハンドリング | ✅ 正常 | INFO 1件 |
| C. 特殊文字耐性 | ✅ 正常 | LOW 1件 |
| D. 大量データ負荷 | ⚠️ 要改善 | MEDIUM 1件 / LOW 1件 |
| E. クエリ filter エッジ | ✅ 正常 | INFO 1件 |

**検出バグ合計: 1 MEDIUM / 1 LOW / 2 INFO**

---

## A. 空配列 fetch 挙動

### 想定テスト条件
- `api/owners.json` を `[]` に書き換えた場合を想定したコード解析
- `api/packings.json`, `api/loadings.json` 等を `[]` に書き換えた場合も含む

### 挙動表

| 確認箇所 | コード | 挙動 | 結果 |
|---------|--------|------|------|
| Bootstrap hook `applyF([], q)` | `[].filter(fn)` | `[]` を返す | ✅ 正常 |
| `orders.html` オーナーセレクト | `owners.forEach(o => ...)` | 空の場合 `<option value="">全件</option>` のみ残存 | ✅ 崩れなし |
| `orders.html` 検索結果 0件 | `rows.length === 0` → `tb.innerHTML = '...該当データなし...'` | "該当データなし" 表示 | ✅ 正常 |
| `packing_summary.html` packings=[] | `matArr.length === 0` → `'本日の梱包実績なし'` | データなし表示 | ✅ 正常 |
| `packing_summary.html` recent=[] | `recent.length === 0` → `'実績なし'` | データなし表示 | ✅ 正常 |
| `loading.html` loadings=[] | `list.length === 0` → `'積込計画なし'` + `return` | データなし表示 | ✅ 正常 |
| サイドバー (common-layout.js) | `window.NAV_ITEMS` ベース（owners.json 非依存） | 影響なし | ✅ 正常 |
| fetch エラー時 | `.catch(function(){ return R([]) })` | `[]` 返却でクラッシュなし | ✅ 正常 |

**判定: 空配列で画面崩れなし。全画面で "データなし" 系メッセージが正しく表示される。**

---

## B. null/undefined 値ハンドリング

### 想定テスト条件
- `api/products.json` の1件の `jan_code` を `null` に設定
- `api/products.json` の1件の `name` (商品名) を `""` (空文字) に設定

### 挙動表

| 確認箇所 | コード | 挙動 | 結果 |
|---------|--------|------|------|
| `products.html:199` JAN欠損カウント | `!p.jan_code \|\| !p.jan_code.trim()` | null → `!p.jan_code` true → ショートサーキット → janMissing++ | ✅ 安全 |
| `products.html:205-206` JAN欠損 UI | `qJan.textContent = N件` / `qJan.className = 'val alert'` | **赤文字アラート** で件数表示 | ✅ 発火確認 |
| `products.html:272` JAN欠損フィルタ | `qualityFilter('jan-missing')` クリックで絞り込み | null JANの行だけ表示される | ✅ 正常 |
| `products.html:295` テーブル表示 | `escapeHtml(p.jan_code \|\| '-')` | `null \|\| '-'` = `'-'` | ✅ `-` 表示 |
| `products.html:200` 商品名欠損カウント | `!p.name \|\| !p.name.trim()` | `"".trim()` = `""` → falsy → nameMissing++ | ✅ 安全 |
| `products.html:208-209` 商品名欠損 UI | `qName.className = 'val alert'` | **赤文字アラート** で件数表示 | ✅ 発火確認 |
| `packing_summary.html:142` 重量 null | `p.total_weight_kg != null ? ... : '-'` | `null != null` = false → `'-'` | ✅ 正常 |
| inventory 系ページの jan_code 参照 | `(r.jan_code \|\| '').toLowerCase().includes(...)` | null → `''` に変換してから比較 | ✅ 安全 |

### INFO — 「JAN欠損アラート」の実体について

タスク仕様の「JAN欠損アラート発火」は JavaScript の `alert()` ポップアップではない。  
`pc/master/products.html` の**データ品質パネル** (`#qual-jan`) が赤いカウンタ（`.val.alert`）を表示する仕組みが正しく動作する。  
出荷系ページ（`orders.html`, `loading.html` 等）には JAN 欠損の個別警告はなく、`escapeHtml(p.jan_code || '-')` でセル表示 `-` のみ。

---

## C. 特殊文字耐性

### 想定テスト条件
- 商品名に `<script>alert(1)</script>` / 改行 `\n` / 絵文字 `🎉` / `'; DROP TABLE orders` を設定

### `esc()` / `escapeHtml()` 関数の定義（全ページ共通）

```javascript
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
```

### 挙動表

| 文字列 | `esc()` 処理結果 | innerHTML 出力 | XSS 判定 |
|--------|----------------|---------------|---------|
| `<script>alert(1)</script>` | `&lt;script&gt;alert(1)&lt;/script&gt;` | テキストとして表示 | ✅ 安全 |
| `'` (シングルクォート) | `&#39;` | エスケープ済み | ✅ 安全 |
| `"` (ダブルクォート) | `&quot;` | エスケープ済み | ✅ 安全 |
| `&` | `&amp;` | エスケープ済み | ✅ 安全 |
| `🎉` 絵文字 | 変換なし (Unicode) | そのまま表示 | ✅ 安全 |
| `\n` 改行 | 変換なし | HTML 空白として表示（視覚上スペース） | ✅ 安全 |
| `'; DROP TABLE orders` | `&#39;; DROP TABLE orders` | HTML-only 環境・SQL なし | ✅ 安全 |

**全ページで `esc()` / `escapeHtml()` を一貫使用。innerHTML 経由 XSS は発生しない。**

---

### BUG-Q8-C01 (LOW) — toast の `"'` エスケープ省略

**場所:** `js/common-layout.js:371`

```javascript
// 現状: &<> のみエスケープ
const msg = String(message ?? '')
  .replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
  .replace(/\n/g, '<br>');
t.innerHTML = `<span class="close">×</span>${lbl}${msg}`;
```

**影響:** `"` や `'` を含むメッセージがトーストに表示されても、**テキストノードとして出力**されるため属性インジェクションは発生しない。現状 XSS リスクなし。ただし他ページの `esc()` 実装と不一致であり、防御の一貫性を欠く。

**修正方針:**
```javascript
.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
```

---

## D. 大量データ負荷

### テスト条件
- `api/shipment-orders.json`: 9.43MB / 21,122件 (改行なし単一行 JSON)

### 挙動表

| 確認箇所 | 挙動 | 結果 |
|---------|------|------|
| Bootstrap hook クエリなし | `Object.keys(query).length===0` → raw Response そのまま passthrough（JS 配列生成なし） | ✅ 効率的 |
| `orders.html` fetch → `r.json()` | 21,122 オブジェクトをメモリに展開 / 推定 30〜50MB / 初回ロード ~2-5秒 | △ 許容範囲内 |
| DOM 描画 (`orders.html`) | `DISPLAY_LIMIT = 100` → 最大 100行のみ `<tr>` 生成 | ✅ 滑らか |
| フィルタ処理 | `allRows.filter(...)` で 21k 件全走査 / 同期処理 ~50ms | ✅ 許容範囲 |
| スクロール | 100行 DOM → スムーズ | ✅ 問題なし |

---

### BUG-Q8-D01 (MEDIUM) — common-inout-stats.js が全出荷ページで shipment-orders を不要 fetch

**場所:** `js/common-inout-stats.js:46`

```javascript
if (path.startsWith('/pc/outbound')) {
  primary = '/api/shipment-orders';  // 全出荷ページ共通で 9.4MB fetch
  primaryDateField = 'scheduled_date';
}
```

**影響:** 出荷系 77ページ全てで、右パネルの「本日サマリ」更新のために **9.4MB の shipment-orders を fetch**。  
ページ本体が別 API を使うページでも不要ロードが発生:

| ページ | 本体使用 API | common-inout-stats が fetch する API | 無駄 |
|--------|------------|-------------------------------------|------|
| `packing_summary.html` | `/api/packings` + `/api/packing-materials` | `/api/shipment-orders` (9.4MB) | ✅ |
| `loading.html` | `/api/loadings` | `/api/shipment-orders` (9.4MB) | ✅ |
| `handover.html` | `/api/loadings` | `/api/shipment-orders` (9.4MB) | ✅ |

ブラウザキャッシュが効く場合は2回目以降速いが、初回ロードで実質ネットワーク消費 2倍。

**修正方針:**  
各ページの `<script>` タグに `data-stats-api` 属性を持たせ、`common-inout-stats.js` 側で参照する。もしくは outbound サブパスごとに主 API をマッピングする。

```html
<!-- 例: packing_summary.html -->
<script src="js/common-inout-stats.js" data-stats-api="/api/packings"></script>
```

---

### BUG-Q8-D02 (LOW) — クエリ付き fetch で 21k 件全件を in-memory JSON parse

**場所:** Bootstrap hook インラインスクリプト（全 HTML 共通）

```javascript
// クエリパラメータがある場合
return r.json().then(function(d) {
  return R(applyF(d, query))  // 21k件全体をパース → フィルタ → 新 Response 生成
})
```

**影響:** `?owner_code=MK001` 等のクエリ付きで `/api/shipment-orders` を fetch した場合、9.4MB を JS 配列に展開してからフィルタ → 一時的に ~2倍のメモリ使用（フィルタ後は GC 対象）。  
現状 `orders.html` はクエリなし全件 fetch → JS 側でフィルタしているためこの分岐は実質未使用。将来的にクエリ付きで大量データを取る場面では注意。

---

## E. クエリ filter エッジ

### 挙動表（`applyF` 関数の挙動）

| ケース | URL 例 | `applyF` の動作 | 返却 |
|--------|--------|----------------|------|
| `owner_code` 空文字 | `?owner_code=` | `v=""` → `!v` true → フィルタスキップ | ✅ 全件 |
| `owner_code` パラメータなし | `/api/owners` | `Object.keys(q).length === 0` → raw Response | ✅ 全件 |
| 複合フィルタ | `?status=picking&owner_code=MK001` | `every()` → AND 条件 → 両条件マッチのみ | ✅ 正常絞込 |
| 存在しないキー | `?foo=bar` | `it["foo"] === undefined` かつ owner 特殊ケース非該当 → `return true` | ✅ 全件(エラーなし) |
| 存在しない値 | `?owner_code=ZZZZZ` | 全件マッチ失敗 → `[]` 返却 | ✅ 空配列(エラーなし) |
| 数値ゼロ | `?some_field=0` | `v="0"` → `!v` = false → フィルタ実行 | ✅ 文字列一致で動作 |

### INFO — `applyF` の非オブジェクト要素の扱い

```javascript
return arr.filter(function(it) {
  if (!it || typeof it !== "object") return true;  // null/primitive は無条件通過
  ...
})
```

**挙動:** JSON 配列中に `null` や数値などの非オブジェクト要素があった場合、フィルタ条件に関わらず通過（返却）される。  
現状の API データは全て適切なオブジェクト配列なので問題なし。将来データが不正な場合は意図しない要素が含まれる可能性あり。

---

## 修正必要箇所リスト

| ID | 重要度 | 場所 | 内容 | 修正難易度 |
|----|--------|------|------|-----------|
| BUG-Q8-D01 | **MEDIUM** | `js/common-inout-stats.js:46` | 全出荷ページで 9.4MB shipment-orders を不要 fetch → 各ページの API 選択を個別化 | 中 |
| BUG-Q8-C01 | LOW | `js/common-layout.js:371` | toast innerHTML で `"'` 未エスケープ → `/[&<>"']/g` に修正 | 小 |
| BUG-Q8-D02 | LOW | Bootstrap hook (全 HTML インライン) | クエリ付き大量データ fetch で二重メモリ使用 → 静的ファイル構成上の構造的制約 | 大 |

---

## 総評

| 観点 | 評価 | 備考 |
|------|------|------|
| XSS 耐性 | **高** | `esc()` が全 innerHTML 箇所で一貫使用。toast のみ軽微な省略あり（BUG-Q8-C01） |
| null/空値耐性 | **高** | ショートサーキット評価・`\|\| '-'`・`?? ''` パターンで安全 |
| 空配列耐性 | **高** | 全ページで "データなし" 系表示が正しく出る。クラッシュなし |
| 大量データ | **要改善** | `common-inout-stats.js` の無差別 9.4MB fetch が不要オーバーヘッド (BUG-Q8-D01) |
| クエリフィルタ | **高** | 空値・未知キー・複合条件の全パターンで安全動作 |

以上
