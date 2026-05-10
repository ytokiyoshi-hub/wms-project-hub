# Phase 9-QA6: HT バーコードスキャン 検証シナリオ（LK-2 対応）

作成日：2026-05-10  
作成者：にーちゃん（id=7）  
対応タスク：#850 Phase 9-QA6  
致命傷ライン：LK-2（HT バーコード仕様）

---

## 概要

HT（ハンディターミナル）でバーコードをスキャンして入荷・棚入れ・ピッキングを完結させる検証シナリオ。  
`owners.barcode_required_fields` に設定された値によって、HT 画面で要求されるスキャン項目が変わる。  
本ドキュメントでは 3 つの設定パターン（荷主別）× 3 業務（入荷/棚入れ/ピッキング）の検証手順を定義する。

---

## `owners.barcode_required_fields` 設定パターン

| パターン | 荷主 | barcode_required_fields | 説明 |
|---------|------|------------------------|------|
| **P1** | 東京通販株式会社（TKY） | `jan` | JAN コードのみ。最シンプル構成 |
| **P2** | 富士食品工業株式会社（FDB） | `jan,lot` | JAN + ロット番号。食品の期限日管理に対応 |
| **P3** | 精和プレシジョン株式会社（PRC） | `jan,serial,lot` | JAN + シリアル番号 + ロット番号。精密機器の個体管理 |

### フィールド識別子定義

| 識別子 | 意味 | 必須スキャン対象 |
|--------|------|----------------|
| `jan` | JAN コード（商品バーコード） | 商品ラベルの JAN バーコード |
| `lot` | ロット番号 | ロットラベルのバーコード（または手入力） |
| `serial` | シリアル番号 | 個体シリアルラベル（1スキャン = 1個体） |
| `owner_sku` | 荷主内部 SKU コード | 荷主独自の SKU バーコード（将来拡張用） |

---

## テスト環境

| 項目 | 値 |
|------|-----|
| Supabase Project ID | wqjsemttubzbpauvgyai |
| Supabase URL | https://wqjsemttubzbpauvgyai.supabase.co |
| Staging URL | https://shacho-shitsu-git-develop-ytokiyoshi-2875s-projects.vercel.app |
| HT 画面 URL | staging URL + `/WMS_Set6_inbound_HT.html`（入荷）|

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

**期待値：**

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
SELECT id, sku_code, jan FROM skus WHERE owner_id = (SELECT id FROM owners WHERE code='TKY') LIMIT 3;

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
SELECT id, sku_code, jan, lot_required FROM skus
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
SELECT id, sku_code, jan, serial_required, lot_required FROM skus
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

## 業務2：棚入れスキャン検証

### SC-HT-PUT-01：P1（TKY）棚入れ — ロケバーコードスキャン

**前提条件：**
- SC-HT-INB-01 が完了し、TKY の商品が入荷済み（RECV-01 等に仮置き）
- 棚入れ先: TKY-A-01-01-1（abc_class=A）

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
- 棚入れ先: FDB-COOL-01-01-1（abc_class=A, 要冷蔵エリア想定）

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

## 業務3：ピッキングスキャン検証

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
| 登録外の JAN（例: 4900000000000）をスキャン | 「この商品はマスタに登録されていません」エラー |
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
| 4 | SC-HT-PUT-01 | 棚入れ | TKY（ロケスキャン） | | □OK / □NG | |
| 5 | SC-HT-PUT-02 | 棚入れ | FDB（lot 付き） | | □OK / □NG | |
| 6 | SC-HT-PUT-03 | 棚入れ | PRC（serial 付き） | | □OK / □NG | |
| 7 | SC-HT-PCK-01 | ピッキング | TKY（JAN のみ） | | □OK / □NG | |
| 8 | SC-HT-PCK-02 | ピッキング | FDB（lot FIFO 順） | | □OK / □NG | |
| 9 | SC-HT-PCK-03 | ピッキング | PRC（serial 個体指定） | | □OK / □NG | |
| 10 | SC-HT-ERR-01 | エラー系 | 未登録 JAN | | □OK / □NG | |
| 11 | SC-HT-ERR-02 | エラー系 | 容量超過ロケ | | □OK / □NG | |
| 12 | SC-HT-ERR-03 | エラー系 | 必須フィールド未入力 | | □OK / □NG | |

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| ER 図コア | `specs/er_diagram_core.md` |
| 入荷実装論点 | `specs/process_04_inbound_implementation.md` |
| 棚入れ実装論点 | `specs/process_06_putaway_implementation.md` |
| ピッキング実装論点 | `specs/process_07_to_09_outbound_chain.md` |
| 入荷〜棚入れ E2E 詳細 | `specs/e2e_inbound_putaway_qa3.md` |
| テストデータ投入 SQL | `shacho-shitsu/sql/phase9_seed_testdata.sql` |
| Stage1 Foundation SQL | `shacho-shitsu/sql/phase9_stage1_foundation.sql` |

---

*このドキュメントはにーちゃん（id=7）が Phase 9-QA6（#850）として作成した。*  
*HT 実機テストは Stage2 テーブル deploy 後に実施すること。現時点では DB 確認 SQL の部分を先行検証可能。*
