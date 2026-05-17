# 工程12：マスタ管理機能開発 論点叩き台

> 起票：2026-05-09 / Phase 9-β さーちゃん
> 対象テーブル：owners / skus / user_owners / billing_rules
> 推定工数：10日（PHASE9_IMPLEMENTATION_PLAN.md より）

---

## 0. 前提

工程12 は 工程1〜11 の**基盤となるマスタデータの CRUD 管理画面**を実装する工程。
全業務テーブルが `owner_id` を持つ設計（DB-4 論理分離+RLS）の前提で論点を整理する。

---

## 1. owners（荷主マスタ）

### 現行スキーマ（phase9_stage1_foundation.sql）

```sql
CREATE TABLE owners (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  theme_color TEXT,
  allocation_strategy TEXT NOT NULL DEFAULT 'fifo' CHECK (...),
  picking_strategy TEXT NOT NULL DEFAULT 'single' CHECK (...),
  lot_strategy TEXT NOT NULL DEFAULT 'inbound_batch' CHECK (...),
  inspection_strategy TEXT NOT NULL DEFAULT 'full' CHECK (...),
  discrepancy_strategy TEXT NOT NULL DEFAULT 'hold' CHECK (...),
  putaway_strategy TEXT NOT NULL DEFAULT 'free' CHECK (...),
  return_strategy TEXT NOT NULL DEFAULT 'wms_separate' CHECK (...),
  barcode_required_fields TEXT NOT NULL DEFAULT 'jan',
  cost_management_enabled BOOLEAN NOT NULL DEFAULT false,
  billing_period_type TEXT NOT NULL DEFAULT '3-period' CHECK (...),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 論点一覧

#### O-1: 論理削除 vs 物理削除

| 選択肢 | 内容 | トレードオフ |
|--------|------|------------|
| A | 物理削除（ON DELETE RESTRICT） | 依存テーブルがある限り削除不可。過去データ参照は可 |
| **B（推奨）** | 論理削除（`is_active BOOLEAN` フラグ） | 廃業・解約荷主を「非表示」にしつつ過去帳票・在庫履歴を保全 |
| C | 論理削除（`deleted_at TIMESTAMPTZ`） | B より詳細だが RLS と組み合わせるとクエリが複雑化 |

> **さーちゃん推奨：B**。`is_active = false` の荷主は一覧画面から非表示、管理者のみ閲覧可のポリシーを別途追加。RLS への影響が最小。

---

#### O-2: code の変更可否

現状 `UNIQUE` 制約あり。既存在庫・請求履歴が存在する場合の変更は全テーブルの参照が壊れる（`owner_id` ではなく code を参照してるコードが存在する可能性）。

| 選択肢 | 内容 |
|--------|------|
| **A（確定・時吉さん決定 2026-05-16）** | code 変更禁止（UI で非活性）。ただし枝番（例 MK001-02）を持てる構造は維持する |
| B | code 変更可能だが、在庫・取引が存在する場合は警告ダイアログを出す（DB 制約なし・アプリ制御） |

> **時吉さん確定：A**。荷主コード自体は変更禁止。ただし枝番（例 MK001-02）を別 `owners` レコードとして登録する構造は維持する（既存枝番管理ルール：必要時のみ -02 から追加・履歴重視 と整合）。  
> 理由：荷主経由のベンダー品預かり等で「請求先は元荷主、明細・請求は枝番別」のニーズがある。

---

#### O-3: strategy フラグ変更時の整合性

`lot_strategy` / `picking_strategy` / `allocation_strategy` を在庫保有中に変更すると業務矛盾が起きる可能性。

| 選択肢 | 内容 |
|--------|------|
| A | DB 制約なし。運用ルールで制御 |
| **B（推奨）** | アプリ側で「在庫ゼロ確認」後のみ変更可（警告ダイアログ） |
| C | 変更ログを `owner_strategy_history` テーブルに積む |

> **さーちゃん推奨：B + C**。特に `billing_period_type` の変更は請求計算に直撃するため、変更ログは必須（CA-1 と整合）。

---

#### O-4: barcode_required_fields の型

現状 `TEXT NOT NULL DEFAULT 'jan'`。実運用では "jan,serial,lot" のようにカンマ区切りで複数指定。

| 選択肢 | 内容 |
|--------|------|
| A | TEXT のまま（アプリで split） |
| **B（推奨）** | `TEXT[] NOT NULL DEFAULT '{jan}'` に変更。PostgreSQL 配列型で厳密に管理 |

> **さーちゃん推奨：B**。バリデーション・GIN インデックスが使えるようになる。移行コスト低い（まだ本番データなし）。

---

#### O-5: updated_at トリガー

`updated_at` は現状 `DEFAULT now()` のみで INSERT 時の初期値は正しいが、UPDATE 後に自動更新されない。

> **必須修正**：`set_updated_at()` トリガーを owners / skus に追加する。

---

#### O-6: RLS に admin（倉庫全体管理者）ポリシーが未定義

現状の `owners_assigned_read` ポリシーは「所属する荷主のみ閲覧」。倉庫管理者（全荷主横断）の操作をどう制御するか。

| 選択肢 | 内容 |
|--------|------|
| A | Service Role キーで RLS バイパス（管理画面は全部 Service Role） |
| **B（推奨）** | `user_owners` に `role = 'wms_admin'` を追加し、全 owner_id 許可のポリシーを追加 |

> **さーちゃん推奨：B**。A は Service Role キーをフロントに渡す設計になり漏洩リスクが高い。

---

### owners マスタ追加カラム候補（まとめ）

```sql
ALTER TABLE owners ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE owners ALTER COLUMN barcode_required_fields TYPE TEXT[];
ALTER TABLE owners ALTER COLUMN barcode_required_fields SET DEFAULT '{jan}';

