# Phase 9-LK2: HTバーコード判定ロジック仕様書

作成日：2026-05-16  
作成者：にーちゃん（id=7）  
対応タスク：#890 Phase 9-LK2  
対応デバイス：キーエンス BT-A2000 / BT-A1000

---

## 概要

HT（ハンディターミナル）でバーコードをスキャンした際に、荷主（owner）の設定（`owners.barcode_required_fields`）に基づいて必須スキャン項目を検証するロジックの仕様を定義する。

---

## 1. 判定ロジックのアルゴリズム

### 1-1. 入力

| 入力値 | 型 | 説明 |
|--------|-----|------|
| `owner_id` | bigint | 荷主 ID（owners.id） |
| `scanned_data` | object | スキャンで収集したフィールドの値 |

`scanned_data` の構造例：
```json
{
  "jan": "4901234000001",
  "lot": "LOT-20260501-A",
  "serial": "SN-PRC-001-001"
}
```

### 1-2. 判定手順

```
FUNCTION validate_barcode_scan(owner_id, scanned_data):
  1. SELECT barcode_required_fields FROM owners WHERE id = owner_id
     → required_str = 'jan,lot' など

  2. required_fields = required_str.split(',').map(trim)
     → ['jan', 'lot'] など

  3. FOR EACH field IN required_fields:
       IF scanned_data[field] IS NULL OR scanned_data[field] == '':
         RETURN ERROR: field + " は必須です"

  4. RETURN OK
```

### 1-3. SQL実装参考（Edge Function や RPC で利用可能）

```sql
-- バーコード判定ロジックの SQL 表現
-- owner_id と スキャン済みフィールドリストを渡して検証する
WITH required AS (
  SELECT unnest(string_to_array(barcode_required_fields, ',')) AS field
  FROM owners
  WHERE id = :owner_id
),
scanned AS (
  SELECT unnest(ARRAY[:scanned_fields]) AS field  -- 例: ARRAY['jan','lot']
)
SELECT r.field AS missing_field
FROM required r
LEFT JOIN scanned s ON s.field = r.field
WHERE s.field IS NULL;
-- → 結果が0件 = OK、1件以上 = NG（missing_field が不足フィールド名）
```

---

## 2. 荷主別バーコード要件（2026-05-16 時点 DB 確認済み）

| 荷主コード | 荷主名 | barcode_required_fields | 必須スキャン項目 |
|------------|--------|------------------------|-----------------|
| TKY | 東京通販株式会社 | `jan` | JAN コードのみ |
| FDB | 富士食品工業株式会社 | `jan,lot` | JAN + ロット番号 |
| PRC | 精和プレシジョン株式会社 | `jan,serial,lot` | JAN + シリアル番号 + ロット番号 |

### フィールド識別子と対応するバーコード種別

| 識別子 | 意味 | バーコード種別 | スキャン対象 |
|--------|------|--------------|------------|
| `jan` | JAN コード（商品識別） | JAN-13 / EAN-13 | 商品ラベル |
| `lot` | ロット番号 | CODE39 / GS1-128 (AI=10) | ロットラベル |
| `serial` | シリアル番号（個体識別） | CODE39 / GS1-128 (AI=21) | 個体シリアルラベル |
| `owner_sku` | 荷主内部 SKU コード | CODE39 | 荷主独自ラベル（将来拡張） |

---

## 3. キーエンス BT-A2000 / BT-A1000 対応要件

### 3-1. 共通仕様（BT-A2000 / BT-A1000 共通）

| 項目 | 仕様 |
|------|------|
| 通信方式 | Bluetooth（BT-A2000）/ 無線 LAN 802.11ac（BT-A1000） |
| 出力形式 | キーボードエミュレーション（Scan-to-Text） |
| 対応バーコード | JAN-13, CODE39, GS1-128, QR Code, DataMatrix |
| GS1-128 対応 | AI(01)GTIN + AI(10)ロット + AI(21)シリアル を 1スキャンで読取可能 |

### 3-2. GS1-128 1スキャン対応フロー

GS1-128 を利用すると 1 スキャンで複数フィールドを取得できる。

