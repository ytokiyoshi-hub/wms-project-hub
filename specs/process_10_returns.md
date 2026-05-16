# 工程10：返品処理機能開発（顧客返品）論点叩き台

> Phase 9-α / TODO #136 / 2026-05-09 / さーちゃん起票・こーちゃん代理作成

---

## 工程番号・タイトル

**工程10：返品処理機能開発（顧客返品）**

スコープ：顧客返品の受入 → 検品 → 在庫戻し or 廃棄判定 → 記録

---

## レビュー実施日

2026-05-09

---

## 確定済み前提（変更不可）

| 項目 | 決定内容 | 出典 |
|------|----------|------|
| BF-4 | 返品在庫は在庫に載せず **別ステータスで管理**（B案確定） | kurokun_memo #62・朝判断シート |
| BF-4 DB設計 | `inventory.status` + `owners.return_strategy` でステータス分離 | er_diagram_core.md |
| 返品ロケーション | `locations.location_type='returns'` を設置 | er_diagram_core.md |

> ⚠️ 本工程の「顧客返品」は、入荷時のベンダー返品（`inbound_return`）とは**別フロー**。
> 入荷返品：ベンダーへの戻し処理（工程2・process_02_inbound.md Q5）
> 顧客返品：出荷後に顧客から戻ってくる返品（本工程のスコープ）

---

## 全体フロー（叩き台）

```
①返品申請・受付
 └─ RMA番号発番 or 外部管理（Q1で決定）
        ↓
②物理受入
 └─ HTスキャン（Q7で決定）
        ↓
③検品・状態確認
 └─ 判定区分（Q3で決定）
        ↓
④分岐処理
 ├─ 良品 → 在庫戻し（Q4で決定）
 ├─ 廃棄確定 → 廃棄承認フロー（Q5で決定）
 └─ 保留 → 荷主確認待ち（Q3/Q8で決定）
        ↓
⑤在庫・記録処理
 └─ ロット・シリアルの扱い（Q6で決定）
        ↓
⑥荷主への報告・精算
 └─ 通知・請求精算（Q8で決定）
```

---

## 関連する致命傷ライン

**DB設計（5項目）**
- [x] DB-1：在庫の持ち方（返品品の在庫行をどう持つか）
- [x] DB-2：ロット管理方式（返品品のロットをどう引き継ぐか）
- [x] DB-3：シリアル管理方式（返品シリアルの引き継ぎ）
- [x] DB-4：荷主切替の方式（荷主別の返品ポリシー）
- [x] DB-5：ロケーション管理方式（returns ロケの使い方）

**業務フロー（4項目）**
- [ ] BF-1：検品・ピッキング順序（返品検品方式との整合）
- [ ] BF-2：引当ロジック（返品品を引当対象に含めるか）
- [ ] BF-3：ピッキング方式
- [x] BF-4：返品・誤出荷処理（**確定済み B**）

**計算式（2項目）**
- [x] CA-1：請求賃率計算（返品処理費の請求設計）
- [x] CA-2：原価評価方式（返品品の原価処理）

**権限・ID（2項目）**
- [x] AU-1：権限・承認フロー（廃棄承認の権限設計）
- [ ] AU-2：SKU/JANコード管理

**連携（2項目）**
- [x] LK-1：外部連携方式（荷主への返品通知）
- [x] LK-2：HTバーコード仕様（返品受入スキャン）

---

## 論点リスト

### Q1：返品管理の対象範囲と原因分類

