# Phase 9-QA6: HT バーコードスキャン 検証シナリオ（LK-2 対応）

作成日：2026-05-10  
更新日：2026-07-01（LK-2統合版 #1118）  
作成者：にーちゃん（id=7）  
対応タスク：#850 Phase 9-QA6 / #1118 Phase 9-QA6（LK-2対応更新）  
致命傷ライン：LK-2（HT バーコード仕様）  
参照仕様書：`specs/ht_barcode_judgment_spec.md`（Phase 9-LK2）

---

## 概要

HT（ハンディターミナル）でバーコードをスキャンして入荷・検品・棚入れ・ピッキングを完結させる検証シナリオ。  
`owners.barcode_required_fields` に設定された値によって、HT 画面で要求されるスキャン項目が変わる。  
本ドキュメントでは 3 つの設定パターン（荷主別）× 4 業務（入荷/検品/棚入れ/ピッキング）の検証手順を定義する。

### LK-2 統合内容（2026-07-01 更新）

| 追加内容 | 説明 |
|---------|------|
| SC-HT-GS1-01 | GS1-128 1スキャンで JAN+lot+serial を一括取得するシナリオ追加 |
| SC-HT-INS-01〜03 | 入荷後の検品スキャンシナリオ追加（P1/P2/P3 各荷主） |
| API テスト | POST /inbound-orders, PUT /receive の API レベル検証追加 |
| キーエンス BT 仕様 | BT-A2000/BT-A1000 対応要件セクション追加 |
| SQL カラム名確認 | jan_code カラム名の正確性を全 SQL で確認済み（実 DB と一致） |

---

## `owners.barcode_required_fields` 設定パターン

| パターン | 荷主 | barcode_required_fields | 説明 |
|---------|------|------------------------|------|
| **P1** | 東京通販株式会社（TKY） | `jan` | JAN コードのみ。最シンプル構成 |
| **P2** | 富士食品工業株式会社（FDB） | `jan,lot` | JAN + ロット番号。食品の期限日管理に対応 |
| **P3** | 精和プレシジョン株式会社（PRC） | `jan,serial,lot` | JAN + シリアル番号 + ロット番号。精密機器の個体管理 |

### フィールド識別子定義

| 識別子 | 意味 | バーコード種別 | 必須スキャン対象 |
|--------|------|--------------|----------------|
| `jan` | JAN コード（商品バーコード） | JAN-13 / EAN-13 | 商品ラベルの JAN バーコード |
| `lot` | ロット番号 | CODE39 / GS1-128 (AI=10) | ロットラベルのバーコード（または手入力） |
| `serial` | シリアル番号 | CODE39 / GS1-128 (AI=21) | 個体シリアルラベル（1スキャン = 1個体） |
| `owner_sku` | 荷主内部 SKU コード | CODE39 | 荷主独自の SKU バーコード（将来拡張用） |

---

## キーエンス BT-A2000 / BT-A1000 対応要件

### 共通仕様

| 項目 | 仕様 |
|------|------|
| 通信方式 | BT-A2000: Bluetooth / BT-A1000: 無線 LAN 802.11ac |
| 出力形式 | キーボードエミュレーション（Scan-to-Text） |
| 対応バーコード | JAN-13, CODE39, GS1-128, QR Code, DataMatrix |
| GS1-128 対応 | AI(01)GTIN + AI(10)ロット + AI(21)シリアル を 1スキャンで読取可能 |

### GS1-128 パース関数（UI実装時参考）

```javascript
function parseGS1_128(rawScan) {
  const result = {};
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
      result[AI_MAP[ai]] = ai === '01' ? value.slice(1) : value.trim();
    }
  }
  return result;
}
```

### バリデーションエラーメッセージ定義

| 条件 | エラーメッセージ | 処理 |
|------|----------------|------|
| `jan` 未スキャン | 「JAN コードをスキャンしてください」 | スキャン画面に留まる |
| `lot` 未入力（lot 必須荷主） | 「ロット番号を入力してください」 | lot 入力欄にフォーカス |
| `serial` 未スキャン（serial 必須荷主） | 「シリアル番号をスキャンしてください」 | serial 入力欄にフォーカス |
| 未登録 JAN コード | 「この商品はマスタに登録されていません（JAN: XXXX）」 | スキャン画面に戻る |
| 重複シリアル | 「このシリアル番号はすでに登録されています（SN: XXXX）」 | serial 入力欄クリア |
| 他荷主 SKU の JAN | 「この商品は選択中の荷主（TKY）の商品ではありません」 | スキャン画面に戻る |

---

## テスト環境

| 項目 | 値 |
|------|-----|
| Supabase Project ID | wqjsemttubzbpauvgyai |
| Supabase URL | https://wqjsemttubzbpauvgyai.supabase.co |
| Staging URL | https://shacho-shitsu-git-develop-ytokiyoshi-2875s-projects.vercel.app |
| HT 画面 URL（入荷） | staging URL + `/WMS_Set6_inbound_HT.html` |
| HT 画面 URL（ピッキング） | staging URL + `/WMS_Set7_outbound2_HT.html` |

---

## 事前確認 SQL

シナリオ実施前に荷主マスタの barcode_required_fields が期待値通りか確認する。

