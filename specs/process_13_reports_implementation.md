# 工程13：帳票・レポート機能開発（3PL 収益根幹）

> 致命傷ライン CA-1（請求賃率）と直結する3PL ビジネスの収益根幹工程。
> 顧客（荷主）への信頼確保＝請求書の正確性が命。

---

## スコープ

- 請求書発行（月次バッチ・期末スナップショット連動）
- 在庫表（荷主向け・リアルタイム＋期末）
- 棚卸表（差異一覧・確定帳票）
- 出荷実績レポート（荷主向け定期送信）
- 入荷予定 vs 実績レポート（差異分析・荷主との確認）
- 賃率シミュレータ（営業ツール・キーエンス向け資料素材）

---

## 関連する致命傷ライン

| ID | 項目 | 帳票での扱い |
|----|------|------------|
| **CA-1** | 請求賃率計算 | 本工程の中核 |
| CA-2 | 原価評価方式 | 在庫表の評価額計算 |
| DB-1 | 在庫の持ち方 | 在庫表の集計軸 |
| DB-4 | 荷主切替 | 全帳票で荷主×期間でフィルタ |
| AU-1 | 権限・承認フロー | 請求書発行の承認フロー |

---

## 機能リスト

### F-1301：請求書発行（月次バッチ）★最重要

| 項目 | 内容 |
|------|------|
| 機能 | 荷主×期間×請求方式に従い請求書を生成 |
| 計算ロジック | `billing_rules` テーブルを参照 |
| 出力 | `billing_invoices` テーブル + PDF（請求書本紙） |
| トリガー | 荷主単位で以下3方式を切替可能（QA-2④確定）：①手動発行、②月末バッチ、③締日後N営業日バッチ |
| 月跨ぎ繰越 | 前月末日23:59時点の在庫をスナップショットとして使用（QA-2③確定） |
| 致命傷ライン | CA-1（請求賃率） / DB-4（荷主切替）/ AU-1（承認） |
| 9割突っ走り部分 | PDF レイアウト・配色 |
| 完璧に詰める部分 | 計算ロジック・端数処理（**荷主別設定・デフォルト四捨五入** Q13-1確定）・前月修正分（**翌月加減算方式** Q13-2確定）・荷主側システムとの自動突合 |

**請求項目の典型構成（推奨案 D ベース）：**
```
- 保管料：期末在庫量 × 単価（3期制 / 2期制 / 日割 / 坪貸）
- 入庫料：入荷件数 × 単価
- 出庫料：出荷件数 × 単価
- 期間外作業料：その他作業の人件費（時間単価）
- 緊急対応料：休日・夜間対応分の割増
- 値引・調整：手動調整分
- 消費税：合計に対する税率（10% or 8% 軽減）
```

**主要 SQL（疑似）：**
```sql
-- 期末在庫スナップショット取得
WITH period_snapshot AS (
  SELECT owner_id, sku_id, lot_id, location_id,
         SUM(quantity) AS qty,
         AVG(unit_cost) AS avg_cost
  FROM inventory_snapshots
  WHERE owner_id = ?
    AND snapshot_at = ?
  GROUP BY owner_id, sku_id, lot_id, location_id
)
SELECT
  ps.qty * br.unit_price AS storage_fee,
  br.rule_type
FROM period_snapshot ps
JOIN billing_rules br ON br.owner_id = ps.owner_id
WHERE br.rule_type = '保管料'
  AND br.valid_from <= ? AND (br.valid_to IS NULL OR br.valid_to >= ?);
```

---

### F-1302：在庫表（荷主向け）

| 項目 | 内容 |
|------|------|
| 機能 | 荷主自身が自社在庫を確認できる |
| 形式 | 画面（リアルタイム）/ CSV出力 / PDF（期末確定版） |
| 表示軸 | 荷主×SKU×ロット×ロケ×ステータス（4軸の集計） |
| 致命傷ライン | DB-1 / DB-4 / CA-2（評価額） |
| 9割突っ走り部分 | 画面 UI・グラフ |
| スナップショット | 当日23:59時点の在庫を取得（QA-2①確定） |
| 完璧に詰める部分 | スナップショット取得タイミングの精度確保・原価評価額の表示精度 |

**画面例の集計軸：**
- SKU 単位（合計・available/reserved 内訳）
- ロケ単位（容量利用率付き）
- 荷主全体サマリー（金額・ケース数・容積）

---

### F-1303：棚卸表