| 項目 | 内容 |
|------|------|
| 論点 | 「顧客都合返品」「倉庫ミスによる誤出荷返品」「品質問題による返品」を同一フローで扱うか、原因別に分けるか |
| 選択肢A | 全原因を同一フローで処理（原因は備考欄に記録のみ） |
| 選択肢B | 原因別に別フロー（費用負担・在庫戻し判定のロジックが原因で異なる） |
| 選択肢C | 荷主別に設定（荷主ごとに原因区分の要否を切替） |
| 選択肢D | — |
| **時吉さん回答** | **B（確定 2026-05-16）：全荷主で返品原因を区分管理（顧客都合／倉庫ミス／品質不良）。費用負担・在庫戻しルールが原因に連動。`customer_returns.return_reason_type` カラムに区分値を必須化。** |
| まーちゃん推奨 | **C**：誤出荷の費用負担（倉庫側持ち）は荷主によって契約が違う。原因区分を持たないと請求精算が詰む。ただし荷主によってはシンプルで良い場合もある。 |
| 仕様への影響 | `customer_returns.return_reason_type` カラム / 費用精算ロジック |

---

### Q2：返品申請・RMA番号の管理方式

| 項目 | 内容 |
|------|------|
| 論点 | WMSで返品申請（RMA = Return Merchandise Authorization）番号を発番・管理するか。それとも荷主側で管理してWMSは受入から始めるか。 |
| 選択肢A | WMSで管理しない（荷主側で申請管理・WMSは物理受入から処理） |
| 選択肢B | WMSでRMA番号を発番・トラッキング（返品の事前登録が必要） |
| 選択肢C | 荷主システムからRMA番号を連携受取（WMSで発番せず受け取るのみ） |
| 選択肢D | 荷主別に切替（A/B/C を荷主ごとに選択可能） |
| **時吉さん回答** | **未回答（要レビュー）** |
| まーちゃん推奨 | **D**：荷主によってRMA管理の有無が違う。ただし最初はAから入って、需要があればB/Cを追加するのが現実的。 |
| 仕様への影響 | `customer_returns.rma_number` / `owners.return_strategy` の rma_required フラグ |

---

### Q3：検品の判定区分

| 項目 | 内容 |
|------|------|
| 論点 | 返品品の検品で状態をどう分類するか。廃棄・在庫戻し・保留のどの区分を設けるか。 |
| 選択肢A | 良品 / 不適合品 の2区分（シンプル・廃棄判定は別途） |
| 選択肢B | 良品 / 要確認 / 廃棄確定 の3区分 |
| 選択肢C | 良品 / 要修理 / 廃棄確定 / 保留（荷主確認待ち） の4区分 |
| 選択肢D | 荷主別に判定区分を設定可能（masters.return_condition_types で管理） |
| **時吉さん回答** | **選択肢外（確定 2026-05-16）：返品品専用の condition enum（return_inspections.condition）は新設しない。既存 `inventory.status` を返品品でも共用。返品入庫時の初期ステータスは荷主／ユーザーが `owners.return_strategy.return_default_status` で任意設定可（デフォルト「良品」固定なし）。** |
| まーちゃん推奨 | **D（基本はC）**：「保留（荷主確認待ち）」は必須。高額品・荷主独自判定が入るケースで保留なしだと廃棄の取り消しが困難。まず4区分で設計してDの切替は後で乗せる。 |
| 仕様への影響 | `return_inspections.condition` enum / 荷主別判定ロジック |

---

### Q4：良品の在庫戻し方法

> BF-4 = B の原則：「返品品は別ステータスで管理」と整合させる必要がある。

| 項目 | 内容 |
|------|------|
| 論点 | 検品で良品と判定された返品品を通常在庫に戻す際、誰がいつ承認して戻すか |
| 選択肢A | 検品完了即時に通常在庫に自動戻し（倉庫スタッフ判断で完結） |
| 選択肢B | 「返品良品」ステータスで一旦保留 → 荷主確認 or 上長承認後に通常在庫に移動 |
| 選択肢C | 荷主設定で選択（自動戻しOKの荷主はA・承認必須の荷主はB） |
| 選択肢D | — |
| **時吉さん回答** | **未回答（要レビュー）** |
| まーちゃん推奨 | **C**：食品・医薬品等の高品質管理荷主はBが必須。一般品はAでOK。owners.return_strategy に `auto_restock` フラグを設ける。 |
| 仕様への影響 | `owners.return_strategy.auto_restock` / `inventory.status` の遷移フロー |

---