-- updated_at トリガー
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 2. skus（商品/SKUマスタ）

### 現行スキーマ

```sql
CREATE TABLE skus (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  sku_code TEXT NOT NULL,
  jan TEXT,
  name TEXT NOT NULL,
  serial_required BOOLEAN NOT NULL DEFAULT false,
  lot_required BOOLEAN NOT NULL DEFAULT false,
  abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C')),
  created_at / updated_at ...
  UNIQUE (owner_id, sku_code)
);
CREATE UNIQUE INDEX idx_skus_owner_jan ON skus(owner_id, jan) WHERE jan IS NOT NULL;
```

### 論点一覧

#### S-1: JAN コードのバリデーション

**✅ 確定（Q12-2 / 2026-05-17 3号ヒアリング確定）**

JANコード書式チェックは荷主マスタ設定で切替可能にする。DB CHECK 制約ではなくアプリ側バリデーション＋荷主マスタ設定参照とする設計。

| モード | 条件 | 用途 |
|--------|------|------|
| **厳格** | 8桁または13桁の数字のみ許可 | 標準 JAN コードを使用する荷主 |
| **緩和** | チェックなし | 荷主独自コード・内部コードを JAN フィールドに入れるケース |

設計方針：
- `owners` テーブルに `jan_strict_mode TEXT NOT NULL DEFAULT 'loose'` を追加（値域: `strict` / `loose`）
- `jan_strict_mode = 'strict'` の荷主は `^[0-9]{8}$` または `^[0-9]{13}$` のアプリ側バリデーションを適用（ITF-14バーコードは緩和扱い）
- `jan_strict_mode = 'loose'` の荷主は書式チェックなし（荷主独自コード・ITF-14等を許容）
- DB の CHECK 制約は追加しない（荷主ごとの設定差異を DB 制約では表現できないため）

```sql
ALTER TABLE owners ADD COLUMN jan_strict_mode TEXT NOT NULL DEFAULT 'loose'
  CHECK (jan_strict_mode IN ('strict', 'loose'));
```

---

#### S-2: 廃番 SKU の扱い（論理削除）

在庫が残っている SKU は `ON DELETE RESTRICT` で物理削除できない。廃番フラグが必要。

> **必須追加**：`is_active BOOLEAN NOT NULL DEFAULT true`

---

#### S-3: lot_required / serial_required 変更時の整合性

在庫がある状態でフラグを変更すると、既存の lots/serials レコードと矛盾が起きる。

| 選択肢 | 内容 |
|--------|------|
| A | 制約なし（運用ルール） |
| **B（推奨）** | 在庫ゼロ確認後のみ変更可（アプリ制御） |

---

#### S-4: SKU 一括インポート（CSV）

**✅ 確定（Q12-3 / 2026-05-17 3号ヒアリング確定）**

荷主追加時に数百〜数千件を一括登録する需要がある。CSV インポート画面で実行時に以下3モードを選択可能とする。

| モード | 動作 | SQL パターン |
|--------|------|------------|
| **A: 上書き** | 既存 SKU も新データで更新 | `INSERT ... ON CONFLICT DO UPDATE` |
| **B: 禁止** | 既存 SKU があればその行をスキップ（または全体エラー） | `INSERT ... ON CONFLICT DO NOTHING` |
| **C: 差分のみ** | 新規 SKU のみ追加・既存は変更しない | B と同等だが件数レポートで差分明示 |

```sql
-- モード A: 上書き
INSERT INTO skus (owner_id, sku_code, jan, name, ...)
VALUES (...)
ON CONFLICT (owner_id, sku_code)
DO UPDATE SET jan = EXCLUDED.jan, name = EXCLUDED.name, updated_at = now();

-- モード B/C: 禁止・差分のみ
INSERT INTO skus (owner_id, sku_code, jan, name, ...)
VALUES (...)
ON CONFLICT (owner_id, sku_code) DO NOTHING;
```

**推奨仕様：実行前プレビュー**
- インポート実行前に「既存一致件数 / 新規件数 / スキップ予定件数」を画面表示
- ユーザーが内容を確認してから「実行」ボタンを押す2ステップ UI を推奨
- プレビューは本 INSERT を実行せず件数のみ返すドライラン API で実装する

---