```sql
SELECT id, code, name, barcode_required_fields,
       inspection_strategy, putaway_strategy, lot_strategy
FROM owners
WHERE code IN ('TKY', 'FDB', 'PRC')
ORDER BY code;
```

**期待値（2026-05-16 実 DB 確認済み）：**

| code | barcode_required_fields | inspection_strategy | putaway_strategy | lot_strategy |
|------|------------------------|--------------------|--------------------|--------------|
| FDB | jan,lot | full | abc | inbound_batch |
| PRC | jan,serial,lot | full | fixed | manufacturer |
| TKY | jan | sampling | free | none |

---

## 業務1：入荷スキャン検証

### SC-HT-INB-01：P1（TKY・JAN のみ）での入荷スキャン

**前提条件：**
- TKY 荷主の入荷 work_order が `approved` または `in_progress` 状態で存在する
- SKU: TKY-001（JAN: 4901234000001）× 20個 を入荷予定

**テストデータ投入 SQL：**

```sql
-- TKY の SKU 確認
SELECT id, sku_code, jan_code FROM skus WHERE owner_id = (SELECT id FROM owners WHERE code='TKY') LIMIT 3;

-- 入荷 work_order 作成
INSERT INTO work_orders (owner_id, order_type, status, priority, external_ref, notes, scheduled_date)
SELECT id, 'inbound', 'approved', 2, 'ASN-QA6-TKY-01', 'QA6テスト P1入荷スキャン', CURRENT_DATE
FROM owners WHERE code = 'TKY'
RETURNING id;
```

**HT 操作手順：**

1. HT で入荷画面（`WMS_Set6_inbound_HT.html`）を開く
2. 荷主「東京通販株式会社（TKY）」を選択
3. ASN 番号「ASN-QA6-TKY-01」をスキャンまたは手入力して入荷開始
4. 商品スキャン画面が表示される
5. JAN コード「4901234000001」をスキャン
6. 画面に SKU 名「Tシャツ（白・M）」と数量入力欄が表示されることを確認
7. 数量「20」を入力して「OK」
8. 追加スキャン項目が**表示されないこと**を確認（lot/serial の入力欄なし）
9. 「入荷完了」をタップ

**合否判定チェックリスト（SC-HT-INB-01）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | JAN スキャンで SKU が特定される | HT 画面目視 | SKU 名が表示される | □ |
| 2 | lot 入力欄が表示されない | HT 画面目視 | lot フィールドなし（TKY は lot 不要） | □ |
| 3 | serial 入力欄が表示されない | HT 画面目視 | serial フィールドなし | □ |
| 4 | 在庫加算（DB 確認） | 下記 DB 確認 SQL | quantity=20, owner_id=TKY | □ |
| 5 | lot_id が NULL | DB 確認 SQL | inventory.lot_id IS NULL | □ |

**DB 確認 SQL：**

```sql
SELECT i.quantity, i.status, i.lot_id, s.sku_code, l.code AS location
FROM inventory i
JOIN skus s ON s.id = i.sku_id
JOIN locations l ON l.id = i.location_id
JOIN owners o ON o.id = i.owner_id
WHERE o.code = 'TKY' AND s.sku_code = 'TKY-001'
ORDER BY i.created_at DESC LIMIT 3;
-- lot_id IS NULL であること（TKY は lot 管理なし）
```

---

### SC-HT-INB-02：P2（FDB・JAN + lot）での入荷スキャン

**前提条件：**
- FDB 荷主の入荷 work_order が存在する
- SKU: FDB-001（食品）× 30個 を入荷予定
- ロット番号: `LOT-20260501-A`（製造日からの自動採番想定）

**テストデータ投入 SQL：**

```sql
-- FDB の SKU 確認
SELECT id, sku_code, jan_code, lot_required FROM skus
WHERE owner_id = (SELECT id FROM owners WHERE code='FDB') LIMIT 3;

-- 入荷 work_order 作成
INSERT INTO work_orders (owner_id, order_type, status, priority, external_ref, notes, scheduled_date)
SELECT id, 'inbound', 'approved', 2, 'ASN-QA6-FDB-01', 'QA6テスト P2入荷スキャン（lot要）', CURRENT_DATE
FROM owners WHERE code = 'FDB'
RETURNING id;
```

**HT 操作手順：**

1. HT で入荷画面を開き、荷主「富士食品工業株式会社（FDB）」を選択
2. ASN 番号「ASN-QA6-FDB-01」をスキャン
3. JAN コードをスキャン → SKU が特定される
4. **ロット番号入力欄が表示されること**を確認（barcode_required_fields = 'jan,lot'）
5. ロット番号「LOT-20260501-A」をスキャンまたは手入力
6. 数量「30」を入力して「OK」
7. serial 入力欄が**表示されないこと**を確認（FDB は serial 不要）
8. 「入荷完了」をタップ

