# バグハント Q9: レスポンシブ/実機サイズ表示検証 レポート

**検証日**: 2026-05-30  
**担当**: にーちゃん (assigned_to=7)  
**タスクID**: #1077  
**既存カバー範囲との差分**: Q1=console/JSエラー / Q2=業務シナリオ / Q3=モーダル / Q4=フィルタ / Q5=API FK整合 / Q6=HT BT-A2000フロー / Q7=印刷帳票 / Q8=エッジケース

---

## 概要

検出件数: **12件**  
内訳: CRITICAL×2 / HIGH×5 / MEDIUM×4 / LOW×1

| ID | 重大度 | 区分 | タイトル |
|----|--------|------|---------|
| Q9-PC-001 | **CRITICAL** | PC | CSS全体にメディアクエリなし → 768px以下でサイドバー固定崩壊 |
| Q9-PC-002 | **CRITICAL** | PC | `list-full` テーブル列幅合計が `.two-pane` 左ペイン幅を超過 → 横スクロール |
| Q9-HT-001 | HIGH | HT | BT-A1000 (320px) で `.ht-device` (280px) が水平オーバーフロー |
| Q9-HT-002 | HIGH | HT | HT 15画面で viewport メタタグ欠落 → 実機で 980px 幅デスクトップレンダリング |
| Q9-PC-003 | HIGH | PC | `dashboard-grid` が 1024px 以下でシングルカラム強制退化 |
| Q9-PC-004 | HIGH | PC | `.two-pane` 左ペインが 768px 時に 254px まで圧縮 → フォーム使用不能寸前 |
| Q9-LT-001 | HIGH | 長文 | `c-text { width:320px }` が 254px 左ペイン内でテーブルオーバーフロー |
| Q9-HT-003 | MEDIUM | HT | `.ht-nav` が BT-A1000 (320px) で 3〜4 行に折り返し → 作業エリア圧迫 |
| Q9-PC-005 | MEDIUM | PC | `form-row` が 254px 左ペイン内で 1 列縮退 → 縦に長くなりスクロール増大 |
| Q9-LT-002 | MEDIUM | 長文 | HT 画面で長商品名・ロット番号が 280px 幅で複数行折り返し → 視認性低下 |
| Q9-LT-003 | MEDIUM | 長文 | PC テーブルの荷主名/商品名/住所が `c-text` 列で折り返し → 行高さ不均等 |
| Q9-HT-004 | LOW | HT | `.ht-screen { aspect-ratio: 480/800 }` で BT-A1000 縦 480px viewport 超過 |

---

## 詳細

---

### Q9-PC-001 【CRITICAL】CSS全体にメディアクエリなし

**ファイルパス**: `test2-mirror/css/test2.css`  
**再現条件**: ブラウザ幅を 768px 以下にリサイズ / 1024px 以下のタブレット端末でアクセス  
**症状**:
- `test2.css` に `@media` ルールが 1 件もない
- `.sidebar { width: 240px }` (MORIKA override 後) が固定幅のまま残る
- 768px viewport: サイドバー 240px + main 528px。コンテンツ実質幅 = 528 - 40px padding = **488px**
- 全 PC 画面がこの影響を受ける（429 ファイル超）

**影響範囲**: PC全画面  
**推奨対処**: 768px / 1024px ブレークポイントに `@media` を追加。768px 以下ではサイドバーを折りたたみ (hamburger) または非表示にする。

---

### Q9-PC-002 【CRITICAL】`list-full` テーブル列幅が left-pane を超過

**ファイルパス**: 代表例 `test2-mirror/pc/inbound/plans.html`（および全 two-pane + list-full 組み合わせ画面）  
**再現条件**: viewport 幅 768px で `pc/inbound/plans.html` を開く  
**症状**:

```css
/* css/test2.css */
table.list.list-full th.c-code,   td.c-code   { width: 120px; }  /* 2列 = 240px */
table.list.list-full th.c-text,   td.c-text   { width: 320px; }  /* 1列 = 320px */
table.list.list-full th.c-date,   td.c-date   { width: 160px; }  /* 1列 = 160px */
table.list.list-full th.c-num,    td.c-num    { width:  80px; }  /* 1列 =  80px */
table.list.list-full th.c-status, td.c-status { width:  80px; }  /* 1列 =  80px */
table.list.list-full th.c-action, td.c-action { width: 100px; }  /* 1列 = 100px */
/* 合計: 240+320+160+80+80+100 = 980px */
```