### Q5：廃棄判定の承認フロー

| 項目 | 内容 |
|------|------|
| 論点 | 廃棄確定の権限は誰が持ち、WMSでどう承認記録するか |
| 選択肢A | WMS内承認フローなし（倉庫スタッフが判定・DB記録のみ） |
| 選択肢B | WMS内承認フロー（倉庫スタッフ → 倉庫上長 承認） |
| 選択肢C | WMS内承認フロー（倉庫スタッフ → 荷主最終確認必須） |
| 選択肢D | 荷主別設定（高額品荷主はC・一般品はA） |
| **時吉さん回答** | **C（確定 2026-05-16）：簿内品の廃棄は荷主の最終承認が必須（倉庫スタッフ申請 → 荷主承認フロー）。倉庫上長のみのB案は寄託物の法的所有権が荷主にあるため不成立。簿外品はWMS管理外。** |
| まーちゃん推奨 | **D**：廃棄は取り消せないため「記録だけ」は危険。最低でもBを基本にし、高額品荷主はCを適用する構造が安全。ただし承認フローはAU-1（権限設計）確定後に詳細化。 |
| 仕様への影響 | `disposal_approvals` テーブル（新設の可能性）/ AU-1との整合 / `shipment_orders.purpose` enum追加（廃棄を出荷フローで処理するため） |

> **QA-5 補足確定（3号ヒアリング 2026-05-16）：**
> ① 不適合品はR種別ロケに移動・倉庫外への物理移動は荷主指示が必須
> ② 廃棄記録はWMS DBのみ・廃棄証憑/マニフェストは荷主側で管理（WMSは証憑を発行しない）
> ③ 廃棄は荷主指示起点・倉庫主導での廃棄判断はなし
> ④ 廃棄の独立業務フローは設けない・出荷フロー（用途区分=廃棄）として処理する
>
> 設計への反映：
> - `shipment_orders.purpose` enum を追加（`'outbound'` / `'disposal'` / `'sample'` / `'vendor_return'` 等）
> - 「用途区分×在庫ステータス」出荷許可マトリクスを設計（disposal は quarantine ステータスのみ許可 等）
> - 不適合品の出荷（廃棄含む）は理由（`disposition_note`）記載を確定条件とするバリデーション追加

---

### Q6：ロット・シリアルの返品時の扱い

> DB-2（ロット管理）・DB-3（シリアル管理）の判断と整合が必要。

| 項目 | 内容 |
|------|------|
| 論点 | 返品品のロット番号・シリアルをどう管理するか。元の出荷データを引き継ぐか、新規登録か。 |
| 選択肢A | 元の出荷ロット・シリアルを引き継いで在庫に戻す |
| 選択肢B | 返品ロット番号を新規採番して登録（元のロットとの紐付けも保持） |
| 選択肢C | 荷主別設定（ロット管理が必要な荷主のみ引き継ぎ、他はロットなし） |
| 選択肢D | — |
| **時吉さん回答** | **確定（QA-11 / 3号ヒアリング 2026-05-16）：返品戻入時のロット番号は現物表記に準拠する（現物に元ロット番号が記載されていればそれを使用）。倉庫側での自動採番はしない。** |
| まーちゃん推奨 | **C（実質A が基本）**：元のシリアルを失うと追跡不能になるため原則引き継ぎ。ただしDB-2/DB-3 が未確定のため、その判断後に詳細化。 |
| 仕様への影響 | `customer_returns.original_lot_id` / `customer_return_items.serial_id` |

---

### Q7：HTバーコードスキャンの仕様

> LK-2（HTバーコード仕様）の返品版。