**合否判定チェックリスト（SC-HT-INB-02）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | JAN スキャン後に lot 入力欄が表示される | HT 画面目視 | lot フィールドが必須表示 | □ |
| 2 | lot なしで「OK」するとエラーになる | HT 操作 | 「ロット番号を入力してください」等のエラー | □ |
| 3 | serial 入力欄が表示されない | HT 画面目視 | serial フィールドなし | □ |
| 4 | lot レコードが lots テーブルに作成される | 下記 DB 確認 SQL | lot_number='LOT-20260501-A' が存在 | □ |
| 5 | inventory に lot_id がセットされる | DB 確認 SQL | inventory.lot_id NOT NULL | □ |
| 6 | 在庫数（DB 確認） | DB 確認 SQL | quantity=30 | □ |

**DB 確認 SQL：**

```sql
-- lot レコード確認
SELECT l.id, l.lot_number, l.source_type, l.mfg_date, l.expiry_date, s.sku_code
FROM lots l
JOIN skus s ON s.id = l.sku_id
JOIN owners o ON o.id = l.owner_id
WHERE o.code = 'FDB' AND l.lot_number = 'LOT-20260501-A';

-- 在庫 + lot 紐付き確認
SELECT i.quantity, i.lot_id, l.lot_number, s.sku_code, loc.code AS location
FROM inventory i
JOIN skus s ON s.id = i.sku_id
JOIN lots l ON l.id = i.lot_id
JOIN locations loc ON loc.id = i.location_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='FDB')
ORDER BY i.created_at DESC LIMIT 3;
```

---

### SC-HT-INB-03：P3（PRC・JAN + serial + lot）での入荷スキャン

**前提条件：**
- PRC 荷主の入荷 work_order が存在する
- SKU: PRC-001（精密機器）× 3個（個体ごとのシリアル管理）
- シリアル番号: `SN-PRC-001-001`〜`SN-PRC-001-003`
- ロット番号: `MFGLOT-2026-04-A`（メーカー製造ロット）

**テストデータ投入 SQL：**

```sql
-- PRC の SKU 確認（serial_required=true であること）
SELECT id, sku_code, jan_code, serial_required, lot_required FROM skus
WHERE owner_id = (SELECT id FROM owners WHERE code='PRC') LIMIT 3;

-- 入荷 work_order 作成
INSERT INTO work_orders (owner_id, order_type, status, priority, external_ref, notes, scheduled_date)
SELECT id, 'inbound', 'approved', 2, 'ASN-QA6-PRC-01', 'QA6テスト P3入荷スキャン（serial+lot要）', CURRENT_DATE
FROM owners WHERE code = 'PRC'
RETURNING id;
```

**HT 操作手順（1個目のスキャン）：**

1. HT で入荷画面を開き、荷主「精和プレシジョン株式会社（PRC）」を選択
2. ASN 番号「ASN-QA6-PRC-01」をスキャン
3. JAN コードをスキャン → SKU が特定される
4. **シリアル番号入力欄が表示されること**を確認（barcode_required_fields = 'jan,serial,lot'）
5. **ロット番号入力欄も表示されること**を確認
6. シリアル番号「SN-PRC-001-001」をスキャン
7. ロット番号「MFGLOT-2026-04-A」を入力
8. 数量欄が**1固定**（シリアル管理品は1スキャン=1個体）であることを確認
9. 「OK」をタップ → 2個目のスキャン画面に遷移
10. 手順3〜9を「SN-PRC-001-002」「SN-PRC-001-003」で繰り返す（計3回）
11. 3個スキャン完了後「入荷完了」をタップ

**合否判定チェックリスト（SC-HT-INB-03）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | JAN スキャン後に serial + lot 両欄が表示される | HT 画面目視 | 両フィールドが必須表示 | □ |
| 2 | 数量欄が 1 固定 | HT 画面目視 | 数量変更不可（serial 品は 1 個単位） | □ |
| 3 | 重複シリアルでエラーになる | SN-PRC-001-001 を 2 回入力 | 「このシリアルは登録済みです」エラー | □ |
| 4 | serials テーブルに 3 件作成 | 下記 DB 確認 SQL | 3 件、各々 distinct serial_number | □ |
| 5 | inventory.quantity = 3 | DB 確認 SQL | 合計 3（3 スキャン分） | □ |
| 6 | lot 紐付き確認 | DB 確認 SQL | lot_number='MFGLOT-2026-04-A' | □ |

**DB 確認 SQL：**

```sql
-- serial レコード確認（3件）
SELECT ser.id, ser.serial_number, ser.status, s.sku_code
FROM serials ser
JOIN skus s ON s.id = ser.sku_id
WHERE s.owner_id = (SELECT id FROM owners WHERE code='PRC')
ORDER BY ser.id;
-- SN-PRC-001-001, SN-PRC-001-002, SN-PRC-001-003 の 3 件

-- 在庫 + serial + lot 確認
SELECT i.quantity, i.lot_id, l.lot_number, s.sku_code,
       (SELECT COUNT(*) FROM serials ser WHERE ser.current_inventory_id = i.id) AS serial_count
FROM inventory i
JOIN skus s ON s.id = i.sku_id
JOIN lots l ON l.id = i.lot_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='PRC')
ORDER BY i.created_at DESC LIMIT 3;
```

---

### SC-HT-GS1-01：GS1-128 1スキャンで複数フィールド取得（P3・PRC）

**概要：** GS1-128 バーコードを 1 スキャンで JAN + lot + serial を同時取得するシナリオ。