#### S-5: abc_class の初期値と分析タイミング

現状 `NULL` 許容（未分類）。WMS 稼働後に ABC 分析を走らせて更新する前提。

> **論点**：ABC 分析バッチをいつ・どのタイミングで走らせるか（日次・週次・手動）。バッチ完了までは `abc_class = NULL` → BF-2（引当ロジック）でどう扱うか。**Phase 9-β の対象外（BF-2 工程で決定）**。

---

#### S-6: updated_at トリガー

owners と同様に必須。

---

## 3. user_owners（ユーザーマスタ）

### 現行スキーマ

```sql
CREATE TABLE user_owners (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,              -- auth.users.id（FK 制約なし）
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer', 'shipper')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID,
  UNIQUE (user_id, owner_id)
);
```

### 論点一覧

#### U-1: 倉庫全体管理者ロールの追加

現状のロールは `admin / operator / viewer / shipper` で全荷主横断の倉庫管理者がない。

| 選択肢 | 内容 |
|--------|------|
| A | wms_admin ロールを user_owners に追加し、全 owner_id アクセスの RLS ポリシーを追加 |
| **B（推奨）** | `wms_admin` をロールに追加 + `owner_id = NULL` で全荷主アクセスを表現（スキーマ変更必要） |
| C | 別テーブル `wms_admins(user_id)` を作成 |

> **さーちゃん推奨：A**。`owner_id NOT NULL` 制約を保ちながら wms_admin の場合のみ全 owner アクセスを RLS で許可する設計が最もシンプル。ただし全荷主横断の RLS ポリシーは `USING (true)` になるため注意。

---

#### U-2: auth.users との参照整合性

`user_id UUID` は `auth.users.id` を参照しているが外部キー制約がない（cross-schema 制限）。
Supabase Auth でユーザーを削除した場合、`user_owners` に孤立レコードが残る。

| 選択肢 | 内容 |
|--------|------|
| A | そのまま（孤立許容・auth 側で削除前に user_owners を手動 DELETE） |
| **B（推奨）** | Supabase Auth の `on_auth_user_deleted` Webhook / Trigger で自動 CASCADE |

> **さーちゃん推奨：B**。Supabase の `auth.users` には DB Trigger を貼れる（`AFTER DELETE ON auth.users`）。実装は Phase 9 の AU-1 工程で確認。

---

#### U-3: 招待フロー

**✅ 確定（Q12-4 / 2026-05-17 3号ヒアリング確定）**

招待フローは2系統で実装する。

**標準フロー（一般ユーザー向け）：**
```
管理者がメールアドレスを入力
→ Supabase Auth admin.inviteUserByEmail() 呼び出し（Edge Function 経由）
→ ユーザーが招待メールを承認（Auth ユーザー作成完了）
→ 管理者が `user_owners` に役割・荷主を設定（手動 INSERT）
```

**例外フロー（HT現場担当者向け・メールなし）：**
```
管理者が「直接アカウント作成」フォームでユーザーID・初期パスワードを入力
→ Supabase Auth admin.createUser() 呼び出し（Edge Function 経由）
→ ユーザーID + 初期パスワードを管理者が現場担当者に手渡し
→ 初回ログイン時にパスワード変更を強制（password_change_required フラグ）
→ `user_owners` に役割・荷主を設定
```

> **実装方針**：
> - 標準フロー：`admin.inviteUserByEmail()` → 承認後に管理者が手動で権限付与（段階的フロー）
> - 例外フロー：`admin.createUser()` + `email_confirmed = true` で即時有効化
> - 初回パスワード変更強制は `user_metadata.password_change_required = true` で管理し、ログイン後リダイレクトで実装

---

#### U-4: ロール変更の監査ログ

誰が誰のロールを変更したかの記録。`granted_by` カラムはあるが、変更履歴がない。

| 選択肢 | 内容 |
|--------|------|
| A | 監査ログなし |
| **B（推奨）** | `user_owners_log(id, user_owner_id, old_role, new_role, changed_by, changed_at)` テーブルを別途作成 |

> **さーちゃん推奨：B**。権限変更の証跡は3PL 業務で必要になるケースあり（荷主との契約上）。

---

#### U-5: RLS の管理者向けポリシー欠如

現状 `user_owners_self_read`（自分の行のみ閲覧）しかない。
管理者が他ユーザーの権限を管理するには別ポリシーが必要。

```sql
CREATE POLICY user_owners_admin_manage ON user_owners
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_owners AS uo
      WHERE uo.user_id = auth.uid()
        AND uo.owner_id = user_owners.owner_id
        AND uo.role = 'admin'
    )
  );
```

---

## 4. billing_rules（請求ルールマスタ）

### 現行スキーマ