| 項目 | 内容 |
|------|------|
| 論点 | 返品受入・検品時にHTでどのバーコードをスキャンするか |
| 選択肢A | 元の出荷バーコード（JAN / シリアル）でスキャン（返品ラベル不要） |
| 選択肢B | 返品ラベルを新規発行してHTスキャン（RMAバーコード） |
| 選択肢C | 両対応（荷主別設定でA or Bを切替） |
| 選択肢D | — |
| **時吉さん回答** | **未回答（要レビュー）** |
| まーちゃん推奨 | **C**：元バーコードが読めるケースはAが現場ラク。ラベルが剥がれた・不明な場合はB（返品ラベル再発行）が必要。LK-2 の `owners.barcode_required_fields` に返品スキャン設定を追加。 |
| 仕様への影響 | `owners.barcode_required_fields.returns` / HT画面の返品スキャンロジック |

---

### Q8：荷主への返品通知・費用精算

> LK-1（外部連携）・CA-1（請求賃率）との整合が必要。

| 項目 | 内容 |
|------|------|
| 論点 | 返品処理完了後、荷主への通知方法と費用精算（返品処理料）の扱い |
| 選択肢A | 通知なし（荷主が帳票 or 管理画面で確認） |
| 選択肢B | WMSから自動通知（メール / API webhook） |
| 選択肢C | 荷主別設定（通知要否・方法・タイミングを切替） |
| 返品処理費用 | billing_rules に「返品処理賃率」を追加（件数単価 / 重量単価） |
| **時吉さん回答** | **未回答（LK-1・CA-1 確定後に連動）** |
| まーちゃん推奨 | **C（通知）+ billing_rules 追加**：返品処理費は荷主との契約で違うため billing_rules の拡張で対応。通知はLK-1確定後に詳細化。 |
| 仕様への影響 | `billing_rules.return_processing_rate` / `owners.return_notification_method` |

---

## DBスキーマ叩き台

> ⚠️ BF-4 = B（ステータス分離）・DB-1〜DB-5 未確定のため、以下は**叩き台**。今井先生レビュー対象。

### 新設テーブル案

```sql
-- 顧客返品ヘッダー
CREATE TABLE customer_returns (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     UUID NOT NULL REFERENCES owners(id),
  rma_number   TEXT,                                    -- Q2で必要性判断
  return_date  DATE NOT NULL,
  reason_type  TEXT,                                    -- Q1の原因区分
  status       TEXT NOT NULL                            -- received / inspecting / completed / disposed
               CHECK (status IN ('received','inspecting','completed','disposed')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   UUID REFERENCES users(id)
);

-- 顧客返品明細
CREATE TABLE customer_return_items (
  id                  BIGSERIAL PRIMARY KEY,
  customer_return_id  BIGINT NOT NULL REFERENCES customer_returns(id),
  sku_id              BIGINT NOT NULL REFERENCES skus(id),
  lot_id              BIGINT REFERENCES lots(id),         -- Q6で引き継ぎ方式決定
  serial_id           BIGINT REFERENCES serials(id),      -- Q6で引き継ぎ方式決定
  quantity            INT NOT NULL CHECK (quantity > 0),
  condition           TEXT NOT NULL                       -- Q3の判定区分
                      CHECK (condition IN ('good','hold','repair','dispose')),
  inspection_note     TEXT,
  disposition         TEXT,                               -- restock / dispose / repair
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 廃棄承認記録（Q5でフロー決定後に詳細化）
CREATE TABLE disposal_approvals (
  id                      BIGSERIAL PRIMARY KEY,
  customer_return_item_id BIGINT NOT NULL REFERENCES customer_return_items(id),
  requested_by            UUID NOT NULL REFERENCES users(id),
  approved_by             UUID REFERENCES users(id),
  status                  TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  note                    TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  approved_at             TIMESTAMPTZ
);
```

### 既存テーブルへの追加カラム案

```sql
-- owners テーブルに返品戦略設定を追加
ALTER TABLE owners ADD COLUMN return_strategy JSONB DEFAULT '{
  "auto_restock": false,
  "rma_required": false,
  "notification_method": "none",
  "condition_types": ["good", "hold", "dispose"]
}'::jsonb;

-- billing_rules テーブルに返品処理賃率を追加
ALTER TABLE billing_rules ADD COLUMN return_processing_rate NUMERIC(12,2);
ALTER TABLE billing_rules ADD COLUMN return_processing_unit TEXT CHECK (return_processing_unit IN ('per_item','per_kg','per_case'));
```