**前提条件：**
- PRC 商品ラベルに GS1-128 複合バーコードが印刷されている
- スキャン対象: `(01)04903234000001(10)MFGLOT-2026-04-A(21)SN-PRC-001-004`

**HT 操作手順：**

1. HT で入荷画面を開き、荷主「PRC」を選択
2. GS1-128 複合バーコードを **1回スキャン**
3. 画面上で以下の 3 フィールドが自動入力されることを確認：
   - JAN コード: `4903234000001`（AI=01 の 14桁から先頭1桁除去）
   - ロット番号: `MFGLOT-2026-04-A`（AI=10）
   - シリアル番号: `SN-PRC-001-004`（AI=21）
4. 全フィールドが正しく入力された状態で「OK」をタップ
5. 入荷が完了することを確認

**合否判定チェックリスト（SC-HT-GS1-01）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 1スキャンで JAN が自動入力される | HT 画面目視 | jan フィールドに `4903234000001` | □ |
| 2 | 1スキャンで lot が自動入力される | HT 画面目視 | lot フィールドに `MFGLOT-2026-04-A` | □ |
| 3 | 1スキャンで serial が自動入力される | HT 画面目視 | serial フィールドに `SN-PRC-001-004` | □ |
| 4 | AI(01) の JAN 変換（14桁→13桁）が正確 | フィールド値確認 | 先頭 0 が除去されて 13 桁 EAN | □ |
| 5 | 個別スキャン方式と同一結果になる | DB 確認 SQL | SC-HT-INB-03 と同等の inventory レコード | □ |

**parseGS1_128 単体テスト（JS コンソール）：**

```javascript
// HT UI の JS コンソールで実行
const raw = "(01)04903234000001(10)MFGLOT-2026-04-A(21)SN-PRC-001-004";
const result = parseGS1_128(raw);
console.assert(result.jan === "4903234000001", "JAN変換NG: " + result.jan);
console.assert(result.lot === "MFGLOT-2026-04-A", "lot NG: " + result.lot);
console.assert(result.serial === "SN-PRC-001-004", "serial NG: " + result.serial);
console.log("GS1-128 パース OK:", result);
```

---

## 業務2：検品スキャン検証（LK-2 新規追加）

入荷スキャン後、正式格納前に検品（inspection）を実施するシナリオ。

### SC-HT-INS-01：P1（TKY）抜き取り検品（sampling）

**前提条件：**
- SC-HT-INB-01 完了後（TKY 商品 20個 入荷済み）
- TKY の inspection_strategy = sampling（抜き取り）

**HT 操作手順：**

1. HT で検品画面を開き、荷主「TKY」を選択
2. 入荷 ASN「ASN-QA6-TKY-01」を選択
3. 抜き取り対象品目（システム指示数、例：5個）が表示されることを確認
4. 検品対象商品の JAN バーコードをスキャン
5. 数量「5」を入力して検品 OK
6. 「検品完了」をタップ（全数でなく sampling のみで完了可能なことを確認）

**合否判定チェックリスト（SC-HT-INS-01）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | sampling 設定で全数でなく抜き取り指示が出る | HT 画面目視 | 全 20 個でなく一部数量が指示される | □ |
| 2 | JAN スキャンで検品対象 SKU が特定される | HT 画面目視 | SKU 名・数量が表示 | □ |
| 3 | 検品 OK で inspection_results に記録 | DB 確認 SQL | result='ok', inspected_qty > 0 | □ |

**DB 確認 SQL：**

```sql
-- 検品結果確認（inspection_results テーブルが Stage2 で deploy 済みの場合）
SELECT ir.id, ir.result, ir.inspected_qty, ir.expected_qty, ir.discrepancy_qty
FROM inspection_results ir
JOIN work_orders wo ON wo.id = ir.work_order_id
WHERE wo.external_ref = 'ASN-QA6-TKY-01'
ORDER BY ir.created_at DESC LIMIT 3;
```

---

### SC-HT-INS-02：P2（FDB）全数検品（full）＋差異発生

**前提条件：**
- SC-HT-INB-02 完了後（FDB 商品 30個 入荷済み）
- FDB の inspection_strategy = full（全数）
- 意図的に**実際は 28個**として検品（差異 -2個）

**HT 操作手順：**

1. HT で検品画面を開き、荷主「FDB」を選択
2. 「ASN-QA6-FDB-01」を選択
3. 全数検品指示（30個）が表示されることを確認
4. JAN スキャン → lot 確認スキャン（FDB は lot 必須）
5. 実数「28」を入力して「OK」
6. 差異検知メッセージが表示されることを確認（-2個）
7. 差異処理画面で「保留（hold）」を選択（FDB の discrepancy_strategy=hold）

**合否判定チェックリスト（SC-HT-INS-02）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | full 設定で全数（30個）検品指示が出る | HT 画面目視 | expected_qty=30 | □ |
| 2 | lot スキャンが要求される（full+lot 必須） | HT 画面目視 | lot フィールド表示（必須） | □ |
| 3 | 28個入力で差異（-2）が検知される | HT 画面 | 「数量差異：-2」等の警告 | □ |
| 4 | hold 戦略 → 在庫が保留状態になる | DB 確認 SQL | inventory.status = 'hold' | □ |
| 5 | 差異記録が DB に保存される | DB 確認 SQL | discrepancy_qty=-2 | □ |