- 768px viewport: `.two-pane` 左ペイン = 488 - 220(right) - 14(gap) = **254px**
- テーブル最小列幅合計（nowrap 列のみ）= c-code×2(120+120) + c-date(160) + c-num(80) + c-status(80) + c-action(100) = **660px** → **660px > 254px** → 横スクロール発生  

**影響範囲**: `two-pane` + `list-full` を使う全 PC 一覧画面（plans, orders, inventory 等）  
**推奨対処**: `@media (max-width: 1024px)` で `list-full` の固定列幅を無効化、テーブルを横スクロール可能コンテナでラップ (`overflow-x: auto`)、または `two-pane` を縦積みに切り替え。

---

### Q9-HT-001 【HIGH】BT-A1000 (320px) で `.ht-device` 水平オーバーフロー

**ファイルパス**: `test2-mirror/css/ht-mock.css` L14, L67  
**再現条件**: viewport 幅 320px（BT-A1000 実機 / ブラウザで width=320 設定）  
**症状**:

```css
/* ht-mock.css */
html, body { padding: 32px 24px 60px; }   /* 左右 24px×2 = 48px */
.ht-device  { width: 280px; }             /* 固定 280px */
/* 利用可能幅: 320 - 48 = 272px */
/* .ht-device 280px > 272px → 8px 水平オーバーフロー */
```

- BT-A1000 (320×480) の実機ブラウザで横スクロールバーが出現
- `.ht-device` の右端が画面外に切れる

**対象ファイル数**: HT 全 37 画面  
**BT-A2000 (480px) への影響**: なし（480 - 48 = 432px > 280px で問題なし）  
**推奨対処**:
```css
/* ht-mock.css に追加 */
@media (max-width: 340px) {
  html, body { padding: 24px 12px 48px; }
  .ht-device { width: 290px; }  /* または width: calc(100% - 24px) */
}
```

---

### Q9-HT-002 【HIGH】HT 15画面で viewport メタタグ欠落

**再現条件**: 実機 (BT-A2000 / BT-A1000) のブラウザで対象 URL を開く  
**症状**: `<meta name="viewport" ...>` がないと Android ブラウザは 980px のデスクトップ幅でレンダリングし、コンテンツが約 30% サイズに縮小される。バーコードスキャン入力フィールドが押しにくくなる。  

**欠落ファイル一覧**:

| ファイル | 重要度備考 |
|---------|-----------|
| `ht/login.html` | ★入口画面 |
| `ht/menu.html` | ★メインメニュー |
| `ht/inspect/discrepancy.html` | 差異処理 |
| `ht/inspect/lot_error.html` | ロットエラー |
| `ht/inspect/sign.html` | サイン |
| `ht/inventory/query.html` | 在庫照会 |
| `ht/handover/lane.html` | 引渡 |
| `ht/move/scan.html` | 移動スキャン |
| `ht/owner/confirm.html` | 荷主確認 |
| `ht/owner/error.html` | 荷主エラー |
| `ht/pick/error.html` | ピックエラー |
| `ht/pick/list.html` | ピック一覧 |
| `ht/replenish/scan.html` | 補充スキャン |
| `ht/returns/approval.html` | 返品承認 |
| `ht/returns/auto.html` | 自動返品 |

**推奨対処**: 全 15 ファイルの `<head>` 内に以下を追加（`<meta charset="UTF-8">` の直後）:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

---

### Q9-PC-003 【HIGH】`dashboard-grid` が 1024px 以下でシングルカラム強制

**ファイルパス**: `test2-mirror/css/test2.css` L164  
**再現条件**: viewport 幅 1024px で `pc/dashboard.html` を開く  
**症状**:

```css
.dashboard-grid {
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 14px;
}
```

- 1024px viewport: sidebar=240px → main=784px → content=744px
- 744px ÷ 2 = 372px < 450px の最小幅制約 → **1列に強制**
- 本来 2 カラム期待の「入荷フロー / 出荷フロー / SLA遅延」カードが縦長一列になり、ダッシュボードとして一覧性が失われる
- 1280px では content=1000px ÷ 2 = 500px > 450px → 2列 OK