### inventory ステータス遷移（返品フロー）

```
customer_return_items.condition = 'good' + disposition = 'restock'
  → inventory.status: 'returned_good'（新設）→ 承認後 'available' に移動
  　　または直接 'available'（auto_restock=true の荷主）

customer_return_items.condition = 'dispose'
  → inventory には追加しない（廃棄記録のみ）

customer_return_items.condition = 'hold'
  → inventory.status: 'quarantine'（既存）で保留
```

### 用途区分 enum と出荷許可マトリクス（QA-5 確定設計）

廃棄は独立業務ではなく出荷フロー（`purpose='disposal'`）として処理する。

```sql
-- shipment_orders テーブルへの purpose カラム追加
ALTER TABLE shipment_orders
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'outbound'
    CHECK (purpose IN ('outbound', 'disposal', 'sample', 'vendor_return'));

-- 不適合品出荷（廃棄含む）に理由記載を必須化
ALTER TABLE shipment_orders
  ADD COLUMN disposition_note TEXT;

-- disposition_note 必須バリデーション（アプリ層 or CHECK 制約で実装）
-- purpose IN ('disposal','sample','vendor_return') の場合は disposition_note NOT NULL
```

**用途区分 × 在庫ステータス 出荷許可マトリクス：**

| purpose（用途区分） | 許可する inventory.status | 備考 |
|---------------------|--------------------------|------|
| `outbound`（通常出荷） | `available` / `reserved` | 標準出荷フロー |
| `disposal`（廃棄） | `quarantine` / `available`（荷主承認後） | 廃棄は荷主指示起点必須 |
| `sample`（サンプル出荷） | `available` | 引当数量に注意 |
| `vendor_return`（仕入先返品） | `available` / `quarantine` | 入荷返品と連動 |

> ⚠️ `disposal` の場合は必ず `disposal_approvals` の承認完了を確認してから出荷処理を実行すること。

---

## 決定事項サマリー（確定済み）

| 論点 | 決定内容 | 致命傷ライン |
|------|----------|------------|
| BF-4 基本方針 | 返品在庫は別ステータス管理（在庫に直接戻さない） | BF-4 |
| returns ロケーション | `locations.location_type='returns'` を用意 | DB-5 |
| 返品戦略設定 | `owners.return_strategy` で荷主別切替 | DB-4 |
| Q10-1（返品原因分類） | B：全荷主で返品原因を区分管理（顧客都合／倉庫ミス／品質不良）。`customer_returns.return_reason_type` 必須化 | CA-1 |
| Q10-3（検品判定区分） | 選択肢外：専用 enum 新設なし・既存 `inventory.status` を共用。`owners.return_strategy.return_default_status` で荷主別初期値設定可 | DB-4 |
| Q10-5（廃棄承認フロー） | C：簿内品の廃棄は荷主の最終承認が必須（倉庫スタッフ申請 → 荷主承認）。法的根拠：寄託物の所有権は荷主 | AU-1 |
| QA-5①（不適合品移動先） | R種別ロケへ移動・倉庫外への物理移動は荷主指示が必須 | DB-5 |
| QA-5②（廃棄記録形式） | WMS DBのみ・廃棄証憑/マニフェストは荷主側で管理 | — |
| QA-5③（廃棄起点） | 廃棄は荷主指示起点・倉庫主導の廃棄判断はなし | AU-1 |
| QA-5④（廃棄フロー統合） | 廃棄の独立業務フローは設けない・出荷フロー（purpose='disposal'）として処理 | BF-3 |
| QA-11（返品戻入ロット） | 返品戻入時ロット番号は現物表記準拠・倉庫自動採番なし | DB-2 |

---

## 未解決の論点（時吉さん判断待ち）