| 項目 | 内容 |
|------|------|
| 機能 | 棚卸（工程11）の結果を確定帳票として出力 |
| 形式 | PDF（差異一覧）/ CSV（明細） |
| 出力タイミング | 棚卸確定時 |
| 致命傷ライン | DB-1 / BF-4（差異処理）|
| 9割突っ走り部分 | レイアウト |
| 完璧に詰める部分 | 帳簿在庫 vs 実在庫の差異額計算（CA-2 評価方式と整合） |

---

### F-1304：出荷実績レポート（荷主向け定期送信）

| 項目 | 内容 |
|------|------|
| 機能 | 荷主に対し日次/週次/月次で出荷実績を送信 |
| 形式 | CSV / PDF / API（荷主システム連携）|
| トリガー | 定時バッチ |
| 致命傷ライン | DB-4 / LK-1（外部連携）|
| 9割突っ走り部分 | 配信文面 |
| 完璧に詰める部分 | 送信失敗時のリトライ・荷主毎の配信タイミング設定 |

---

### F-1305：入荷予定 vs 実績レポート

| 項目 | 内容 |
|------|------|
| 機能 | ASN（予定）と実入荷の差異を可視化 |
| 用途 | 荷主との認識合わせ・差異処理の根拠書類 |
| 形式 | 画面 + CSV |
| 致命傷ライン | LK-1 / BF-4 |
| 9割突っ走り部分 | 画面 UI |
| 完璧に詰める部分 | 差異理由のカテゴリ分け（多入/少入/品違い/破損） |

---

### F-1306：賃率シミュレータ（営業ツール）

| 項目 | 内容 |
|------|------|
| 機能 | 「これだけの物量・期間で請求はいくらになるか」を即時試算 |
| 用途 | キーエンス向け営業資料・新規荷主との単価交渉ツール |
| 入力 | 物量（ケース数・坪数）・期間・請求方式 |
| 出力 | 概算額・根拠表 |
| 致命傷ライン | CA-1 |
| 9割突っ走り部分 | 入力 UI |
| 完璧に詰める部分 | 試算ロジックの精度・実請求との乖離防止 |

> **これがキーエンス向け差別化4点「連携費用無料」「カスタマイズ不要設計」と整合する営業武器になる**

---

## 工数見積（叩き台）

| 機能 | 見積（日） |
|------|----------|
| F-1301 請求書発行 | 12 |
| F-1302 在庫表 | 5 |
| F-1303 棚卸表 | 3 |
| F-1304 出荷実績レポート | 4 |
| F-1305 入荷差異レポート | 3 |
| F-1306 賃率シミュレータ | 6 |
| 合計 | **33** |

> 工程13 単独で33日。他工程と並行で進める前提。

---

## 次工程への申し送り

- F-1301（請求書）の PDF レイアウトは **荷主ごとに微妙に違う**ことが多い。テンプレートエンジン（Handlebars 系）で対応する設計を Phase 8 で詰める
- F-1306（賃率シミュレータ）はキーエンスデモ時の重要ツール → Phase 8 早期着手推奨

---

---

## QA確定事項（3号ヒアリング・2026-05-16）

### QA-2：在庫スナップショット・月跨ぎ繰越・請求タイミング

| QA番号 | 確定内容 |
|--------|---------|
| QA-2① | 在庫スナップショットは**当日23:59時点**の在庫を取得（F-1302 に反映済み） |
| QA-2③ | 月跨ぎ繰越は**前月末日23:59時点の在庫**をスナップショットとして使用（F-1301 に反映済み） |
| QA-2④ | 請求計算の実行タイミングは**荷主単位**で①手動 / ②月末バッチ / ③締日後N営業日バッチ の3方式から切替可能（F-1301 に反映済み） |

---

### QA-12：補充ルールは条件マッチング型

**確定：条件マッチング型（優先順位方式ではない）**

補充ルール（P-6 閾値ベース自動補充指示）は条件マッチング型で実装する。