**DB 確認 SQL：**

```sql
-- 差異記録確認（inbound_discrepancies テーブルが Stage2 で deploy 済みの場合）
SELECT id.discrepancy_qty, id.strategy_applied, id.resolved_at
FROM inbound_discrepancies id
JOIN work_orders wo ON wo.id = id.work_order_id
WHERE wo.external_ref = 'ASN-QA6-FDB-01';

-- 保留在庫確認
SELECT i.quantity, i.status, l.lot_number
FROM inventory i
JOIN lots l ON l.id = i.lot_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='FDB')
AND i.status = 'hold';
```

---

### SC-HT-INS-03：P3（PRC）全数検品＋シリアル確認

**前提条件：**
- SC-HT-INB-03 完了後（PRC 商品 3個、serial 付き）
- PRC の inspection_strategy = full, discrepancy_strategy = post（事後加算）

**HT 操作手順：**

1. HT で検品画面を開き、PRC を選択
2. シリアル一覧（SN-PRC-001-001〜003）が表示されることを確認
3. 各シリアルバーコードをスキャンして個体確認（3回）
4. ロット番号確認スキャン（MFGLOT-2026-04-A）
5. 「全数 OK」で検品完了

**合否判定チェックリスト（SC-HT-INS-03）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | serial 一覧（3件）が検品画面に表示される | HT 画面目視 | SN-PRC-001-001〜003 | □ |
| 2 | 各 serial スキャンで個体確認 OK | HT 操作 | 1件ずつ確認マーク | □ |
| 3 | 未スキャン serial が残ると完了できない | HT 操作 | 「未確認シリアルがあります」エラー | □ |
| 4 | 検品完了で serials.status が更新される | DB 確認 SQL | status='inspected' 等 | □ |

---

## 業務3：棚入れスキャン検証

### SC-HT-PUT-01：P1（TKY）棚入れ — ロケバーコードスキャン

**前提条件：**
- SC-HT-INB-01 が完了し、TKY の商品が入荷済み（RECV-01 等に仮置き）
- 棚入れ先: TKY-A-01-01-1（abc_class=A, capacity=200）

**HT 操作手順：**

1. HT で棚入れ画面（`/inbound-flow.html` → 棚入れステップ）を開く
2. 荷主「TKY」を選択
3. 画面に棚入れ対象品目リスト（TKY-001 × 20個）が表示されることを確認
4. **棚入れ先ロケーションコード「TKY-A-01-01-1」をスキャン**
5. スキャンしたロケが画面に表示されることを確認
6. 数量「20」を入力して「棚入れ実行」
7. 「棚入れ完了」メッセージが表示されることを確認

**追加シナリオ：間違いロケへのスキャン**

1. 別荷主（FDB）のロケ「FDB-COOL-01-01-1」をスキャン
2. 画面に「このロケーションは TKY では使用できません」等のエラーが表示されること
3. TKY ロケのみ選択可能であることを確認

**合否判定チェックリスト（SC-HT-PUT-01）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 正しいロケスキャンで棚入れ完了 | HT 画面目視 + DB | 「完了」表示 + inventory 更新 | □ |
| 2 | 他荷主ロケスキャンでエラー | HT 操作 | エラーメッセージ表示 | □ |
| 3 | ロケ current_volume が加算される | DB 確認 SQL | current_volume = 20（初期 0 + 20） | □ |
| 4 | inventory.location_id 更新 | DB 確認 SQL | TKY-A-01-01-1 の id を指す | □ |

**DB 確認 SQL：**

```sql
-- ロケーション消費量確認
SELECT code, current_volume, capacity, abc_class
FROM locations WHERE code = 'TKY-A-01-01-1';
-- current_volume = 20

-- 在庫ロケ移動確認
SELECT i.quantity, l.code AS location, i.status, i.updated_at
FROM inventory i
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='TKY')
ORDER BY i.updated_at DESC LIMIT 3;
```

---

### SC-HT-PUT-02：P2（FDB）棚入れ — lot スキャン付き

**前提条件：**
- SC-HT-INB-02 が完了し、FDB の商品が入荷済み
- 棚入れ先: FDB-COOL-01-01-1（abc_class=A, capacity=150）

**HT 操作手順：**

1. HT で棚入れ画面を開き、FDB を選択
2. 対象品目に「LOT-20260501-A」のロット情報が表示されることを確認
3. 棚入れ先ロケバーコードをスキャン
4. **ロット別に在庫が記録されていることを確認**（ロットが混在しないこと）
5. 「棚入れ完了」をタップ

**合否判定チェックリスト（SC-HT-PUT-02）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 棚入れ画面にロット番号が表示される | HT 画面目視 | LOT-20260501-A が表示 | □ |
| 2 | ロット別で inventory レコードが分かれる | DB 確認 SQL | lot_id ごとに distinct レコード | □ |
| 3 | 異なるロットを同ロケに棚入れ → 別レコード | DB 操作 + DB 確認 | inventory が 2 行（lot_id が異なる） | □ |

---

### SC-HT-PUT-03：P3（PRC）棚入れ — serial スキャン付き