```sql
CREATE TABLE billing_rules (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,         -- CHECK 制約なし
  period_type TEXT NOT NULL CHECK (period_type IN ('3-period', '2-period', 'daily', 'monthly', 'tsubo')),
  unit TEXT NOT NULL CHECK (unit IN ('case', 'piece', 'tsubo', 'sqm')),
  unit_price NUMERIC NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,                   -- NULL = 無期限
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 論点一覧

#### B-1: rule_type の enum 化

現状 `TEXT NOT NULL` で CHECK 制約なし。業界標準の種別を定義する必要あり。

| 種別 | 説明 |
|------|------|
| `storage` | 保管料（在庫×期末×単価） |
| `inbound` | 入庫料（入荷件数×単価） |
| `outbound` | 出庫料（出荷件数×単価） |
| `off_period` | 期間外料（早朝・深夜・土日） |
| `handling` | 雑工料（その他） |

> **必須追加**：`CHECK (rule_type IN ('storage', 'inbound', 'outbound', 'off_period', 'handling'))` または `CREATE TYPE billing_rule_type AS ENUM (...)` で定義。

---

#### B-2: 有効期間の重複チェック

同一 `(owner_id, rule_type, unit)` で期間が重複しているルールが存在すると請求計算が壊れる。

| 選択肢 | 内容 |
|--------|------|
| A | DB 制約なし（アプリで排他チェック） |
| **B（推奨）** | EXCLUDE 制約（PostgreSQL 拡張 btree_gist）で重複を DB レベルで防ぐ |

```sql
-- btree_gist 拡張が必要
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE billing_rules ADD CONSTRAINT billing_rules_no_overlap
EXCLUDE USING gist (
  owner_id WITH =,
  rule_type WITH =,
  unit WITH =,
  daterange(valid_from, valid_to, '[)') WITH &&
);
```

> **さーちゃん推奨：B**。重複は請求バグの根本原因になるため DB で担保する。

---

#### B-3: 削除時の監査保全

`ON DELETE CASCADE` になっているため、荷主削除で請求ルールも消える。
請求済みレコード（将来の `billing_history`）がある場合、証跡を失う。

| 選択肢 | 内容 |
|--------|------|
| A | CASCADE のまま（荷主削除はありえない運用で許容） |
| **B（推奨）** | `ON DELETE RESTRICT` に変更。荷主を削除する前に管理者が請求ルールを手動削除する運用 |
| C | 論理削除のみで物理削除禁止 |

> **さーちゃん推奨：B**。荷主削除は稀なオペレーションなので RESTRICT で十分。CASCADE は 事故リスクが高い。

---

#### B-4: 過去ルールの変更禁止

`billing_history`（月次バッチで生成する請求書）に紐づく過去ルールは変更・削除すべきでない。

| 選択肢 | 内容 |
|--------|------|
| A | 制約なし |
| **B（推奨）** | `valid_from < CURRENT_DATE` のルールは UPDATE/DELETE を禁止するトリガーで保護 |

```sql
CREATE OR REPLACE FUNCTION protect_past_billing_rules()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.valid_from < CURRENT_DATE THEN
    RAISE EXCEPTION '過去の請求ルールは変更できません（valid_from: %）', OLD.valid_from;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_rules_protect_past
  BEFORE UPDATE OR DELETE ON billing_rules
  FOR EACH ROW EXECUTE FUNCTION protect_past_billing_rules();