| Q | 論点 | 依存する致命傷ライン | 推奨案 |
|---|------|-------------------|--------|
| Q2 | RMA番号管理の要否 | — | D（荷主別・最初はA） |
| Q4 | 良品の在庫戻し承認 | BF-4 | C（荷主別設定） |
| Q7 | HTスキャン仕様 | LK-2 | C（荷主別設定） |
| Q8 | 荷主通知・精算 | LK-1/CA-1 | C（LK-1確定後） |

> ✅ Q1・Q3・Q5 は 2026-05-16 時吉さんヒアリングで確定済み（上記「決定事項サマリー」参照）
> ✅ Q6（ロット引き継ぎ）は QA-11 で確定済み（現物表記準拠・倉庫自動採番なし）

> Q7・Q8 は他の致命傷ラインに依存。LK-1/LK-2/CA-1 確定後に詳細化。

---

## ⏳ 時吉さん決定待ち（先行ロック論点：Q10-1 / Q10-3 / Q10-5）

> **このセクションは時吉さんの判断を受け取るための受け入れ節です。**  
> 決定が届いたら各項目の「決定内容」欄を埋め、`**時吉さん回答**` 行も上部の論点テーブルに反映してください。

---

### Q10-1：返品原因分類方針

**ステータス：✅ 確定済み（2026-05-16 時吉さんヒアリング）**

| 項目 | 内容 |
|------|------|
| **時吉さんの決定** | **選択肢B：全荷主で返品原因を区分管理（顧客都合／倉庫ミス／品質不良）** |
| 決定した選択肢 | B |
| 決定理由・背景 | 費用負担（倉庫側負担か荷主負担か）・在庫戻しルールが返品原因によって連動して変わるため、原因区分なしでは請求精算・業務フローが組めない。荷主ごとの切替（C案）ではなく全荷主で統一区分管理とする。 |

**反映済み：**
- 本ファイル Q1 表の `**時吉さん回答**` 行 ✅
- `customer_returns.return_reason_type` カラム設計：`TEXT NOT NULL CHECK (return_reason_type IN ('customer', 'warehouse_error', 'quality'))` を追加
- 費用精算ロジック（CA-1 との整合）：原因が `warehouse_error` の場合は倉庫側費用負担フラグを立てる設計が必要

---

### Q10-3：返品品状態区分（検品判定区分）

**ステータス：✅ 確定済み（2026-05-16 時吉さんヒアリング）**

| 項目 | 内容 |
|------|------|
| **時吉さんの決定** | **選択肢外：返品品専用の condition enum は新設しない。既存 `inventory.status` を共用。** |
| 決定した選択肢 | 選択肢外（A〜D の選択肢を採用しない） |
| 決定理由・背景 | 返品品専用の状態区分（return_inspections.condition）を別途 enum で持つと、在庫ステータスと二重管理になる。既存 `inventory.status` を返品品でも統一して使う。返品入庫時の初期ステータスは荷主／ユーザーが `owners.return_strategy.return_default_status` で任意設定可。デフォルト「良品」固定にしない。 |

**反映済み：**
- 本ファイル Q3 表の `**時吉さん回答**` 行 ✅
- `return_inspections.condition` は新設しない（DBスキーマ叩き台の当該 enum は廃止・要さーちゃん反映）
- `owners.return_strategy` への `return_default_status` カラム追加が必要

**既存 `inventory.status` enum 値一覧（現状確認・整理）：**

| 値 | 意味 | 出典 |
|----|------|------|
| `available` | 通常品（出庫可） | er_diagram_core.md |
| `quarantine` | 保留・検疫（出庫不可） | er_diagram_core.md |
| `returned_good` | 返品良品（在庫戻し前） | 本ファイル DBスキーマ叩き台（新設案） |

> ⚠️ **TODO（要確認）：inventory.status の全 enum 値一覧**  
> 上記は本ファイル内で確認できる値のみ。`er_diagram_core.md` および Supabase 本番 DB の実際の enum 定義と照合が必要。  
> さーちゃんまたは3号に確認依頼を推奨。