**前提条件：**
- SC-HT-INB-03 が完了し、PRC の商品が入荷済み
- 棚入れ先: PRC 専用固定ロケ（putaway_strategy=fixed のため自動割当）

**HT 操作手順：**

1. HT で棚入れ画面を開き、PRC を選択
2. システムが固定ロケを自動提案することを確認（PRC は putaway_strategy=fixed）
3. 提案ロケのバーコードをスキャン
4. 各 serial（SN-PRC-001-001〜003）が棚入れ品目として一覧表示されることを確認
5. 「全件棚入れ」をタップ（または 1 件ずつ確認棚入れ）

**合否判定チェックリスト（SC-HT-PUT-03）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 固定ロケが自動提案される | HT 画面目視 | PRC 指定ロケが提案（選択肢なし） | □ |
| 2 | serial 一覧が表示される | HT 画面目視 | SN-PRC-001-001〜003 の 3 件 | □ |
| 3 | serials.current_inventory_id 更新 | DB 確認 SQL | 棚入れ後の location_id の inventory を指す | □ |

**DB 確認 SQL：**

```sql
-- serial の現在地確認
SELECT ser.serial_number, ser.status, i.quantity, l.code AS location
FROM serials ser
JOIN inventory i ON i.id = ser.current_inventory_id
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='PRC')
ORDER BY ser.serial_number;
```

---

## 業務4：ピッキングスキャン検証

### SC-HT-PCK-01：P1（TKY）ピッキング — JAN + ロケスキャン

**前提条件：**
- TKY の商品が TKY-A-01-01-1 に在庫あり
- 出荷指示（work_order type='outbound'）が存在する

**テストデータ投入 SQL：**

```sql
-- 出荷指示 work_order 作成
INSERT INTO work_orders (owner_id, order_type, status, priority, external_ref, notes, scheduled_date)
SELECT id, 'outbound', 'approved', 2, 'SO-QA6-TKY-01', 'QA6テスト P1ピッキング', CURRENT_DATE
FROM owners WHERE code = 'TKY'
RETURNING id;
```

**HT 操作手順：**

1. HT でピッキング画面（`WMS_Set7_outbound2_HT.html`）を開く
2. 荷主「TKY」を選択し、出荷指示「SO-QA6-TKY-01」を選択
3. ピッキング指示リスト（TKY-001 × N個、ロケ TKY-A-01-01-1）が表示されることを確認
4. ロケーションバーコード「TKY-A-01-01-1」をスキャン → ロケ確認
5. 商品 JAN「4901234000001」をスキャン → SKU 一致確認
6. 数量を確認して「OK」
7. lot/serial のスキャンが**要求されないこと**を確認（TKY は jan のみ）
8. 「ピッキング完了」をタップ

**合否判定チェックリスト（SC-HT-PCK-01）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | ピッキング先ロケが指示に表示される | HT 画面目視 | TKY-A-01-01-1 が指示されている | □ |
| 2 | JAN スキャンで SKU 照合 OK | HT 操作 | 一致メッセージ | □ |
| 3 | lot/serial スキャン不要 | HT 画面目視 | lot/serial フィールドなし | □ |
| 4 | 誤 JAN スキャンでエラー | 別 JAN スキャン | 「この商品はピッキング対象外」エラー | □ |
| 5 | 在庫が減算される | DB 確認 SQL | ピッキング後 inventory.quantity 減少 | □ |

**DB 確認 SQL：**

```sql
-- ピッキング後在庫確認（reserved → available 移動 or 減算）
SELECT i.quantity, i.status, l.code AS location
FROM inventory i
JOIN locations l ON l.id = i.location_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='TKY')
AND i.sku_id = (SELECT id FROM skus WHERE sku_code='TKY-001')
ORDER BY i.updated_at DESC;
```

---

### SC-HT-PCK-02：P2（FDB）ピッキング — lot 指定スキャン（FIFO）

**前提条件：**
- FDB の商品が複数 lot（LOT-A、LOT-B）で在庫あり
- FDB の allocation_strategy=fifo → 古いロットから先にピッキング

**HT 操作手順：**

1. HT でピッキング画面を開き、FDB を選択
2. ピッキング指示に「LOT-20260501-A（先入れ）を先にピック」と表示されることを確認
3. 指示された lot のロケバーコードをスキャン
4. JAN をスキャン
5. **ロット番号「LOT-20260501-A」のスキャン/確認が要求されること**を確認
6. 確認「OK」でピッキング完了

**合否判定チェックリスト（SC-HT-PCK-02）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | FIFO 順（古い lot）がピッキング指示に表示 | HT 画面目視 | 最古 lot が最初に指示される | □ |
| 2 | lot スキャンが要求される | HT 画面目視 | lot フィールドが表示（必須） | □ |
| 3 | 指示外 lot をスキャンするとエラー | HT 操作 | 「指示と異なるロットです」エラー | □ |
| 4 | ピッキング後、指示 lot の在庫が減算 | DB 確認 SQL | 古い lot_id の quantity 減少 | □ |

**DB 確認 SQL：**

```sql
-- FIFO 確認：lot の作成順（古い方が先に使われるべき）
SELECT l.lot_number, l.created_at, i.quantity, loc.code AS location
FROM inventory i
JOIN lots l ON l.id = i.lot_id
JOIN locations loc ON loc.id = i.location_id
WHERE i.owner_id = (SELECT id FROM owners WHERE code='FDB')
ORDER BY l.created_at ASC;  -- 最古が先に消えていること
```