```
スキャン例（GS1-128）:
(01)04901234000001(10)LOT-20260501-A(21)SN-PRC-001-001

パース後:
  AI(01) → jan = "4901234000001"
  AI(10) → lot = "LOT-20260501-A"
  AI(21) → serial = "SN-PRC-001-001"
```

HT UI 側での GS1-128 パース関数（こーちゃん実装時参考）：

```javascript
function parseGS1_128(rawScan) {
  const result = {};
  // GS1-128 AI マッピング
  const AI_MAP = {
    '01': 'jan',    // GTIN-14（先頭1桁を除く13桁が JAN コード）
    '10': 'lot',    // バッチ/ロット番号
    '21': 'serial', // シリアル番号
  };
  const AI_REGEX = /\((\d{2,4})\)([^(]+)/g;
  let match;
  while ((match = AI_REGEX.exec(rawScan)) !== null) {
    const [, ai, value] = match;
    if (AI_MAP[ai]) {
      // AI(01) の JAN は 14 桁 GTIN から 13 桁 EAN に変換
      result[AI_MAP[ai]] = ai === '01' ? value.slice(1) : value.trim();
    }
  }
  return result;
}
```

### 3-3. 個別スキャンフロー（GS1-128 非対応ラベルの場合）

GS1-128 が使えない場合は項目ごとに順番にスキャン：

```
Step 1: JAN コードをスキャン → SKU 特定
Step 2: barcode_required_fields に 'lot' があれば → ロット番号をスキャン
Step 3: barcode_required_fields に 'serial' があれば → シリアル番号をスキャン
Step 4: 全必須項目スキャン完了 → 数量入力へ（serial 品は 1 固定）
```

---

## 4. バリデーションエラーメッセージ定義

| 条件 | エラーメッセージ | 処理 |
|------|----------------|------|
| `jan` 未スキャン | 「JAN コードをスキャンしてください」 | スキャン画面に留まる |
| `lot` 未入力（lot 必須荷主） | 「ロット番号を入力してください」 | lot 入力欄にフォーカス |
| `serial` 未スキャン（serial 必須荷主） | 「シリアル番号をスキャンしてください」 | serial 入力欄にフォーカス |
| 未登録 JAN コード | 「この商品はマスタに登録されていません（JAN: XXXX）」 | スキャン画面に戻る |
| 重複シリアル | 「このシリアル番号はすでに登録されています（SN: XXXX）」 | serial 入力欄クリア |
| 他荷主 SKU の JAN | 「この商品は選択中の荷主（TKY）の商品ではありません」 | スキャン画面に戻る |

---

## 5. 業務別スキャンフロー

### 5-1. 入荷スキャン

```
入荷画面起動
  → 荷主選択（or ASN スキャンで荷主自動特定）
  → ASN / work_order 確認
  → [繰り返し] 商品スキャンループ:
      1. JAN スキャン → skus.jan_code で SKU 特定
      2. barcode_required_fields に 'lot' → lot スキャン / 入力
      3. barcode_required_fields に 'serial' → serial スキャン（1スキャン = 1個体）
      4. 数量入力（serial 品は 1 固定）
      5. validate_barcode_scan() でバリデーション
      6. OK → inventory INSERT（暫定在庫）
  → 全品スキャン完了 → 入荷完了
```

### 5-2. 棚入れスキャン

```
棚入れ画面起動
  → 対象品目リスト表示（入荷済み暫定在庫）
  → ロケーションバーコードスキャン
  → 荷主ロケ検証（他荷主ロケはエラー）
  → lot 表示確認（FDB: lot 別で別レコード）
  → serial 一覧確認（PRC: 個体リスト）
  → 棚入れ実行 → inventory.location_id 更新
```

### 5-3. ピッキングスキャン

```
ピッキング画面起動
  → 出荷指示（work_order type=outbound）選択
  → ピッキングリスト表示（allocation_strategy に従い優先順決定）
  → ロケーションスキャン確認
  → JAN スキャン（SKU 照合）
  → barcode_required_fields に 'lot' → lot 確認スキャン（FIFO 指示 lot と照合）
  → barcode_required_fields に 'serial' → serial スキャン（指示シリアルと照合）
  → OK → inventory 減算 / status 更新
```

---

## 6. DB 検証結果（Phase 9-LK2 着手前確認・2026-05-16）