> ⚠️ **TODO（要確認）：「lotバック」用語の意味**  
> ヒアリング中に「lotバック」という用語が出た（返品時のロット処理方式を指す可能性）。  
> 意味が確定していないため、実装着手前に時吉さんまたは3号（実装プロトタイプ担当）へ確認すること。

---

### Q10-5：廃棄確定承認フロー

**ステータス：✅ 確定済み（2026-05-16 時吉さんヒアリング）**

| 項目 | 内容 |
|------|------|
| **時吉さんの決定** | **選択肢C：簿内品の廃棄は荷主の最終承認が必須（廃棄申請：倉庫スタッフ → 荷主の最終承認フロー）** |
| 決定した選択肢 | C |
| 決定理由・背景 | 倉庫上長のみの承認（B案）は法的に不成立。寄託物の所有権は荷主にあるため、倉庫側だけで廃棄を確定させることはできない。荷主の最終承認を必須フローとすることで法的・業務的整合性を担保する。簿外品（WMS 管理外）はこのフローのスコープ外。 |

**反映済み：**
- 本ファイル Q5 表の `**時吉さん回答**` 行 ✅
- `disposal_approvals` テーブル設計：`requested_by`（倉庫スタッフ）→ `approved_by`（荷主ユーザー）の2段階フローが確定。AU-1 の `shipper` ロールが承認者になる想定。
- AU-1（権限設計）との整合：`shipper` ロールに廃棄承認権限を付与する必要あり（AU-1 権限設計タスクで反映要）

---

### QA-5 補足：不適合品処理詳細

**ステータス：✅ 確定済み（3号ヒアリング 2026-05-16）**

| 確認点 | 決定内容 |
|--------|---------|
| ①物理移動先 | 不適合品はR種別ロケ（`location_type='returns'`）に移動。倉庫外への物理移動は荷主指示が必須 |
| ②廃棄記録形式 | WMS DBのみ。廃棄証憑/産廃マニフェストは荷主側で管理（WMSが証憑を発行しない） |
| ③廃棄起点 | 廃棄は荷主指示起点。倉庫主導での廃棄判断・実行はなし |
| ④廃棄フロー統合 | 廃棄の独立業務フローは設けない。出荷フロー（`purpose='disposal'`）に統合して処理 |

**反映済み：**
- 本ファイル Q5 表の QA-5 補足ブロック ✅
- DBスキーマ叩き台：`shipment_orders.purpose` enum 追加・用途区分×在庫ステータス 出荷許可マトリクス ✅
- 不適合品出荷は `disposition_note`（理由記載）を確定条件とするバリデーション設計 ✅
- 決定事項サマリー：QA-5①〜④ 追加 ✅

---

### Q10-6（QA-11）：返品戻入時のロット番号

**ステータス：✅ 確定済み（QA-11 / 3号ヒアリング 2026-05-16）**

| 項目 | 内容 |
|------|------|
| **時吉さんの決定** | **現物表記に準拠・倉庫自動採番なし** |
| 決定した選択肢 | A 相当（元ロットを引き継ぐ）ただし「現物に記載されているロット番号を使用」を原則とする |
| 決定理由・背景 | 返品戻入時は現物に記載されているロット番号をそのまま入力する。元の出荷ロットが分かっていれば逆引きして引き継ぐ。倉庫側で「RT-」等のプレフィックスで自動採番はしない。 |

**反映済み：**
- 本ファイル Q6 表の `**時吉さん回答**` 行 ✅
- 決定事項サマリー：QA-11 追加 ✅

---

## 次工程への申し送り

- **工程11（棚卸）**：返品保留品（quarantine ステータス）が棚卸の対象に含まれるかを確認
- **工程12（マスタ管理）**：`owners.return_strategy` の管理画面（CRUD）が必要
- **工程13（帳票）**：返品処理報告書（荷主向け）・廃棄処理記録書の帳票設計
- **工程14（外部連携）**：Q8の荷主通知方式と連携

---

*作成: 2026-05-09 / Phase 9-α TODO #136 / こーちゃん（代理）*