```

---

#### B-5: unit の拡張候補 → unit_master テーブル化

**✅ 確定（Q12-5 / 2026-05-17 3号ヒアリング確定）**

`billing_rules.unit` を enum（CHECK 制約）から `unit_master` テーブルへの FK 参照に変更する。
これにより将来の新規単位追加がマスタ管理画面から行えるようになる（マイグレーション不要）。

**確定単位一覧（既存4単位 + 今回追加4単位）：**

| unit_code | 表示名 | 利用ケース |
|-----------|--------|----------|
| `case`      | ケース         | 現行4単位（既存） |
| `piece`     | ピース         | 現行4単位（既存） |
| `tsubo`     | 坪             | 現行4単位（既存） |
| `sqm`       | 平方メートル   | 現行4単位（既存） |
| `hour`      | 時間           | 時間当たり作業料（今回追加） |
| `kg`        | 重量(kg)       | 重量物保管料（今回追加） |
| `cbm`       | 立米(m3)       | 体積単位保管料（今回追加） |
| `truckload` | 車建           | トラック1台単位（今回追加） |

**設計変更内容：**

```sql
-- unit_master テーブル新設（2号実装カラム構成・v4 1号承認済み）
-- status TEXT で todos/members と命名一貫・category/note で拡張的
CREATE TABLE unit_master (
  code       TEXT PRIMARY KEY,                        -- 'case', 'piece', 'hour' 等
  name       TEXT NOT NULL,                           -- 英語名（内部識別用）
  label      TEXT NOT NULL,                           -- 表示名（日本語）
  category   TEXT,                                    -- 分類（count/weight/volume/time 等）
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'active',          -- 'active' / 'inactive'
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 初期データ投入（8単位・unit_code は sqm/cbm/truckload を正として維持）
INSERT INTO unit_master (code, name, label, category, sort_order) VALUES
  ('case',      'Case',      'ケース',       'count',  1),
  ('piece',     'Piece',     'ピース',       'count',  2),
  ('tsubo',     'Tsubo',     '坪',           'area',   3),
  ('sqm',       'Sqm',       '平方メートル', 'area',   4),
  ('hour',      'Hour',      '時間',         'time',   5),
  ('kg',        'Kg',        '重量(kg)',     'weight', 6),
  ('cbm',       'Cbm',       '立米(m3)',     'volume', 7),
  ('truckload', 'Truckload', '車建',         'count',  8);

-- billing_rules の unit カラムを enum → FK に変更
ALTER TABLE billing_rules DROP CONSTRAINT billing_rules_unit_check;
ALTER TABLE billing_rules ADD CONSTRAINT billing_rules_unit_fk
  FOREIGN KEY (unit) REFERENCES unit_master(code);
```

> **現行スキーマとの互換性**：`unit TEXT` カラムの型は変えず CHECK 制約のみ差し替え + FK 追加。既存データ（`case/piece/tsubo/sqm`）は `unit_master` 初期データと一致するため整合性あり。
>
> **⚠️ プロト実装との差異注意**：wms-impl 2号プロトタイプでは `m2`（平方メートル）・`m3`（立米）・`vehicle`（車建）というコードを使用しているケースがある。本番 Supabase 実装時は specs 正値（`sqm` / `cbm` / `truckload`）に統一すること。プロトのシードデータを流用する場合は事前に変換スクリプトを用意する。

---

#### B-6: billing_rules にない updated_at

monitoring のために `updated_at` が必要。INSERT のみで変更不可（B-4）なら不要とも言えるが、トリガーで保護するまでは自由に変更できてしまう。

> **論点**：`updated_at` を追加するか。または `created_at` のみで管理（変更禁止を徹底）か。

---

## 5. 共通論点

### C-1: updated_at 自動更新トリガー

`owners` / `skus` に対して `set_updated_at()` トリガーを追加。`billing_rules` は変更禁止のため不要。`user_owners` は `granted_at` が実質的な更新日時。

> **必須実装**（さーちゃんで実施可）。

---

### C-2: 変更履歴テーブルの設計

| テーブル | 必要度 | 理由 |
|---------|--------|------|
| `owners_history` | 中 | strategy フラグ変更の影響追跡 |
| `skus_history` | 低 | 廃番フラグ変更程度 |
| `billing_rules` | 高 | 請求エビデンス・監査対応 |
| `user_owners_log` | 高 | 権限変更の証跡 |

> **さーちゃん推奨**：Phase 9 では `billing_rules` と `user_owners_log` を優先実装。`owners_history` は Phase 9.5 以降。

---

### C-3: RLS の管理者ポリシー整備

現状 billing_rules の RLS は `admin / operator` が全操作可能。owners への書き込み（新荷主追加・フラグ変更）は現状 RLS ポリシーが存在しない（SELECTのみ）。

> **必須追加**：`owners` テーブルへの INSERT / UPDATE / DELETE ポリシーを wms_admin ロール向けに追加。

---

## 6. 実装優先度まとめ

| 論点 | 優先度 | 影響 | さーちゃん推奨 |
|------|--------|------|--------------|
| C-1: updated_at トリガー | **高** | 全マスタ | 即実施 |
| B-1: rule_type CHECK 制約 | **高** | billing_rules | 即実施 |
| B-3: CASCADE → RESTRICT | **高** | billing_rules | 即実施 |
| O-1: owners 論理削除 | **高** | owners | is_active 追加 |
| S-2: skus 廃番フラグ | **高** | skus | is_active 追加 |
| U-5: 管理者 RLS ポリシー | **高** | user_owners | 即実施 |
| B-4: 過去ルール変更禁止 | **中** | billing_rules | トリガー実装 |
| U-2: auth.users CASCADE | **中** | user_owners | Trigger 実装 |
| O-4: barcode_required_fields 型 | **中** | owners | TEXT → TEXT[] |
| B-2: 有効期間重複防止 | **中** | billing_rules | EXCLUDE 制約 |
| C-2: 変更履歴テーブル | **中** | billing / user_owners | 別タスク起票 |
| B-1: rule_type enum 追加候補 | **低** | billing_rules | 運用開始後に拡張 |

---

## 7. DB 変更が必要な論点まとめ（マイグレーション候補）

```sql
-- 1. updated_at トリガー関数（共通）
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- 2. owners: is_active, barcode_required_fields 型変更, updated_at トリガー
ALTER TABLE owners ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
-- barcode_required_fields TEXT → TEXT[] は型変換 migration 必要
CREATE TRIGGER owners_updated_at BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. skus: is_active, JAN バリデーション, updated_at トリガー
ALTER TABLE skus ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
-- ALTER TABLE skus ADD CONSTRAINT skus_jan_format CHECK (jan ~ '^[0-9]{8}$' OR jan ~ '^[0-9]{13}$');
CREATE TRIGGER skus_updated_at BEFORE UPDATE ON skus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. user_owners: wms_admin ロール追加
ALTER TABLE user_owners DROP CONSTRAINT user_owners_role_check;
ALTER TABLE user_owners ADD CONSTRAINT user_owners_role_check
  CHECK (role IN ('admin', 'operator', 'viewer', 'shipper', 'wms_admin'));

-- 5. billing_rules: rule_type CHECK, CASCADE → RESTRICT, 過去ルール保護トリガー
ALTER TABLE billing_rules ADD CONSTRAINT billing_rules_rule_type_check
  CHECK (rule_type IN ('storage', 'inbound', 'outbound', 'off_period', 'handling'));
-- ON DELETE RESTRICT は既存 FK を DROP して再作成が必要

-- 6. RLS: owners 書き込み + user_owners 管理者ポリシー追加
CREATE POLICY owners_wms_admin_write ON owners FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_owners WHERE user_id = auth.uid() AND role = 'wms_admin')
  );