---

### SC-HT-PCK-03：P3（PRC）ピッキング — serial スキャンで個体指定

**前提条件：**
- PRC の商品が棚入れ済み（SN-PRC-001-001〜003）
- 出荷指示で特定シリアル番号を指定してピッキング

**HT 操作手順：**

1. HT でピッキング画面を開き、PRC を選択
2. 出荷指示に「SN-PRC-001-002 をピック」と特定個体が指示されることを確認
3. ロケバーコードをスキャン
4. JAN をスキャン
5. **シリアル番号「SN-PRC-001-002」のスキャンが要求されること**を確認
6. シリアルをスキャン → 照合 OK
7. 誤シリアル（SN-PRC-001-001）をスキャンするとエラーになることを確認
8. 正しいシリアル「SN-PRC-001-002」をスキャンして完了

**合否判定チェックリスト（SC-HT-PCK-03）：**

| # | 確認項目 | 確認方法 | 期待値 | 判定 |
|---|---------|---------|-------|------|
| 1 | 特定シリアルがピッキング指示に表示 | HT 画面目視 | SN-PRC-001-002 が表示 | □ |
| 2 | serial スキャンが要求される | HT 画面目視 | serial フィールドが表示（必須） | □ |
| 3 | 指示外シリアルスキャンでエラー | SN-PRC-001-001 入力 | 「指示と異なるシリアルです」エラー | □ |
| 4 | 正しいシリアルでピッキング完了 | HT 操作 | 「OK」表示 | □ |
| 5 | ピッキング後 serial ステータス更新 | DB 確認 SQL | status='picked' 等に変化 | □ |

**DB 確認 SQL：**

```sql
-- serial ステータス変化確認
SELECT serial_number, status, current_inventory_id
FROM serials
WHERE serial_number IN ('SN-PRC-001-001', 'SN-PRC-001-002', 'SN-PRC-001-003')
ORDER BY serial_number;
-- SN-PRC-001-002 のみ status が変化していること
```

---

## エラーケース検証（全荷主共通）

### SC-HT-ERR-01：未登録 JAN スキャン

| 操作 | 期待結果 |
|------|---------|
| 登録外の JAN（例: 4900000000000）をスキャン | 「この商品はマスタに登録されていません（JAN: 4900000000000）」エラー |
| エラー後の継続 | スキャン画面に戻り、再スキャン可能 |

### SC-HT-ERR-02：容量超過ロケへの棚入れ

| 操作 | 期待結果 |
|------|---------|
| capacity=200 のロケに current_volume=200 の状態でスキャン | 「このロケーションは満杯です」エラー |
| capacity 超過棚入れ指示 | 別ロケへの誘導メッセージ |

**容量テスト SQL（事前準備）：**

```sql
-- テスト用に容量いっぱいにする
UPDATE locations SET current_volume = capacity WHERE code = 'TKY-A-01-01-2';
```

**確認後クリーンアップ：**

```sql
UPDATE locations SET current_volume = 0 WHERE code = 'TKY-A-01-01-2';
```

### SC-HT-ERR-03：barcode_required_fields 未入力での強制進行

| 荷主 | 操作 | 期待結果 |
|------|------|---------|
| FDB（jan,lot 必須） | lot 未入力で「OK」 | 「ロット番号は必須です」バリデーションエラー |
| PRC（jan,serial,lot 必須） | serial 未入力で「OK」 | 「シリアル番号は必須です」バリデーションエラー |

---

## API レベル検証（Phase 9-API2 対応）

Phase 9-API2 で定義された `/inbound-orders` エンドポイントの API レベルテスト。

### SC-API-INB-01：POST /inbound-orders — TKY 入荷オーダー作成

```bash
# Staging API エンドポイント
BASE_URL="https://wqjsemttubzbpauvgyai.supabase.co/functions/v1/wms"

# TKY 入荷オーダー作成
curl -s -X POST "${BASE_URL}/inbound-orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{
    "owner_code": "TKY",
    "supplier_id": "SUP-TKY-01",
    "expected_date": "2026-07-05",
    "lines": [
      {
        "sku_code": "TKY-001",
        "expected_qty": 20
      }
    ]
  }' | jq .
```

**期待レスポンス：**
- HTTP 201
- `id` フィールドが含まれる
- `status` = `"pending"` または `"approved"`

### SC-API-INB-02：PUT /inbound-orders/{id}/receive — 入荷受付

```bash
# SC-API-INB-01 で取得した id を使用
ORDER_ID="<SC-API-INB-01 で取得した id>"

curl -s -X PUT "${BASE_URL}/inbound-orders/${ORDER_ID}/receive" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{
    "received_by": "user-ht-operator",
    "lines": [
      {
        "sku_code": "TKY-001",
        "received_qty": 20,
        "scanned_data": {
          "jan": "4901234000001"
        }
      }
    ]
  }' | jq .
```

**期待レスポンス：**
- HTTP 200
- inventory レコードが作成される

### SC-API-INB-03：barcode_required_fields バリデーション（API レベル）