- **構造**：「条件カラム」×「補充内容カラム」の組み合わせ。ルールが条件に合致した場合に補充指示を生成
- **優先順位方式は採用しない**：複数ルールが合致した場合は全件発動（優先度ランキングで1件のみ選択する方式ではない）
- **DB設計イメージ**：
  ```sql
  CREATE TABLE replenishment_rules (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES owners(id),
    -- 条件カラム
    sku_id BIGINT REFERENCES skus(id),          -- NULL = 全 SKU 対象
    location_type TEXT,                          -- NULL = 全ロケ種別
    abc_class TEXT,                              -- NULL = 全 ABC 区分
    min_threshold NUMERIC NOT NULL,             -- 閾値（在庫数がこれ以下で発動）
    -- 補充内容カラム
    replenish_from_location_type TEXT NOT NULL,  -- 補充元ロケ種別
    replenish_qty NUMERIC NOT NULL,             -- 補充数量
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- 複数ルールが同時合致 → 全件を補充指示として生成（重複は補充指示のマージで処理）

---

---

### Q12-5（帳票側）：請求単位マスター化（2026-05-17 確定）

**確定：`billing_rules.unit` を enum から `unit_master` FK 参照化（帳票・計算ロジック側対応）**

- `billing_rules.unit` カラムの型変更（enum → `unit_master.id` FK）は process_12 側 H1R-C タスクが担当
- **帳票・計算ロジック側の責務（本 process_13 が対応）：**
  - 請求計算時は `unit_master.unit_code`（ケース / ピース / 坪 / ㎡ / パレット / kg / hour 等）を参照して単価を適用
  - 請求書帳票（PDF・CSV）の「単位」欄は `unit_master.unit_name` を表示
  - 単位追加時に帳票側ロジック変更は不要（unit_master 参照で自動対応）
- **SQL イメージ（請求計算時の unit 取得）：**
  ```sql
  SELECT br.unit_price, um.unit_code, um.unit_name
  FROM billing_rules br
  JOIN unit_master um ON um.id = br.unit_id
  WHERE br.owner_id = ? AND br.rule_type = ?;
  ```

---

### Q13-1：端数処理の荷主別設定（2026-05-17 確定・選択肢B＋荷主別切替）

**確定：端数処理は荷主ごとに設定可能・デフォルトは四捨五入**

- `billing_rules` に端数処理設定カラムを追加（migration は process_12 側と調整）：
  ```sql
  ALTER TABLE billing_rules
    ADD COLUMN rounding_method TEXT NOT NULL DEFAULT 'round'
      CHECK (rounding_method IN ('floor', 'round', 'ceil'));
  -- 'floor' = 切り捨て（A）, 'round' = 四捨五入（B）, 'ceil' = 切り上げ（C）
  ```
- デフォルト値は `'round'`（四捨五入）
- 月次バッチ請求計算時に荷主ごとの `rounding_method` を参照して端数処理を適用
- 帳票には端数処理後の整数値（円単位）を表示
- **計算ロジックイメージ：**
  ```sql
  SELECT
    CASE br.rounding_method
      WHEN 'floor' THEN FLOOR(ps.qty * br.unit_price)
      WHEN 'ceil'  THEN CEIL(ps.qty * br.unit_price)
      ELSE              ROUND(ps.qty * br.unit_price)  -- 'round' がデフォルト
    END AS storage_fee
  FROM period_snapshot ps
  JOIN billing_rules br ON br.owner_id = ps.owner_id AND br.rule_type = '保管料';
  ```

---

### Q13-2：請求書修正フロー（2026-05-17 確定・選択肢A）

**確定：請求書修正は翌月加減算方式**

- 前月請求書に誤りが発覚した場合、翌月分の請求書に差額（加算 or 減算）を組み込む
- `billing_invoices` に修正対応カラムを追加：
  ```sql
  ALTER TABLE billing_invoices
    ADD COLUMN adjustment_ref_invoice_id BIGINT REFERENCES billing_invoices(id),
    ADD COLUMN adjustment_amount         NUMERIC,  -- 正=追加請求、負=控除
    ADD COLUMN adjustment_reason         TEXT;
  ```
- **在庫データ整合性の修正**（`inventory_adjustments` 経由）は process_11 側 H1R-B タスクが担当
- 月次スナップショットの確定値は変更しない（翌月の差額で吸収）
- 帳票（PDF）には修正行として「前月分調整：+/-XXXX 円（理由）」を明示
- 前月請求書の原本は保持（取り消し・再発行はしない）

---

*最終更新: 2026-05-08 / Phase 7-I まーちゃん（工程13 帳票・レポート 6機能の論点叩き台）*  
*QA確定事項追記：2026-05-16 / Phase 9-REFLECT2-D にーちゃん（#925）*  
*HEARING1確定反映：2026-05-17 / Phase 9-H1R-D さーちゃん（#941）Q12-5帳票側・Q13-1・Q13-2*
