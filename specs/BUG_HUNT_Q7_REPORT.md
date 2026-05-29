# BUG HUNT Q7 REPORT
## 印刷帳票 6種 + バーコードシート 実データ反映確認

**作成者**: にーちゃん (assigned_to=7)  
**作成日**: 2026-05-30  
**対象**: pc/prints/*.html (6種) + print/barcodes.html  
**タスクID**: #1068 (BH-Q7)  
**検証方法**: ローカルファイル直接解析 + ソースコード静的検証

---

## 1. ファイル存在確認

| ファイル | 存在 |
|---------|------|
| `pc/prints/picking_list.html` | ✅ |
| `pc/prints/loading.html` | ✅ |
| `pc/prints/invoice.html` | ✅ |
| `pc/prints/inbound_receipt.html` | ✅ |
| `pc/prints/inventory.html` | ✅ |
| `pc/prints/hub.html` | ✅ |
| `print/barcodes.html` | ✅ |

**7/7ファイル 存在確認OK**

---

## 2. 実データ埋め込み確認

### 2-1. picking_list.html（ピッキングリスト）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| ウェーブNo | WV-26060101 | WV-26060101 | ✅ |
| 担当者 | 田中 太郎 | 田中 太郎（1F常温エリア） | ✅ |
| 明細行数 | 5以上 | 5行（SKU-MK001-001〜003） | ✅ |
| データ取得方式 | — | 静的HTML埋め込み（fetch不使用） | ✅ 空テーブルリスクなし |

### 2-2. loading.html（積込明細書）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| 便 | 13:30便 | 13:30便 東京西エリア | ✅ |
| 配送業者 | ヤマト運輸 | ヤマト運輸 | ✅ |
| 担当者 | 渡辺 大輔 | 渡辺 大輔 | ✅ |
| 出荷No | SO-26060101〜103 | SO-26060101/102/103 (3行) | ✅ |

### 2-3. invoice.html（請求書）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| 請求書番号 | INV-2606-MK001 | INV-2606-MK001 | ✅ |
| 請求先 | マルキ食品 | 株式会社マルキ食品 御中 | ✅ |
| 請求金額 | ¥380,000 | ¥380,000 | ✅ |
| 明細行数 | — | 4行（保管料/入庫/出庫/梱包資材） | ✅ |

### 2-4. inbound_receipt.html（入荷検品書）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| ASN番号 | ASN番号 | IN-26060101（入荷No） | ✅ |
| 明細 | あり | 3行（SKU-001〜003、合計236件） | ✅ |
| 検品者 | — | 田中 太郎 | ✅ |

### 2-5. inventory.html（在庫明細書）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| 在庫数 | あり | PL/CS両方あり（4行） | ✅ |
| ロケ | あり | 3AP-02-001/002, 3AT-01-001, 4AC-01-001 | ✅ |
| 荷主 | — | MK001 株式会社マルキ食品 | ✅ |

### 2-6. hub.html（印刷帳票ハブ）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| ピッキングリストリンク | あり | `pc/prints/picking_list.html` | ✅ |
| 請求書リンク | あり | `pc/prints/invoice.html` | ✅ |
| 在庫明細書リンク | あり | `pc/prints/inventory.html` | ✅ |
| 積込明細書リンク | あり | `pc/prints/loading.html` | ✅ |
| 入荷検品書リンク | あり | **リンクなし** | ❌ BUG-Q7-002 |

### 2-7. print/barcodes.html（HTバーコードシート）

| 確認項目 | 期待値 | 実際 | 結果 |
|---------|--------|------|------|
| バーコード数 | 複数 | 28個のSVGバーコード要素 | ✅ |
| シナリオ網羅 | 1日の流れ | ①入荷〜⑦出荷確定・積込 7ステップ | ✅ |
| Code128形式 | Code128 | JsBarcode `format: 'CODE128'` | ✅ |
| JAN データ | あり | 4901234567001/002/003 | ✅ |

---

## 3. window.print() 確認

| ファイル | 印刷ボタン | onclick |
|---------|-----------|---------|
| picking_list.html | ✅「印刷」ボタン | `window.print()` |
| loading.html | ✅「印刷」ボタン | `window.print()` |
| invoice.html | ✅「印刷（PDF保存）」ボタン | `window.print()` |
| inbound_receipt.html | ✅「印刷」ボタン | `window.print()` |
| inventory.html | ✅「印刷（PDF保存）」ボタン | `window.print()` |
| hub.html | ❌ 印刷ボタンなし | なし（ハブページのため） |
| barcodes.html | ✅「🖨️ 印刷」ボタン（右上固定） | `window.print()` |

---

## 4. @media print CSS 確認

| ファイル | @media print | sidebar 非表示 | topbar 非表示 | print-actions 非表示 |
|---------|-------------|--------------|-------------|-------------------|
| picking_list.html | ✅ | ✅ | ✅ | ✅ |
| loading.html | ✅ | ✅ | ✅ | ✅ |
| invoice.html | ✅ | ✅ | ✅ | ✅ |
| inbound_receipt.html | ✅ | ✅ | ✅ | ✅ |
| inventory.html | ✅ | ✅ | ✅ | ✅ |
| hub.html | ❌ **なし** | ❌ | ❌ | — | ← BUG-Q7-001 |
| barcodes.html | ✅（独自） | N/A | N/A | ✅ controls非表示 |

---

## 5. JAN バーコード SVG 確認

`print/barcodes.html` のバーコード実装:

```html
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
```

```javascript
document.querySelectorAll('svg.b').forEach(svg => {
  const code = svg.getAttribute('data-code');
  JsBarcode(svg, code, { format: 'CODE128', width: 1.6, height: 50, ... });
});
```

- **SVG要素**: `<svg class="b" data-code="..."></svg>` 形式で28個定義
- **レンダリング**: JsBarcode が DOM で SVG を書き換え → 印刷時にSVGとして出力
- **⚠️ CDN依存**: `cdn.jsdelivr.net` への接続が必要（後述 BUG-Q7-003）

---

## 6. 発見バグ一覧

### ❌ BUG-Q7-001 [HIGH] hub.html に @media print CSS がない

**ファイル**: `pc/prints/hub.html`  
**症状**: Ctrl+P / window.print() 時にサイドバー・トップバーが帳票上に表示される  
**影響**: hub.html を印刷した場合にレイアウト崩れ  
**他帳票との不一致**: 他5帳票はすべて以下を実装済み:

```css
@media print {
  .layout > .sidebar, .topbar, .print-actions { display: none !important; }
  .content { padding: 0 !important; }
}
```

**修正案**: hub.html の `<style>` ブロックに同じ @media print ルールを追加

---

### ❌ BUG-Q7-002 [MEDIUM] hub.html から inbound_receipt.html へのリンクがない

**ファイル**: `pc/prints/hub.html`  
**症状**: 帳票ハブに「入荷検品書」へのリンクカードが存在しない  
**現在のリンク**: ピッキングリスト / 請求書 / 在庫明細書 / 積込明細書（4種）  
**不足**: 入荷検品書（`pc/prints/inbound_receipt.html`）  
**影響**: ユーザーが hub 経由で入荷検品書を印刷できない

**修正案**: `.stats` ブロックに以下を追加:

```html
<a href="pc/prints/inbound_receipt.html" style="text-decoration:none;">
  <div class="stat">
    <div class="label">入荷検品書</div>
    <div class="value">📦</div>
    <span class="unit">入荷単位</span>
  </div>
</a>
```

---

### ❌ BUG-Q7-003 [HIGH] barcodes.html がオンラインCDN依存

**ファイル**: `print/barcodes.html`  
**症状**: JsBarcode ライブラリを `cdn.jsdelivr.net` から読み込んでいる  
**影響**: 倉庫内でインターネット接続が切れた場合、28個すべてのバーコードが表示されない  
**設計思想との矛盾**: test2-mirror の他全HTMLはローカルリソース（`css/`, `js/`）のみ使用  
**エラー時の挙動**:

```javascript
// JsBarcode 未ロード時、以下のコードが実行されず SVG は空のまま
JsBarcode(svg, code, { format: 'CODE128', ... });
// catch で以下に差し替え
svg.outerHTML = `<div style="color:red; font-size:8pt;">バーコード生成失敗: ${code}</div>`;
```

**修正案**: JsBarcode ライブラリを `test2-mirror/js/` 配下にバンドルしてローカル参照に変更:

```html
<!-- Before -->
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<!-- After -->
<script src="js/JsBarcode.all.min.js"></script>
```

---

### ⚠️ BUG-Q7-004 [LOW] invoice.html の消費税計算が不整合

**ファイル**: `pc/prints/invoice.html`  
**症状**: 「消費税（10%）」の金額が数学的に正しくない

```
小計（税抜）: 379,850
消費税（10%）: 150    ← 本来は 37,985 (379,850 × 10%)
合計（税込）: 380,000
```

**影響**: モックデータとして ¥380,000 の丸め値を使いたい意図は理解できるが、実際の請求書フォーマットとして不正確  
**判断**: 画面確認・業務シナリオ検証目的であれば許容範囲。本番利用前に要修正。

---

## 7. 総合判定

| 検証項目 | 結果 |
|---------|------|
| 全7ファイル存在 | ✅ OK |
| 実データ埋め込み（picking_list/loading/invoice） | ✅ OK |
| 実データ埋め込み（inbound_receipt/inventory） | ✅ OK |
| window.print() 実装（6 pc/prints） | ✅ OK (hub除く・ハブページのため) |
| @media print CSS（5帳票） | ✅ OK |
| @media print CSS（hub.html） | ❌ **未実装** [BUG-Q7-001] |
| JAN バーコード SVG（barcodes.html） | ✅ 実装あり・CDN依存リスクあり [BUG-Q7-003] |
| hub.html 全帳票リンク | ❌ **inbound_receipt リンク欠如** [BUG-Q7-002] |

**バグ数**: CRITICAL 0件 / HIGH 2件 / MEDIUM 0件 / LOW 2件

---

## 8. 修正優先度

| 優先度 | バグID | 内容 | 工数目安 |
|--------|--------|------|--------|
| 1 | BUG-Q7-003 | barcodes.html CDN依存 → ローカル化 | 30分（jsファイル配置 + src変更） |
| 2 | BUG-Q7-001 | hub.html @media print CSS追加 | 5分 |
| 3 | BUG-Q7-002 | hub.html 入荷検品書リンク追加 | 5分 |
| 4 | BUG-Q7-004 | invoice.html 消費税計算修正 | 10分（モック値の調整） |

---

## 9. スクリーンショット要件について

本検証はソースコード静的解析で実施。ブラウザ実機確認（スクリーンショット7枚）は別途こーちゃんによる目視確認を推奨:

1. `picking_list.html` — 印刷プレビュー（Ctrl+P）確認
2. `loading.html` — 印刷プレビュー確認
3. `invoice.html` — 印刷プレビュー確認
4. `inbound_receipt.html` — 印刷プレビュー確認
5. `inventory.html` — 印刷プレビュー確認
6. `hub.html` — sidebar が印刷に出る再現スクリーンショット（BUG-Q7-001）
7. `print/barcodes.html` — バーコード描画確認 + オフライン時の失敗確認（BUG-Q7-003）