```bash
# FDB で lot なしのスキャンデータを送信 → 400 エラー期待
curl -s -X PUT "${BASE_URL}/inbound-orders/${FDB_ORDER_ID}/receive" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{
    "received_by": "user-ht-operator",
    "lines": [
      {
        "sku_code": "FDB-001",
        "received_qty": 30,
        "scanned_data": {
          "jan": "4902234000001"
        }
      }
    ]
  }' | jq .
```

**期待レスポンス：**
- HTTP 400
- `error` に `"lot は必須です"` 等のメッセージ

---

## テストデータクリーンアップ

全シナリオ完了後：

```sql
-- QA6 テスト用 work_orders 削除
DELETE FROM work_orders WHERE external_ref LIKE 'ASN-QA6%' OR external_ref LIKE 'SO-QA6%';

-- QA6 テスト用在庫削除
DELETE FROM serials WHERE serial_number LIKE 'SN-PRC-001-00%';
DELETE FROM inventory WHERE owner_id IN (SELECT id FROM owners WHERE code IN ('TKY','FDB','PRC'));

-- ロケーション current_volume リセット
UPDATE locations SET current_volume = 0 WHERE owner_id IN (SELECT id FROM owners WHERE code IN ('TKY','FDB','PRC'));

-- クリーン確認
SELECT COUNT(*) FROM inventory WHERE owner_id IN (SELECT id FROM owners WHERE code IN ('TKY','FDB','PRC'));
-- → 0
```

---

## 全シナリオ実行チェックリスト

| # | シナリオ ID | 業務 | 荷主/パターン | 実施日 | 結果 | 備考 |
|---|-----------|------|------------|-------|------|------|
| 1 | SC-HT-INB-01 | 入荷 | TKY（P1: jan のみ） | | □OK / □NG | |
| 2 | SC-HT-INB-02 | 入荷 | FDB（P2: jan,lot） | | □OK / □NG | |
| 3 | SC-HT-INB-03 | 入荷 | PRC（P3: jan,serial,lot） | | □OK / □NG | |
| 4 | SC-HT-GS1-01 | 入荷（GS1-128） | PRC（1スキャン複数フィールド） | | □OK / □NG | LK-2新規 |
| 5 | SC-HT-INS-01 | 検品 | TKY（sampling） | | □OK / □NG | LK-2新規 |
| 6 | SC-HT-INS-02 | 検品 | FDB（full + 差異） | | □OK / □NG | LK-2新規 |
| 7 | SC-HT-INS-03 | 検品 | PRC（serial 全数確認） | | □OK / □NG | LK-2新規 |
| 8 | SC-HT-PUT-01 | 棚入れ | TKY（ロケスキャン） | | □OK / □NG | |
| 9 | SC-HT-PUT-02 | 棚入れ | FDB（lot 付き） | | □OK / □NG | |
| 10 | SC-HT-PUT-03 | 棚入れ | PRC（serial 付き） | | □OK / □NG | |
| 11 | SC-HT-PCK-01 | ピッキング | TKY（JAN のみ） | | □OK / □NG | |
| 12 | SC-HT-PCK-02 | ピッキング | FDB（lot FIFO 順） | | □OK / □NG | |
| 13 | SC-HT-PCK-03 | ピッキング | PRC（serial 個体指定） | | □OK / □NG | |
| 14 | SC-HT-ERR-01 | エラー系 | 未登録 JAN | | □OK / □NG | |
| 15 | SC-HT-ERR-02 | エラー系 | 容量超過ロケ | | □OK / □NG | |
| 16 | SC-HT-ERR-03 | エラー系 | 必須フィールド未入力 | | □OK / □NG | |
| 17 | SC-API-INB-01 | API | POST /inbound-orders | | □OK / □NG | LK-2新規 |
| 18 | SC-API-INB-02 | API | PUT /receive | | □OK / □NG | LK-2新規 |
| 19 | SC-API-INB-03 | API | barcode バリデーション | | □OK / □NG | LK-2新規 |

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| HTバーコード判定ロジック仕様書 | `specs/ht_barcode_judgment_spec.md`（Phase 9-LK2）|
| ER 図コア | `specs/er_diagram_core.md` |
| 入荷実装論点 | `specs/process_04_inbound_implementation.md` |
| 棚入れ実装論点 | `specs/process_06_putaway_implementation.md` |
| ピッキング実装論点 | `specs/process_07_to_09_outbound_chain.md` |
| 入荷〜棚入れ E2E 詳細 | `specs/e2e_inbound_putaway_qa3.md` |
| WMS API ドラフト仕様 | `shacho-shitsu/docs/wms-api-draft.yaml`（v0.4.0-draft）|
| テストデータ投入 SQL | `shacho-shitsu/sql/phase9_seed_testdata.sql` |
| Stage1 Foundation SQL | `shacho-shitsu/sql/phase9_stage1_foundation.sql` |

---

*このドキュメントはにーちゃん（id=7）が Phase 9-QA6（#850/#1118）として作成・更新した。*  
*HT 実機テストは Stage2 テーブル deploy 後に実施すること。現時点では DB 確認 SQL の部分を先行検証可能。*  
*LK-2（ht_barcode_judgment_spec.md）の知見を 2026-07-01 に統合済み。*
