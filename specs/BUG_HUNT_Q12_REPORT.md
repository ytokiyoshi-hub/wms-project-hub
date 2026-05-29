# BUG_HUNT_Q12_REPORT.md — 入力フォーム・バリデーション網羅検証

タスク: BH-Q12 (#1080)  
実施日: 2026-05-30  
担当: にーちゃん (assigned_to=7)

## 検証方法

静的コード解析により全対象フォームを検証。  
対象: `test2-mirror/` 配下のフォームを持つ HTML ファイル（入力系: register, adjust, count, login 等）。  
既存 Q1-Q8 のカバー範囲（console/JSエラー・業務シナリオ・モーダル・フィルタ・FK整合・HT BT-A2000フロー・印刷帳票・エッジケース）と重複しないよう検証軸を入力バリデーションに限定。

主要検査ファイル:
- `pc/inbound/register.html`
- `pc/outbound/register.html`
- `pc/inventory/adjust.html`
- `pc/returns/return_request.html`
- `pc/billing/cost_simulation.html`
- `pc/settings/security.html`
- `ht/login.html`
- `ht/stocktake/count.html`
- `pc/master/products.html`, `locations.html`, `users.html`（代表3ファイル）
- `js/common-layout.js`（共通バリデーション有無確認）

---

## 検証結果サマリ

| カテゴリ | 判定 | 主な問題 |
|---------|------|---------|
| 数値フィールド（負数・ゼロ） | ❌ 問題あり | CRITICAL 1件 / HIGH 2件 |
| パスワード・認証バリデーション | ❌ 問題あり | HIGH 1件 |
| 必須フィールド未入力送信 | ⚠️ 部分的 | HIGH 1件 / MEDIUM 1件 |
| 日付範囲バリデーション | ❌ 問題あり | MEDIUM 2件 |
| テキストフォーマット検証 | ❌ 問題あり | MEDIUM 3件 |
| サイレントフィルタリング | ⚠️ 部分的 | MEDIUM 2件 |
| HTML属性と JS バリデーション不一致 | ⚠️ 部分的 | LOW 3件 |
| マスタフォーム実装状況 | ℹ️ 情報 | INFO 1件 |

**検出バグ合計: 1 CRITICAL / 4 HIGH / 8 MEDIUM / 3 LOW / 1 INFO**

---

## A. 数値フィールドの負数・ゼロ

### BUG-Q12-A01 (CRITICAL) — inventory/adjust.html: 負数在庫調整が通過する

**場所:** `pc/inventory/adjust.html`

```html
<!-- HTML: min 属性なし -->
<input type="number" id="f-qty" placeholder="例: 95">
```

```javascript
// JS バリデーション (L145, L148)
const qty = parseInt(document.getElementById('f-qty').value, 10);
if (!product || !loc || isNaN(qty) || !note) { alert('...'); return; }
// qty が -50 の場合: isNaN(-50) = false → バリデーション通過
// API へ qty_after: -50 が送信される
```

**再現条件:** 在庫調整フォームで数量欄に `-50` を入力して送信  
**影響:** 在庫数がマイナスになる。「必ず本画面経由・荷主承認必須」の業務コントロールを数値細工で回避可能  
**重大度:** CRITICAL  
**推奨対処:**
```html
<input type="number" id="f-qty" placeholder="例: 95" min="0">
```
```javascript
if (qty < 0) { alert('数量は0以上を入力してください'); return; }
```

---

### BUG-Q12-A02 (HIGH) — outbound/register.html: 出荷明細の数量に検証なし

**場所:** `pc/outbound/register.html`

```html
<!-- HTML: min/max 属性なし -->
<input class="line-qty" type="number" value="1">
```

```javascript
// JS (L139-143): 取得してフィルタのみ、検証なし
const lines = Array.from(...).map(tr => ({
  product_code: tr.querySelector('.line-product').value,
  qty: parseInt(tr.querySelector('.line-qty').value, 10),
  unit: tr.querySelector('.line-unit').value,
})).filter(l => l.product_code && l.qty > 0);
// qty=-1000 でも parseInt(-1000) = -1000 → qty > 0 判定で「0件」扱い
// ユーザーへのフィードバックなし（0件なら別の alert が出る）
```

**再現条件:** 出荷登録で数量欄に `-1` または `0` を入力して送信  
**影響:** 負数・ゼロ数量の行がサイレントに除外される。ユーザーは何が起きたか分からず、誤った出荷計画を作成したと気づかない  
**重大度:** HIGH  
**推奨対処:** `min="1"` 属性追加＋個別フィールドへの検証追加

---

### BUG-Q12-A03 (HIGH) — inbound/register.html: 負数入荷予定数量がサイレントフィルタされる

**場所:** `pc/inbound/register.html`

```html
<input class="line-qty" type="number" value="120" min="1">
<!-- HTML に min="1" はあるが JS では無視 -->
```

```javascript
// JS (L268): サイレントフィルタ
const lines = Array.from(...).filter(l => l.product_code && l.expected_qty > 0);
// qty=-100 → parseInt → -100 → expected_qty > 0 false → サイレント除外
// qty=0.5 → parseInt(0.5) = 0 → expected_qty > 0 false → サイレント除外
```

**再現条件:** 入荷登録で数量欄に `-100` または小数 `0.5` を入力して送信  
**影響:** 行が無言で無視される。HTML の `min="1"` 属性が存在するが JavaScript 側で再検証されておらず、`min` を無視した値の送信が可能（ブラウザ UI 操作で回避できる）  
**重大度:** HIGH  
**推奨対処:**
```javascript
if (l.expected_qty <= 0 || isNaN(l.expected_qty)) {
  alert(`${rowNum}行目: 数量は1以上を入力してください`);
  return;
}
```

---

### BUG-Q12-A04 (MEDIUM) — billing/cost_simulation.html: 試算数値フィールドに下限なし

**場所:** `pc/billing/cost_simulation.html`

```html
<input type="number" value="8500">  <!-- 想定保管数: min/max なし -->
<input type="number" value="6500">  <!-- 想定月間入庫: min/max なし -->
<input type="number" value="3500">  <!-- 想定月間出庫: min/max なし -->
<input type="number" value="2">     <!-- SLA違反予測: min/max なし -->
```

**再現条件:** 各数値欄にマイナス値を入力してシナリオ保存  
**影響:** コストシミュレーションに不正な負数が混入し、誤った試算結果が生成される  
**重大度:** MEDIUM（現状は保存ボタンがモック動作のため実被害なし。実装フェーズで顕在化）  
**推奨対処:** 全数値フィールドに `min="0"` 追加

---

## B. パスワード・認証バリデーション

### BUG-Q12-B01 (HIGH) — ht/login.html: パスワード空送信が通過する

**場所:** `ht/login.html`

```html
<input type="password" id="pw-input" placeholder="****">
<!-- required 属性なし、minlength 属性なし -->
```

```javascript
function login() {
  const u = document.getElementById('user-input').value.trim();
  if (!u) { alert('作業者IDを入力'); return; }
  // パスワードの検証が一切ない
  location.href = 'ht/menu.html';  // PW 空でもログイン遷移
}
```

**再現条件:** ハンドヘルド端末ログイン画面で、パスワード欄を空欄のままログインボタンを押す  
**影響:** パスワード認証がスキップされ、作業者ID のみでログインできる。セキュリティ上の重大な欠陥  
**重大度:** HIGH  
**推奨対処:**
```javascript
const p = document.getElementById('pw-input').value;
if (!p) { alert('パスワードを入力してください'); return; }
```
```html
<input type="password" id="pw-input" placeholder="****" minlength="4" required>
```

---

## C. 必須フィールドの未入力送信

### BUG-Q12-C01 (HIGH) — returns/return_request.html: 全フィールドでバリデーションなし

**場所:** `pc/returns/return_request.html`

```html
<!-- 受付経路・荷主・関連出荷No・受付日・顧客氏名 等すべてのフィールドに required なし -->
<input type="datetime-local" id="f-date">
<input type="text" id="f-customer">
<select id="f-channel">...</select>
```

```javascript
// すべてのボタンが alert() モックのみ、バリデーション関数なし
onclick="alert('「登録」モック動作')"
```

**再現条件:** 返品受付フォームの全フィールド空欄で登録ボタン押下  
**影響:** すべてのフィールドが空欄でも送信をブロックする仕組みが存在しない。「登録」ボタンは現状モックだが、実装フェーズで必須バリデーション追加が必要  
**重大度:** HIGH（実装フェーズへの引き継ぎが必要）  
**推奨対処:** 実装時に各フィールドの必須チェック・フォーマット検証を一括追加

---

### BUG-Q12-C02 (MEDIUM) — outbound/register.html: 荷主コード空送信チェックなし

**場所:** `pc/outbound/register.html`

```javascript
// L146: 空チェックなし
owner_code: document.getElementById('f-owner').value,  // "" のまま送信可能
```

**再現条件:** 荷主セレクトで「選択してください（初期値）」のまま出荷登録を送信  
**影響:** `owner_code: ""` が API に送信され、バックエンドで荷主不明の出荷オーダーが作成される可能性  
**重大度:** MEDIUM  
**推奨対処:**
```javascript
const owner = document.getElementById('f-owner').value;
if (!owner) { alert('荷主を選択してください'); return; }
```

---

## D. 日付範囲バリデーション

### BUG-Q12-D01 (MEDIUM) — inbound/register.html: 過去日付の入荷予定日が通過する

**場所:** `pc/inbound/register.html`

```html
<input type="date" id="f-date">
```

```javascript
// L265: 空チェックのみ、過去日付不可チェックなし
if (!date) { alert('予定日を指定してください'); return; }
```

**再現条件:** 予定日に `2020-01-01` など過去の日付を入力して登録  
**影響:** 過去日付の入荷予定が登録され、スケジュール管理・KPI レポートに誤ったデータが混入する  
**重大度:** MEDIUM  
**推奨対処:**
```javascript
const today = new Date().toISOString().split('T')[0];
if (date < today) { alert('予定日は本日以降を指定してください'); return; }
```

---

### BUG-Q12-D02 (MEDIUM) — outbound/register.html: 過去日付の出荷予定日が通過する

**場所:** `pc/outbound/register.html`  
**内容:** D01 と同様のパターン。出荷日フィールド `<input type="date" id="f-date">` に対して過去日付チェックなし  
**重大度:** MEDIUM  
**推奨対処:** D01 と同じアプローチで過去日付ガードを追加

---

## E. テキストフォーマット検証

### BUG-Q12-E01 (MEDIUM) — outbound/register.html: 郵便番号フォーマット検証なし

**場所:** `pc/outbound/register.html`

```html
<input id="f-zip" placeholder="100-0001">
<!-- type="text"、pattern 属性なし、maxlength なし -->
```

**再現条件:** 郵便番号欄に `"ABC"`, `"1234567890"`, `"無効なコード"` を入力して送信  
**影響:** 不正な郵便番号が出荷先住所として登録され、配送ラベル・配送指示に誤データが混入  
**重大度:** MEDIUM  
**推奨対処:**
```html
<input id="f-zip" placeholder="100-0001" pattern="\d{3}-\d{4}" maxlength="8" title="ハイフンありの郵便番号（例: 100-0001）">
```

---

### BUG-Q12-E02 (MEDIUM) — inventory/adjust.html: 商品コード・ロケーションコードのフォーマット未検証

**場所:** `pc/inventory/adjust.html`

```html
<input id="f-product" placeholder="SKU-MK001-001">  <!-- pattern なし -->
<input id="f-loc" placeholder="">  <!-- pattern なし -->
```

```javascript
// 空チェックのみ
if (!product || !loc || isNaN(qty) || !note) { alert('...'); return; }
```

**再現条件:** 商品コード欄に `"invalid"`, `"123"`, `"'DROP--"` などを入力して送信  
**影響:** 存在しない商品コード・ロケーションコードで在庫調整が送信され、バックエンドエラーまたは不正データの混入  
**重大度:** MEDIUM  
**推奨対処:**
```html
<input id="f-product" placeholder="SKU-MK001-001" pattern="SKU-[A-Z0-9]+-[0-9]{3}" title="商品コード形式（例: SKU-MK001-001）">
```

---

### BUG-Q12-E03 (MEDIUM) — ht/login.html: 作業者IDのフォーマット検証なし

**場所:** `ht/login.html`

```html
<input type="text" id="user-input" placeholder="USR-001">
<!-- pattern なし、maxlength なし -->
```

```javascript
// 空チェックのみ
if (!u) { alert('作業者IDを入力'); return; }
```

**再現条件:** 作業者ID 欄に `"a"`, `"123456789999999"`, スペースなどを入力してログイン  
**影響:** 不正な形式の作業者IDでもログインフォームを通過できる  
**重大度:** MEDIUM  
**推奨対処:**
```html
<input type="text" id="user-input" placeholder="USR-001" pattern="USR-[0-9]{3}" maxlength="7" title="USR-XXX 形式で入力">
```

---

## F. HTML属性と JS バリデーションの不一致

### BUG-Q12-F01 (LOW) — inbound/register.html: HTML min="1" が JS で再チェックされない

**場所:** `pc/inbound/register.html`

```html
<input class="line-qty" type="number" value="120" min="1">
<!-- HTML 属性では min=1 -->
```

```javascript
// JS 側では min チェックなし（サイレントフィルタのみ）
filter(l => l.product_code && l.expected_qty > 0)
```

**影響:** ブラウザの DevTools で `min` 属性を削除・変更すれば 0 や負数が通過する。HTML5 属性のみへの依存は防御策として不十分  
**重大度:** LOW  
**推奨対処:** HTML 属性に加え JS 側で明示的に `if (qty < 1)` チェックを追加

---

### BUG-Q12-F02 (LOW) — ht/stocktake/count.html: min="0" が HTML に設定されていない

**場所:** `ht/stocktake/count.html`（唯一バリデーション実装済みフォーム）

```html
<input type="number" id="count-input" placeholder="0">
<!-- min="0" なし -->
```

```javascript
// JS 側では正しく検証
if (isNaN(v) || v < 0) { alert('実数を入力'); return; }  // ✅ 正しい
```

**影響:** HTML 属性が設定されていないため、JS が無効な環境や将来的な JS 変更時にブラウザレベルの防御がない  
**重大度:** LOW（現状は JS バリデーションで機能している）  
**推奨対処:** `<input type="number" id="count-input" placeholder="0" min="0">` を追加

---

### BUG-Q12-F03 (LOW) — pc/settings/security.html: パスワード最低文字数フィールドに min/max なし

**場所:** `pc/settings/security.html`

```html
<input type="number" value="8">  <!-- 最低文字数: min/max なし -->
```

**影響:** パスワードポリシーの「最低文字数」に `0` や `-1` を設定できる（現状モック動作）  
**重大度:** LOW（現状は保存がモック動作のため実被害なし）  
**推奨対処:** `min="4" max="32"` を追加

---

## G. 情報

### INFO-Q12-G01 — マスタデータ CREATE/EDIT フォームはすべてモック実装

**対象:** `pc/master/products.html`, `pc/master/locations.html`, `pc/master/carriers.html`, `pc/master/users.html`, `pc/master/adjustment_reasons.html` 等

すべてのマスタデータ新規登録・編集フォームのボタンは `onclick="alert('「...」モック動作')"` で実装されており、実際のフォームバリデーション・送信ロジックは存在しない。  
これは意図的な段階的実装（「実装は後続フェーズ」コメント存在）であり、バグではなく現状の実装方針の確認。  
**実装フェーズで必須バリデーションの追加が必要。**

---

## 修正必要箇所リスト

| ID | 重大度 | 場所 | 内容 | 修正難易度 |
|----|--------|------|------|-----------|
| BUG-Q12-A01 | **CRITICAL** | `pc/inventory/adjust.html` | 負数在庫調整が通過する（min属性なし・isNaN のみ） | 小 |
| BUG-Q12-A02 | **HIGH** | `pc/outbound/register.html` | 出荷明細 qty に検証なし（サイレントフィルタのみ） | 小 |
| BUG-Q12-A03 | **HIGH** | `pc/inbound/register.html` | 負数・小数 qty がサイレントフィルタで無言除外 | 小 |
| BUG-Q12-B01 | **HIGH** | `ht/login.html` | パスワード空送信でログイン遷移が発生 | 小 |
| BUG-Q12-C01 | **HIGH** | `pc/returns/return_request.html` | 全フィールドでバリデーションなし（実装フェーズで必須） | 中 |
| BUG-Q12-A04 | MEDIUM | `pc/billing/cost_simulation.html` | 試算数値フィールド（保管数・入出庫数）に min なし | 小 |
| BUG-Q12-C02 | MEDIUM | `pc/outbound/register.html` | 荷主コード空送信チェックなし | 小 |
| BUG-Q12-D01 | MEDIUM | `pc/inbound/register.html` | 入荷予定日で過去日付を受け付ける | 小 |
| BUG-Q12-D02 | MEDIUM | `pc/outbound/register.html` | 出荷予定日で過去日付を受け付ける | 小 |
| BUG-Q12-E01 | MEDIUM | `pc/outbound/register.html` | 郵便番号フォーマット未検証 | 小 |
| BUG-Q12-E02 | MEDIUM | `pc/inventory/adjust.html` | 商品・ロケーションコードフォーマット未検証 | 小 |
| BUG-Q12-E03 | MEDIUM | `ht/login.html` | 作業者IDフォーマット未検証 | 小 |
| BUG-Q12-F01 | LOW | `pc/inbound/register.html` | HTML min="1" が JS で再チェックされない | 小 |
| BUG-Q12-F02 | LOW | `ht/stocktake/count.html` | JS では正しく検証済みだが HTML min="0" が未設定 | 極小 |
| BUG-Q12-F03 | LOW | `pc/settings/security.html` | 最低文字数フィールドに min/max なし | 極小 |

---

## 総評

| 観点 | 評価 | 備考 |
|------|------|------|
| 数値フィールド（負数） | **要改善** | inventory/adjust が CRITICAL。inbound/outbound も修正必要 |
| 認証バリデーション | **要改善** | HT ログインのパスワード空送信は HIGH |
| 必須フィールド | **部分的** | inbound は荷主・日付チェックあり。outbound・returns は欠落 |
| 日付範囲 | **要改善** | 過去日付チェックなし（2フォーム共通） |
| フォーマット検証 | **要改善** | 郵便番号・商品コード・作業者ID すべて自由入力 |
| 唯一の正例 | `ht/stocktake/count.html` | 負数・NaN チェックが JS で正しく実装されている |
| マスタフォーム | 未実装 | 意図的な段階的実装（実装フェーズで一括対応必要） |

以上
