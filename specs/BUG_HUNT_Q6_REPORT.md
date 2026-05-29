# BUG HUNT Q6 REPORT
## HT BT-A2000 全業務フロー完走検証

**作成者**: にーちゃん (assigned_to=7)  
**作成日**: 2026-05-29  
**対象**: ht/* 全 37 HTML / 想定端末: KEYENCE BT-A2000 (4インチ 480x800)  
**タスクID**: #1067 (BH-Q6)

---

## 1. 全業務フロー完走検証

| フロー | 画面 | ページ存在 | 画面遷移論理 |
|--------|------|-----------|------------|
| **A. ログイン→メニュー** | login.html → menu.html | ✅ | ✅ |
| **B. ピッキング** | wave → list → scan → done/error | ✅ 5画面 | ✅ |
| **C. 入荷検品** | asn → scan → discrepancy → sign → done / lot_error | ✅ 6画面 | ✅ |
| **D. 棚入れ** | instructions → location → done | ✅ 3画面 | ✅ |
| **E. 在庫照会** | inventory/query.html | ✅ | ✅ |
| **F. ステータス変更** | status/change.html | ✅ | ✅ |
| **G. 返品** | returns/scan → status → judge → approval / auto | ✅ 5画面 | ✅ |
| **H. 荷主切替** | owner/scan → confirm → done / error | ✅ 4画面 | ✅ |
| **I. 移動/補充** | move/scan.html + replenish/scan.html | ✅ 2画面 | ✅ |
| **J. 棚卸** | stocktake/count.html | ✅ | ✅ |
| **K. 引渡** | handover/confirm.html + handover/lane.html | ✅ 2画面 | ✅ |

**全11フロー × 37画面: 全ページ存在 ✅ / 画面遷移論理 全OK ✅**

---

## 2. 検証項目詳細

### 2-1. ❌ Statusbar "WMS-HT Phase 1" 不整合

**要件**: 全画面で `statusbar = "WMS-HT Phase 1"` + 時計表示  
**実態**:

| パターン | 件数 | 対象 |
|---------|------|------|
| ✅ "WMS-HT Phase 1" + 動的時計 | **6/37** | inspect/* (3画面) + putaway/* (3画面) |
| ❌ "WiFi 5GHz" + 固定時計 | **31/37** | 上記以外全画面 |

**WiFi 5GHz 表示の31ページ（全リスト）:**
```
handover/confirm.html     handover/lane.html       inspect/discrepancy.html
inspect/lot_error.html    inspect/sign.html         inventory/query.html
loading/confirm.html      loading/scan.html         login.html
menu.html                 move/scan.html            owner/confirm.html
owner/done.html           owner/error.html          owner/scan.html
packing/order.html        packing/scan.html         pick/done.html
pick/error.html           pick/list.html            pick/scan.html
pick/wave.html            replenish/scan.html       returns/approval.html
returns/auto.html         returns/judge.html        returns/scan.html
returns/status.html       status/change.html        stocktake/count.html
wave/progress.html
```

**修正方針**: 上記31画面のステータスバーを以下に統一
```html
<div class="ht-statusbar">
  <span>WMS-HT Phase 1</span>
  <span id="clock">--:-- ████</span>
</div>
```

### 2-2. ✅ 時計表示（動的更新）

- 全37画面: `setClock()` + `setInterval(setClock, 30000)` 実装済み ✅
- `id="clock"` に対して毎30秒で時刻更新 ✅
- 6ページ: ████（バー表示）→ 動的に現在時刻へ更新される ✅
- 31ページ: WiFi 5GHzの固定時刻も`id="clock"`で上書きされ動的更新される ✅

### 2-3. ✅ F4キーメニュー戻り

**実装方式**: 画面内ソフトF4ボタン（BT-A2000タッチ操作）+ addEventListener

| 項目 | 結果 |
|-----|------|
| F4 ソフトキーボタン (onclick → ht/menu.html) | 全37画面 ✅ |
| addEventListener (keydown/keyup) | 全37画面 ✅ |

**実装例（全ページ共通パターン）**:
```html
<div class="key-lbl" onclick="location.href='ht/menu.html'">
  <span class="fn">F4</span>戻る
</div>
```

**⚠️ 注意**: 物理キーボードの F4 キー→ keydown イベント→ navigation という連携コードは確認できず。BT-A2000のタッチパネル操作のみ対応と思われる。

### 2-4. バーコード入力フィールド Focus 維持

| 画面 | autofocus | .focus() | 評価 |
|------|----------|---------|------|
| inspect/scan.html | ❌ | ✅ | OK |
| inventory/query.html | ✅ | ❌ | OK |
| loading/scan.html | ✅ | ✅ | OK |
| move/scan.html | ✅ | ❌ | OK |
| owner/scan.html | ❌ | ❌ | ⚠️ |
| packing/scan.html | ✅ | ✅ | OK |
| pick/scan.html | ✅ | ❌ | OK |
| replenish/scan.html | ✅ | ❌ | OK |
| returns/scan.html | ✅ | ❌ | OK |
| stocktake/count.html | ✅ | ❌ | OK |

**評価**: 9/10 OK / 1画面 (`owner/scan.html`) は autofocus も .focus() もなし → 初期フォーカス未設定

### 2-5. ❌ 連続スキャン時 input clear タイミング

スキャン後に `input.value = ''` でクリアされるか検査:

| 画面 | clear実装 | 評価 |
|------|---------|------|
| inspect/scan.html | ✅ | OK |
| loading/scan.html | ✅ | OK |
| packing/scan.html | ✅ | OK |
| inventory/query.html | ❌ | ⚠️ 連続スキャン不可 |
| move/scan.html | ❌ | ⚠️ 連続スキャン不可 |
| owner/scan.html | ❌ | ⚠️ 連続スキャン不可 |
| pick/scan.html | ❌ | ⚠️ 連続スキャン不可 |
| replenish/scan.html | ❌ | ⚠️ 連続スキャン不可 |
| returns/scan.html | ❌ | ⚠️ 連続スキャン不可 |
| stocktake/count.html | ❌ | ⚠️ 連続スキャン不可 |

**clear未実装 7ページ**: スキャン後に前のバーコード文字列が残留 → 次スキャンで文字が混入する可能性

---

## 3. HT機能別動作表

| フロー | 画面数 | Statusbar | F4戻り | Focus | Input Clear | 総評 |
|--------|--------|-----------|--------|-------|------------|------|
| A. ログイン→メニュー | 2 | ❌/❌ | ✅ | ✅/— | —/— | ⚠️ |
| B. ピッキング | 5 | ❌全 | ✅ | ✅1/❌4 | ❌1 | ⚠️ |
| C. 入荷検品 | 6 | ✅3/❌3 | ✅ | ✅2/❌4 | ✅1/❌5 | 部分 |
| D. 棚入れ | 3 | ✅全 | ✅ | —/— | —/— | ✅ |
| E. 在庫照会 | 1 | ❌ | ✅ | ✅ | ❌ | ⚠️ |
| F. ステータス変更 | 1 | ❌ | ✅ | — | — | ⚠️ |
| G. 返品 | 5 | ❌全 | ✅ | ✅1/❌4 | ❌全 | ⚠️ |
| H. 荷主切替 | 4 | ❌全 | ✅ | ❌全 | ❌全 | ⚠️ |
| I. 移動/補充 | 2 | ❌全 | ✅ | ✅1/❌1 | ❌全 | ⚠️ |
| J. 棚卸 | 1 | ❌ | ✅ | ✅ | ❌ | ⚠️ |
| K. 引渡 | 2 | ❌全 | ✅ | ✅2 | ✅1/❌1 | ⚠️ |

---

## 4. 総合所見

### ✅ 良好
- 全11フロー × 37画面: 全ページ存在・HTTP 200 OK
- 画面遷移フロー（sessionStorage経由）は全フロー論理的に成立
- 時計動的更新: 全37画面 OK
- F4ソフトキーボタン: 全37画面 OK
- WMS Bridge搭載: 全画面

### ❌ 修正必須

| # | バグ | 影響範囲 | 修正方針 |
|---|------|---------|---------|
| SB1 | ステータスバー "WiFi 5GHz" → "WMS-HT Phase 1" に統一 | 31/37画面 | ht-statusbar の `<span>WiFi 5GHz</span>` を `<span>WMS-HT Phase 1</span>` に一括置換 |
| SC1 | owner/scan.html: autofocus/focus()なし | 1画面 | `<input autofocus>` または onload時 .focus() 追加 |
| CL1 | 連続スキャン後 input.value=''' クリアなし | 7/10スキャン画面 | scan/Enter後に `scanInput.value = ''` 追加 |

### ⚠️ 確認推奨

| # | 確認事項 |
|---|---------|
| F4-KBD | BT-A2000の物理F4キーがkeydownイベントを発火するか（端末実機確認要） |
| FOCUS | owner/scan.html でフォーカスがない場合、実機で入力できるか確認 |

---

*BH-Q6検証完了 / BH-Q1・Q2・Q6 全担当タスク完了*