**影響ファイル**: `pc/dashboard.html`, `pc/dashboard/` 全画面（manager_view, operations_kpi, realtime 等）  
**推奨対処**: `minmax(450px, ...)` を `minmax(380px, ...)` に緩和 or `@media` で 1024px 以下に別の列数指定を追加

---

### Q9-PC-004 【HIGH】`.two-pane` 左ペインが 768px 時に 254px まで圧縮

**ファイルパス**: `test2-mirror/css/test2.css` L351（MORIKA override）  
**再現条件**: viewport 幅 768px で two-pane レイアウトの画面を開く  
**症状**:

```
viewport: 768px
- sidebar: 240px (MORIKA)
- main: 528px
- .content padding: 20px × 2 = 40px
- 有効幅: 488px
- .two-pane: right-pane = 220px, gap = 14px
- left-pane = 488 - 220 - 14 = 254px
```

- フィルタ入力 `width: 200px` が 254px 内にほぼ収まるが余白 54px のみ
- テーブル多列 → Q9-PC-002 の横スクロール問題
- right-pane の summary-row が適切に機能するが left-pane が見にくい

**影響ファイル**: `two-pane` を使う全 PC 一覧画面  
**推奨対処**: `@media (max-width: 1024px)` で `.two-pane { grid-template-columns: 1fr }` (縦積み) に切り替え

---

### Q9-LT-001 【HIGH】`c-text` 幅 320px が 254px 左ペインでオーバーフロー

**ファイルパス**: `test2-mirror/css/test2.css` L131-136  
**再現条件**: viewport 768px で `list-full` テーブルを含む `two-pane` 画面を開く  
**症状**:

```css
table.list.list-full th.c-text, td.c-text { width: 320px; max-width: none; }
```

- 左ペイン 254px に対して c-text 列幅 320px → この列だけで左ペインを超過
- 商品名・サプライヤー名・出荷先名など「文字列列」が溢れる
- `white-space: normal; word-break: break-word` なので折り返しはされるが、テーブル幅が固定列幅合計に引っ張られて overflow

**影響ファイル**: `list-full` + `two-pane` 組み合わせ（inbound, outbound, inventory, master 系）  
**推奨対処**: Q9-PC-002 と合わせて対処（overflow-x: auto コンテナラップ、または @media でカラム幅削減）

---

### Q9-HT-003 【MEDIUM】`.ht-nav` が BT-A1000 (320px) で多段折り返し

**ファイルパス**: `test2-mirror/css/ht-mock.css` L121-126  
**再現条件**: viewport 幅 320px で HT ページを開く  
**症状**:

```css
.ht-nav { max-width:1500px; display:flex; flex-wrap:wrap; gap:14px; font-size:13px; }
.ht-nav a { padding:6px 14px; }
```

- 320px 幅でリンクが折り返し、ナビが 3〜4 行に展開
- 例: `ht/putaway/instructions.html` は 7 リンク → 約 3 行
- 本番 preview でナビバーが画面の半分を占め、実機コンテンツ確認の邪魔になる

**推奨対処**: preview 専用ナビは折り畳み可能 (collapsed by default) にするか、実機サイズ時は非表示

---

### Q9-PC-005 【MEDIUM】`form-row` が 254px 左ペインで 1列縮退

**ファイルパス**: `test2-mirror/css/test2.css` L202  
**再現条件**: viewport 768px で plans.html 等のフォーム付き画面を開く  
**症状**:

```css
.form-row { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
```

- 左ペイン 254px: 254 ÷ 200 = 1.27 → **1列に縮退**
- `plans.html` の 4 フィールド（入荷予定日・ステータス・サプライヤー・荷主）が縦 1 列に並びカード高さが 4 倍近くになる
- 一覧テーブルが画面下方に押し出される

**推奨対処**: Q9-PC-001/Q9-PC-004 の修正（@media でtwo-pane縦積み）と合わせて解消

---

### Q9-LT-002 【MEDIUM】HT 画面で長商品名・ロット番号が複数行折り返し