```

---

## 8. 時吉さんへの確認事項（要判断）

> 全件確定済み（3号ヒアリング 2026-05-16〜17）

| # | 論点 | 確認内容 | ステータス |
|---|------|---------|----------|
| 1 | O-2 | owner.code 変更は運用上ありうるか | ✅ 確定 Q12-1（変更禁止・枝番方式） |
| 2 | S-1 | JAN コードは必ず 8 桁 or 13 桁の数字か | ✅ 確定 Q12-2（荷主マスター設定で切替） |
| 3 | S-4 | CSV 一括インポート時の既存 SKU 上書きを許可するか | ✅ 確定 Q12-3（A/B/C 3モード選択） |
| 4 | U-3 | ユーザー招待フローは段階的か、一括か | ✅ 確定 Q12-4（標準・例外2系統） |
| 5 | B-5 | unit の追加候補は必要か | ✅ 確定 Q12-5（unit_master テーブル化・8単位）|

---

## 9. 次タスク候補（起票先：まーちゃん → こーちゃん/さーちゃん）

| タスク | 担当 | 工数 |
|--------|------|------|
| Phase 9-γ: owners/skus is_active + updated_at トリガー migration | さーちゃん | 1日 |
| Phase 9-δ: billing_rules rule_type CHECK + CASCADE→RESTRICT + 過去保護 migration | さーちゃん | 1日 |
| Phase 9-ε: user_owners wms_admin ロール + RLS ポリシー整備 | さーちゃん | 1日 |
| Phase 9-ζ: 管理画面 UI（owners CRUD）| こーちゃん | 3日 |
| Phase 9-η: 管理画面 UI（skus CRUD + CSV インポート）| こーちゃん | 3日 |
| Phase 9-θ: 管理画面 UI（user_owners 招待・ロール管理）| こーちゃん | 2日 |
| Phase 9-ι: 管理画面 UI（billing_rules CRUD）| こーちゃん | 2日 |

---

---

## ⏳ 時吉さん決定待ち（先行ロック論点：Q12-1）

> **このセクションは時吉さんの判断を受け取るための受け入れ節です。**  
> 決定が届いたら「決定内容」欄を埋め、上部 O-2 論点の内容も更新してください。

---

### Q12-1：荷主コード変更可否（O-2 対応）

**ステータス：✅ 確定（2026-05-16 3号ヒアリングで時吉さん決定）**

> 論点の詳細は「O-2: code の変更可否」セクションを参照。

| 項目 | 内容 |
|------|------|
| **時吉さんの決定** | 選択肢A：荷主コード自体は変更禁止（UI で非活性）。ただし枝番（例 MK001-02）を持てる構造は維持する |
| 決定した選択肢 | **A** |
| 運用上の考慮 | 荷主経由のベンダー品預かり等で「請求先は元荷主、明細・請求は枝番別」のニーズがある。枝番は別 `owners` レコードとして登録し、コードを `-02`、`-03` と枝番付きで運用する |
| 決定理由・背景 | 既存の枝番管理ルール（必要時のみ -02 から追加・履歴重視）と整合。コードの変更を禁止することでデータ整合性を確保しつつ、枝番による請求分割ニーズに対応する |

**反映先（反映済み）：**
- [x] 本ファイル O-2 セクションの推奨案を時吉さん決定で上書き（2026-05-16）
- [ ] 管理画面 UI 設計（owners CRUD）の code フィールドを非活性に
- [ ] アプリ側バリデーション実装仕様（こーちゃんへの引き継ぎ内容）

---

### ⚠️ 派生確認事項：枝番別請求書発行の対応状況

**確認結果（2026-05-16 さーちゃん）：枝番独立発行は対応済み・合算請求は未対応**

現行の `generate_monthly_billing` 関数は `owner_id` 単位で請求書を生成する設計。
枝番（例 MK001-02）を別 `owners` レコードとして登録すれば、各枝番に対して個別の請求書が生成される（`billing_invoices.owner_id` ベース）。

ただし「請求先は元荷主（MK001）、明細・請求は枝番別（MK001-02/MK001-03）」という
**連結請求書**（1枚の請求書に複数枝番の明細を合算して請求先は親荷主）の要件には対応していない。

**確認した実装（Phase 9 実装済み）：**
- `billing_invoices` は `owner_id` 単位で1請求書
- `billing_invoice_lines` は billing_invoices に紐付く明細（枝番単位の分割なし）
- `generate_monthly_billing` 関数：`owner_id` ごとにループして請求書生成

**課題として記録（まーちゃんへ報告済み）：**
- ✅ Phase 9 現行実装：枝番ごとに独立した請求書を発行（別々の荷主として扱う）→ 対応済み
- ❌ 追加実装が必要：親荷主への合算請求書（枝番明細を1枚に集約）→ **未対応・Phase 9.5 以降の課題**
  - 対応するには `billing_invoices` に `parent_owner_id` フィールドを追加し、請求書集約ロジックの実装が必要

---

---

## 10. QA確定事項（3号ヒアリング・2026-05-16）

以下は3号ヒアリング（QA-1〜16）で時吉さんが確定した事項のうち、工程12（マスタ管理）に関連するもの。

### QA-1：ロケーションコード構成項目の変更不可

**確定：登録後変更不可**

ロケーションコードの構成項目（階 / フロア区分 / 種別英字 / 通路 / 列・段・位置）は、ロケーション作成後に変更できない。

- UI：編集画面でロケコード構成項目は非活性（読み取り専用）
- 変更が必要な場合は旧ロケを論理削除し、新ロケを新規作成する運用
- DB制約：アプリ側で変更不可制御（DB トリガーは不要）

---

### QA-8：在庫移動は自由実行・承認制にしない

**確定：自由実行・履歴のみ残す**

ロケ間の在庫移動（棚移動・エリア移動）は承認不要で自由に実行できる。

- 承認フロー不要（AU-1 の承認対象外）
- 移動履歴は `inventory_movements` テーブルに自動記録
- 誤移動の発見は棚卸（工程11）で検出

---

### QA-13：機能ON/OFF概念は廃案

**確定：廃案**

「機能のON/OFF」という管理概念（I-1〜I-7）は廃案。  
代わりに「各データ項目を登録するか/しないか」のシンプル運用に切り替え。

- **廃案となる機能**：I-1（機能マスタ）・I-2（ON/OFF設定画面）・I-3（依存チェック）・I-4（動的メニュー）・I-5（API アクセス制御）・I-6（ON/OFF 履歴）・I-7（ピッキングエリア ON/OFF）
- **代替方針**：各マスタ（owners / skus 等）に「〇〇を使用するか」のフラグを持つ設計（例：`lot_required`・`serial_required`）。これを「登録するか/しないか」の判断として扱う
- CLAUDE.md の I セクション・E-5 も廃案として更新済み

---

### QA-9（再確定）：調整理由コードはマスタ管理・選択式

**確定：方式B（選択式コード）2026-05-17 再確定**

在庫調整の理由入力は「調整理由コード（選択式）」を採用する。

- `adjustment_reason_codes` テーブルを新規作成・工程12 マスタ管理画面で運用
- デフォルト項目（破損／紛失／数え誤り／盗難 等）を事前登録
- マスタ画面で荷主管理者が追加・変更可能（`is_active` で非表示も可）
- 荷主共通コード（`owner_id = NULL`）と荷主固有コード（`owner_id` 指定）の両方をサポート
- コード選択に加えて補足欄（フリーテキスト・任意）を `inventory_adjustments.supplement_note` に格納

```sql
CREATE TABLE adjustment_reason_codes (
  id          BIGSERIAL PRIMARY KEY,
  owner_id    BIGINT REFERENCES owners(id),      -- NULL の場合は全荷主共通
  code        TEXT NOT NULL,                      -- 例: 'damage', 'loss', 'miscount'
  label       TEXT NOT NULL,                      -- 表示名：破損／紛失／数え誤り 等
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, code)
);