QA6 シナリオ実施前提条件の DB 検証を実施。

### 6-1. owners.barcode_required_fields 確認 ✅

| code | barcode_required_fields | inspection_strategy | putaway_strategy | lot_strategy | 判定 |
|------|------------------------|--------------------|--------------------|--------------|------|
| FDB | jan,lot | full | abc | inbound_batch | ✅ 期待値一致 |
| PRC | jan,serial,lot | full | fixed | manufacturer | ✅ 期待値一致 |
| TKY | jan | sampling | free | none | ✅ 期待値一致 |

### 6-2. skus テーブル確認 ✅

| sku_code | jan_code | serial_required | lot_required | 確認 |
|----------|----------|-----------------|--------------|------|
| TKY-001 | 4901234000001 | — | — | ✅ 存在 |
| FDB-001〜008 | 490223400000x | — | — | ✅ 存在 |
| PRC-001, PRC-002 | 490323400000x | — | — | ✅ 存在 |

**⚠️ QA6 spec との差異**: `test_ht_barcode.md` の SQL で `jan` カラムを参照しているが、実際のカラム名は `jan_code`。HT UI 実装時および QA6 spec の SQL は `jan_code` を使用すること。

### 6-3. locations テーブル確認 ✅

| code | owner | capacity | current_volume | abc_class | 確認 |
|------|-------|----------|---------------|-----------|------|
| TKY-A-01-01-1 | TKY | 200 | 0 | A | ✅ 存在・空き有 |
| FDB-COOL-01-01-1 | FDB | 150 | 0 | A | ✅ 存在・空き有 |
| PRC-PART-01-01-1 | PRC | 100 | 0 | A | ✅ 存在・空き有 |

### 6-4. 未実装確認（HT UI）

| 画面 | ファイルパス | 実装状況 |
|------|------------|---------|
| 入荷 HT | `docs/wms-screens/WMS_Set6_inbound_HT.html` | **未実装** |
| ピッキング HT | `docs/wms-screens/WMS_Set7_outbound2_HT.html` | **未実装** |
| barcode 判定 JS | （汎用モジュール） | **未実装** |

→ HT UI 実装はこーちゃん（id=2）への起票が必要。本仕様書を渡すこと。

---

## 7. こーちゃんへの実装依頼事項（Phase 9-LK3 相当）

本仕様書に基づき、以下の実装をこーちゃんに依頼する：

1. **`docs/wms-screens/WMS_Set6_inbound_HT.html`** 作成
   - 荷主選択 → ASN スキャン → 商品スキャンループ → 入荷完了
   - `barcode_required_fields` に従い lot / serial 入力欄を動的表示
   - GS1-128 パース関数を含む（セクション3-2参照）
   - `validate_barcode_scan()` によるバリデーション実装

2. **`docs/wms-screens/WMS_Set7_outbound2_HT.html`** 作成
   - ロケスキャン → JAN スキャン → lot/serial 確認スキャン → ピッキング完了
   - FIFO 指示 lot との照合ロジック
   - 個体シリアル指示との照合ロジック

3. **`js/barcode-validator.js`** 作成（汎用モジュール）
   - `parseGS1_128(rawScan)` 関数
   - `validateBarcodeScan(owner, scannedData)` 関数
   - エラーメッセージ定義（セクション4参照）

---

## 8. QA6 実施可能状態の確認

| シナリオ | DB 前提条件 | 実施可否 |
|---------|-----------|---------|
| SC-HT-INB-01〜03 | owners/skus/locations ✅ | HT UI 実装後に実施可能 |
| SC-HT-PUT-01〜03 | owners/locations ✅ | HT UI 実装後に実施可能 |
| SC-HT-PCK-01〜03 | owners/skus/locations ✅ | HT UI 実装後に実施可能 |
| SC-HT-ERR-01〜03 | owners ✅ | HT UI 実装後に実施可能 |

DB 層は全シナリオの前提条件を満たしている。HT UI 実装（こーちゃん）完了後に QA6 全 12 シナリオの実施が可能。

---

*このドキュメントはにーちゃん（id=7）が Phase 9-LK2（#890）として作成した。*  
*HT UI 実装（Phase 9-LK3）はこーちゃん（id=2）への起票が必要。*