**ファイルパス**: `test2-mirror/ht/pick/scan.html`, `ht/putaway/instructions.html` 等  
**再現条件**: API データに長い商品名（20文字超）が含まれる場合  
**症状**:

- `ht/pick/scan.html` の `#sku-name` 要素: `font-size: 12px; font-weight: 600;` で幅制約なし
- `.ht-body { width: 260px 程度 }` の内側で、商品名が 2〜3 行に折り返し
- 例: 「有機 乳酸菌 プレミアム 900ml (ケース×12) FEFO対象」等の長い名称
- 実機作業中にスクロールしないと数量確認欄が見えない場合がある

**推奨対処**: `#sku-name` に `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` を追加（ピッキング画面では名称の一部が省略されても SKU コードで照合するため実害小）

---

### Q9-LT-003 【MEDIUM】PC テーブルで長文セルの行高さ不均等

**ファイルパス**: `test2-mirror/css/test2.css` L119  
**再現条件**: 商品名/住所/備考等に長い文字列が入るデータ + 1024px 以下の viewport  
**症状**:

```css
table.list td.c-text { max-width: 360px; white-space: normal; word-break: break-word; }
```

- 設計意図は正しいが、左ペインが狭い (254px-510px) 場合に `c-text` 折り返し行数が増大
- 同一テーブルの行高さが行によって 2〜5 倍差になり、視覚的スキャンが困難
- 特にサプライヤー名（例: 「オーガニックライフ株式会社 東海支店 食品部」）、配送先住所

**推奨対処**: 1024px 以下では `c-text` に `max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` を適用し行高さを統一

---

### Q9-HT-004 【LOW】`.ht-screen` の aspect-ratio が BT-A1001 viewport 縦寸法を超過

**ファイルパス**: `test2-mirror/css/ht-mock.css` L79-88  
**再現条件**: viewport 高さ 480px（BT-A1000 縦持ち）で HT ページを開く  
**症状**:

```css
.ht-screen { width: 100%; aspect-ratio: 480/800; }
/* .ht-device width = 280px → screen height = 280 × (800/480) ≈ 467px */
/* + .ht-keypad ≈ 100px + .brand/.model + padding */
/* 合計高さ ≈ 620px → BT-A1000 480px viewport を超過 → body スクロール発生 */
```

- BT-A1000 実機縦持ちでコンテンツが画面外に出る（ただし `overflow-y: scroll` で到達可能）
- ピッキング作業中にスクロールが必要になるケース

**推奨対処**: BT-A1000 用 real-mode での `.ht-screen { max-height: calc(100vh - 80px) }` 追加を検討

---

## 重大度別推奨対処優先順

| 優先度 | 対処内容 | 影響範囲 |
|--------|---------|---------|
| 1 | `test2.css` に `@media` ブレークポイント追加（768/1024px） | 全 PC 画面 |
| 2 | HT 15 画面に viewport メタタグ追加 | login, menu を含む重要 HT 画面 |
| 3 | `.two-pane` を `@media (max-width: 1024px)` で縦積みに変更 | 全 two-pane 画面 |
| 4 | `list-full` テーブルを `overflow-x: auto` コンテナでラップ | 全一覧テーブル |
| 5 | `dashboard-grid` の `minmax(450px)` を緩和 | dashboard 全画面 |
| 6 | BT-A1000 向け body padding を縮小（320px 以下） | 全 HT 画面 |

---

## 検証方法

- CSS 静的解析: `ht-mock.css`, `test2.css` 全行読込みによるレイアウト計算
- HTML 静的解析: HT 37 画面 + PC 代表 6 カテゴリ × 2-3 画面のソースコード確認
- viewport メタタグ: `grep -rL 'name="viewport"'` による全ファイル網羅確認
- ブレークポイント幅算出: CSS 固定値から実数計算（320/480/768/1024/1280px）
- 対象リポジトリ: `/Users/tokiyoshiyusuke/github/wms-project-hub/wms-project-hub/test2-mirror/`
- 公開 URL: `https://ytokiyoshi-hub.github.io/wms-project-hub/test2-mirror/`

---

*作成: にーちゃん (assigned_to=7) / BH-Q9 / 2026-05-30*