-- デフォルトデータ（owner_id = NULL = 全荷主共通）
INSERT INTO adjustment_reason_codes (owner_id, code, label, sort_order) VALUES
  (NULL, 'damage',    '破損',       1),
  (NULL, 'loss',      '紛失',       2),
  (NULL, 'miscount',  '数え誤り',   3),
  (NULL, 'theft',     '盗難',       4),
  (NULL, 'expiry',    '期限切れ',   5),
  (NULL, 'error_in',  '誤入庫',     6),
  (NULL, 'error_out', '誤出庫',     7),
  (NULL, 'other',     'その他',     99);
```

※ 経緯：3号ヒアリング（2026-05-16）では方式A（コードなし・備考欄のみ）で確定。実装フェーズ（2026-05-17）で時吉さんが方式B（選択式コード）に再確定。wms-impl 2号プロトは方式B で実装済み。

---

### Q12-4：ユーザー招待フローは2系統（標準＋HT現場向け例外）

**確定：2系統実装（2026-05-17 3号ヒアリング確定）**

ユーザー追加フローは荷主ユーザー（一般）と HT 現場担当者（メール不使用）で分岐する。

- **標準フロー**：メール招待（`admin.inviteUserByEmail()`）→ ユーザー承認 → 管理者が権限付与（段階的フロー）
- **例外フロー**：管理者が直接アカウント作成（`admin.createUser()`）→ ユーザーID＋初期パスワードを手渡し → 初回ログイン時にパスワード変更強制
- `user_metadata.password_change_required = true` で初回変更強制を管理
- 招待と権限付与は段階的（承認後に管理者が `user_owners` を手動 INSERT）

詳細：U-3 セクション参照。

---

### Q12-5：請求単位は unit_master テーブルに移行・8単位を初期登録

**確定：unit_master テーブル化（2026-05-17 3号ヒアリング確定）**

`billing_rules.unit` を enum（CHECK 制約）から `unit_master` テーブルへの FK 参照に変更。

- **既存4単位（継続）**：`case` / `piece` / `tsubo` / `sqm`
- **今回追加4単位**：`hour`（時間）/ `kg`（重量）/ `cbm`（立米m3）/ `truckload`（車建）
- `unit_master` テーブル新設により管理画面から単位追加可能（マイグレーション不要）
- `billing_rules.unit` の CHECK 制約を削除し `unit_master.unit_code` への FK に切り替え

詳細：B-5 セクション参照。

---

### QA-16：時給情報等のロール別表示は権限マスターで設定可能

**確定：権限マスターで設定**

従業員の時給情報・労務コスト情報は、ロール（役割）によって閲覧・編集権限を制御する。

- `user_owners.role` の `wms_admin` / `admin` / `operator` 等で制御
- 時給情報（K-1 従業員マスタ）の閲覧は `admin` 以上のみ
- 詳細権限定義は T-1〜T-4 セクション（CLAUDE.md）に定義済み
- DB実装：RLS ポリシーではなくアプリ側ロール確認で制御（シンプル運用）

---

---

## 11. Phase 9 本番 TODO（2号 verify 判明事項）

> 出典：#932 / kurokun_memo#274（Phase 9 本番実装で必ず対応すべき事項として2号 verify で判明）
> 追記：2026-05-17 / Phase 9-TODO-REC さーちゃん（#936）

### R-7①：ロール名統一（プロトタイプ → 本番 Supabase）

**Phase 9 本番 TODO：本番 Supabase 実装時に AU-1 確定ロール名に統一すること**

| 実装状況 | ロール名 |
|----------|---------|
| wms-impl 2号プロトタイプ | `admin / leader / worker / owner_user` |
| **AU-1 確定（3号ヒアリング）** | **`admin / operator / viewer / shipper`** |

対応方針：

- 本番 Supabase の `user_owners.role` CHECK 制約は AU-1 確定名（`admin / operator / viewer / shipper`）で実装すること（現行 process_12 スキーマはすでに確定名）
- プロトのロール対応例：`leader` → `operator`、`worker` → `viewer` または `operator`、`owner_user` → `shipper`
- プロトタイプデータをシードとして使う場合はロール名変換スクリプトを用意すること
- RLS ポリシー内のロール名文字列も AU-1 確定名に統一する（特に `'admin'` 判定ロジックは変更なし）
- 参照：HEARING_SHEET AU-1 / process_12 セクション3 user_owners 論点

---

### R-7②：`discrepancy.approve` を admin only に制限

**Phase 9 本番 TODO：入荷差異の最終アクションを admin ロール専用に実装すること**

- wms-impl 2号プロトタイプでは `leader` ロールも差異承認アクション（`discrepancy.approve`）を実行可能
- **QA-10 確定（3号ヒアリング 2026-05-16）：入荷差異の最終アクション選択権は倉庫管理者（admin）ロールが持つ**
- 本番実装では入荷差異処理 API/UI の権限チェックを `admin` のみに制限すること
- 具体的には：`user_owners.role = 'admin'` の場合のみ差異最終アクション（実数受入・再検品要求・仕入先クレーム）の確定操作を許可する
- 参照：HEARING_SHEET QA-10

---

*最終更新：2026-05-09 / Phase 9-β さーちゃん（工程12 マスタ管理論点叩き台）*  
*プレースホルダ追加：2026-05-16 / Phase 9-DOC-PREP さーちゃん（#913）*  
*Q12-1 確定反映：2026-05-16 / Phase 9-REFLECT-Q12 さーちゃん（#916）*  
*QA-9 方式B 再確定反映：2026-05-17 / Phase 9-V-FIX-R5 さーちゃん（#931）*  
*QA確定事項追記：2026-05-16 / Phase 9-REFLECT2-D にーちゃん（#925）*  
*Phase 9 本番 TODO 追記：2026-05-17 / Phase 9-TODO-REC さーちゃん（#936）*  
*Q12-4/Q12-5 確定反映：2026-05-17 / Phase 9-H1R-C にーちゃん（#940）*  
*U-3 jan_strict_mode修正・U-4 unit_master スキーマ更新：2026-05-17 / Phase 9-V-PHASED-FIX さーちゃん（#954）*
