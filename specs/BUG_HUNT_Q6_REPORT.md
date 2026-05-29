# BUG HUNT Q6 REPORT
## HT BT-A2000 全業務フロー完走検証

**作成者**: にーちゃん (assigned_to=7)  
**作成日**: 2026-05-29  
**対象**: ht/* 全 37 HTML / 想定端末: KEYENCE BT-A2000 (4インチ 480x800)  
**タスクID**: #1067 (BH-Q6)  
**検証方法**: ローカルファイル直接解析 + grep 一括チェック

---

## 1. 全業務フロー完走表

| フロー | 画面構成 | ページ存在 | 遷移論理 |
|--------|----------|-----------|---------|
| **A. ログイン→メニュー** | login.html → menu.html | ✅ 2画面 | ✅ |
| **B. ピッキング** | wave → list → scan → done (+ error) | ✅ 5画面 | ✅ |
| **C. 入荷検品** | asn → scan → discrepancy → sign → done (+ lot_error) | ✅ 6画面 | ✅ |
| **D. 棚入れ** | instructions → location → done | ✅ 3画面 | ✅ |
| **E. 在庫照会** | inventory/query.html | ✅ 1画面 | ✅ |
| **F. ステータス変更** | status/change.html | ✅ 1画面 | ✅ |
| **G. 返品** | scan → status → judge → approval / auto | ✅ 5画面 | ✅ |
| **H. 荷主切替** | scan → confirm → done (+ error) | ✅ 4画面 | ✅ |
| **I. 移動/補充** | move/scan.html + replenish/scan.html | ✅ 2画面 | ✅ |
| **J. 棚卸** | stocktake/count.html | ✅ 1画面 | ✅ |
| **K. 引渡** | handover/lane.html → handover/confirm.html | ✅ 2画面 | ✅ |

**全37画面: ページ存在・遷移論理 OK** (wave/progress.html + packing/* 含む)

---

## 2. 検証項目詳細

### 2-1. ❌ CRITICAL: inspect/scan.html の F4 キー不機能

**発見**: `inspect/scan.html` の F4 ラベルに `onclick` ハンドラが存在しない。

```html
<!-- inspect/scan.html line 79 -->
<div class="key-lbl"><span class="fn">F4</span>メニュー</div>
<!-- ↑ onclick 属性なし → タップしても何も起きない -->
```

- **期待動作**: F4 → `ht/menu.html` へ遷移
- **実際の動作**: ボタンを押しても反応なし（デッドボタン）
- **影響**: 入荷検品スキャン中にメニューに戻れない → 作業中断不能

**修正案**:
```html
<div class="key-lbl" onclick="location.href='ht/menu.html'"><span class="fn">F4</span>メニュー</div>
```

---

### 2-2. ❌ ステータスバー "WMS-HT Phase 1" 不整合

**要件**: 全画面で `statusbar = "WMS-HT Phase 1"` + 時計表示

| パターン | 件数 | 該当画面 |
|---------|------|---------|
| ✅ "WMS-HT Phase 1" | 6/37 | inspect/asn, inspect/scan, inspect/done, putaway/done, putaway/instructions, putaway/location |
| ❌ "WiFi 5GHz" | 31/37 | 上記以外全画面 |

**注目点**: inspect フロー内でも不統一
- inspect/asn.html → **WMS-HT Phase 1** ✅
- inspect/scan.html → **WMS-HT Phase 1** ✅  
- inspect/discrepancy.html → **WiFi 5GHz** ❌ ← 同フロー内で混在
- inspect/lot_error.html → **WiFi 5GHz** ❌
- inspect/sign.html → **WiFi 5GHz** ❌
- inspect/done.html → **WMS-HT Phase 1** ✅

**修正対象 31ファイル（全リスト）**:
```
handover/confirm.html   handover/lane.html      inspect/discrepancy.html
inspect/lot_error.html  inspect/sign.html       inventory/query.html
loading/confirm.html    loading/scan.html        login.html
menu.html               move/scan.html           owner/confirm.html
owner/done.html         owner/error.html         owner/scan.html
packing/order.html      packing/scan.html        pick/done.html
pick/error.html         pick/list.html           pick/scan.html
pick/wave.html          replenish/scan.html      returns/approval.html
returns/auto.html       returns/judge.html       returns/scan.html
returns/status.html     status/change.html       stocktake/count.html
wave/progress.html
```

**一括修正コマンド（要動作確認後に適用）**:
```bash
find ht/ -name "*.html" | xargs sed -i 's/<span>WiFi 5GHz<\/span>/<span>WMS-HT Phase 1<\/span>/g'
```

---

### 2-3. ✅ 時計表示（動的更新）

全37画面で `setClock()` + `setInterval(setClock, 30000)` 実装済み ✅  
30秒ごとに `id="clock"` の現在時刻を更新。  

バッテリー表示に不整合あり（軽微）:
- 一部画面: `████`（ブロック文字）
- 他画面: `88%`, `87%` 等のパーセンテージ

---

### 2-4. F4 キーメニュー戻り（全画面）

**⚠️ 注意**: 上記 inspect/scan.html の F4 不具合を除く。

**実装方式の分類**:

| 実装パターン | 画面数 | 評価 |
|------------|--------|------|
| `onclick="location.href='ht/menu.html'"` | 21画面 | ✅ 直接メニュー遷移 |
| `onclick="history.back()"` | 8画面 | ⚠️ 前画面に戻る（メニューとは限らない） |
| onclick なし（デッドボタン） | 1画面 | ❌ inspect/scan.html |
| ログアウト/終了 | 2画面 | ✅ login/menu は別扱いで正常 |
| F2 で戻り（F4 は中止→メニュー） | 4画面 | ✅ returns/* は F2 が戻り、F4 が中止 |

**`history.back()` 使用画面（要確認）**:
- pick/scan.html, pick/done.html, pick/error.html
- packing/scan.html
- inspect/discrepancy.html, inspect/lot_error.html, inspect/sign.html
- owner/confirm.html

直線フローでは history.back() = 正常動作するが、外部リンクや直接URL入力で画面を開いた場合はメニューに戻れない可能性あり。

---

### 2-5. バーコード入力フィールド Focus 維持

| 画面 | autofocus | .focus() 呼出 | 評価 |
|------|-----------|-------------|------|
| login.html | ✅ | — | ✅ |
| inspect/scan.html | ❌ | ✅ (スキャン後) | ✅ |
| inventory/query.html | ✅ | — | ✅ |
| loading/scan.html | ✅ | ✅ | ✅ |
| loading/confirm.html | ✅ | ✅ | ✅ |
| move/scan.html | ✅ | — | ✅ |
| **owner/scan.html** | **❌** | **❌** | **❌ 初期フォーカスなし** |
| packing/order.html | ✅ | — | ✅ |
| packing/scan.html | ✅ | ✅ | ✅ |
| pick/scan.html | ✅ | — | ✅ |
| pick/done.html | ✅ (qty-input) | — | ✅ |
| putaway/location.html | ✅ | — | ✅ |
| replenish/scan.html | ✅ | — | ✅ |
| returns/scan.html | ✅ | — | ✅ |
| stocktake/count.html | ✅ | — | ✅ |
| handover/lane.html | ✅ | — | ✅ |
| handover/confirm.html | ✅ | ✅ (スキャン後) | ✅ |

**問題**: `owner/scan.html` は autofocus も .focus() 呼出もなし → 端末でバーコードスキャン時にフォーカスが当たっているか不明

---

### 2-6. 連続スキャン時 input clear タイミング

スキャン確定後に `scanInput.value = ''` でフィールドをクリアするか検査:

| 画面 | clear実装 | 評価 |
|------|---------|------|
| inspect/scan.html | ✅ (jan-input + qty-input両方) | ✅ |
| handover/confirm.html | ✅ | ✅ |
| loading/scan.html | ✅ | ✅ |
| loading/confirm.html | ✅ | ✅ |
| packing/scan.html | ✅ (複数ケース対応) | ✅ |
| inventory/query.html | ❌ | ⚠️ |
| move/scan.html | ❌ | ⚠️ |
| owner/scan.html | ❌ | ⚠️ |
| **pick/scan.html** | **❌（SKU不一致時のみ）** | **❌ 不一致時にvalue残留+alert後にフォーカス戻らず** |
| replenish/scan.html | ❌ | ⚠️ |
| returns/scan.html | ❌ | ⚠️ |
| stocktake/count.html | ❌ | ⚠️ |

**pick/scan.html の特記事項**:
```javascript
// scan一致: 即 navigate → clear不要
if (v === targetJan) location.href = 'ht/pick/done.html';
// scan不一致: alert() だけ → value 残留 + フォーカスが input から外れる
else alert('SKU不一致 (期待: ' + targetJan + ')');
// → alert dismiss後、前のNG値が残ったまま次スキャンを待つ状態になる
```

**修正案（pick/scan.html）**:
```javascript
else {
  alert('SKU不一致 (期待: ' + targetJan + ')');
  e.target.value = '';        // クリア
  e.target.focus();           // フォーカス戻す
}
```

---

## 3. HT機能別動作表（全フロー）

| フロー | 画面数 | Statusbar | F4メニュー | Focus | Input Clear | 総評 |
|--------|--------|-----------|-----------|-------|------------|------|
| A. ログイン→メニュー | 2 | ❌/❌ | ✅ | ✅/— | —/— | ⚠️ SB |
| B. ピッキング | 5 | ❌全 | ⚠️ history.back×3 | ✅×2/—×3 | ❌(不一致時) | ⚠️ |
| C. 入荷検品 | 6 | ✅×3/❌×3 | ❌ **scan.html F4デッド** | ✅×2/—×4 | ✅×1/—×5 | ❌ |
| D. 棚入れ | 3 | ✅全 | ✅全 | ✅×1/—×2 | —/— | ✅ |
| E. 在庫照会 | 1 | ❌ | ✅ | ✅ | ❌ | ⚠️ SB |
| F. ステータス変更 | 1 | ❌ | ✅ | — | — | ⚠️ SB |
| G. 返品 | 5 | ❌全 | ✅全 (F4=中止→menu) | ✅×1/—×4 | ❌全 | ⚠️ SB |
| H. 荷主切替 | 4 | ❌全 | ⚠️ confirm=history.back | ❌全 | ❌全 | ⚠️ |
| I. 移動/補充 | 2 | ❌全 | ✅全 | ✅×1/—×1 | ❌全 | ⚠️ SB |
| J. 棚卸 | 1 | ❌ | ✅ | ✅ | ❌ | ⚠️ SB |
| K. 引渡 | 2 | ❌全 | ✅全 | ✅全 | ✅×1/—×1 | ⚠️ SB |

---

## 4. バグ優先度一覧

| # | 重大度 | バグ内容 | 影響ファイル | 修正方針 |
|---|--------|---------|------------|---------|
| **BUG-001** | 🔴 CRITICAL | inspect/scan.html の F4「メニュー」onclick なし → デッドボタン | 1ファイル | `onclick="location.href='ht/menu.html'"` 追加 |
| **BUG-002** | 🟠 HIGH | ステータスバー "WiFi 5GHz" → "WMS-HT Phase 1" 不統一 | 31ファイル | 一括 sed 置換 |
| **BUG-003** | 🟠 HIGH | inspect フロー内でステータスバー混在（同フロー内で 2種類） | discrepancy/lot_error/sign | 上記と同じ修正 |
| **BUG-004** | 🟡 MEDIUM | pick/scan.html: SKU不一致時に input.value 残留 + フォーカス戻らず | 1ファイル | alert後に `.value=''` + `.focus()` 追加 |
| **BUG-005** | 🟡 MEDIUM | owner/scan.html: autofocus/focus() なし | 1ファイル | `autofocus` 属性追加 |
| **BUG-006** | 🟡 MEDIUM | 連続スキャン後 input.value クリアなし（7スキャン画面） | 7ファイル | scan ENT 後に `el.value=''` 追加 |
| **BUG-007** | 🟢 LOW | F4 が history.back() の画面（直接URL遷移時にメニューに戻れない） | 8ファイル | `location.href='ht/menu.html'` に統一（任意） |
| **BUG-008** | 🟢 LOW | バッテリー表示が `████` と `87%` の2形式混在 | 6ファイル | 統一（任意） |

---

## 5. 総合評価

### ✅ 問題なし
- 全11フロー × 37画面: 全ページ存在
- sessionStorage 経由の画面間データ引き渡し: 全フロー論理的に成立
- 時計動的更新: 全37画面 (setClock + setInterval) ✅
- WMS Bridge (API モック) 搭載: 全画面 ✅
- 返品フロー F4 挙動: F2=前画面戻り / F4=中止→menu の2段構成で正常

### ❌ 修正必須
1. **BUG-001**: inspect/scan.html F4 デッドボタン → 入荷検品中断不能
2. **BUG-002/003**: ステータスバー不統一 (31/37画面)
3. **BUG-004**: ピック不一致後の入力フィールドリセット未実装

### ⚠️ 実機確認推奨
- BT-A2000 物理 F4 キー → keydown イベント発火確認（全画面ソフトキー前提の実装のため）
- owner/scan.html のフォーカス確認（実機でバーコードが入力フィールドに入るか）
- history.back() 画面（8画面）の実運用での F4 挙動確認

---

*BH-Q6 検証完了 / にーちゃん (assigned_to=7) 実施 / 2026-05-29*
