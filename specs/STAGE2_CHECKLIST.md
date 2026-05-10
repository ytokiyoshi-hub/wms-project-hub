# Phase 9 Stage2 着手前チェックリスト

> 作成日：2026-05-10
> 作成者：まーちゃんクローン（id=8）/ Phase 9-DOC3
> 対応 TODO：id=836
> 目的：Stage1→Stage2 依存関係を確認し、Stage2 着手可否を判定する

---

## 1. Stage1 完了状況（2026-05-10 時点）

### 1-1. Stage1 タスク別完了状況

| Stage1 項目 | Todo ID | ステータス | 成果物 | 備考 |
|---|---|---|---|---|
| **DB-4** 荷主切替 owner_id RLS 設計 | #370 / #392 | ✅ completed + verified | `sql/phase9_stage1_rls.sql`（272行） | commit: 2dc528e |
| **DB-4やり直し** | #828 | ⏳ in_progress | — | さーちゃん(5)作業中 |
| **AU-2** skus テーブル SQL | #821 | ✅ completed + verified | `sql/phase9_stage1_skus.sql` | commit: e1d789 |
| **AU-1** users/user_owners + RLS | #818 | ✅ completed + verified | `sql/phase9_stage1_auth.sql` | commit: 2085952 |

### 1-2. Stage1 DB 適用状況（本番 wqjsemttubzbpauvgyai）

| ファイル | 本番適用 | 確認ソース |
|---|---|---|
| `sql/phase9_stage1_foundation.sql` | ✅ 適用済み | #394 QA2 検証済み（owners/skus/user_owners 存在確認） |
| `sql/phase9_stage1_rls.sql` | ✅ 適用済み（RLS有効化） | #394 QA2 確認 / rowsecurity=true |
| `sql/phase9_stage1_auth.sql` | ✅ 適用済み | #818 completion_note |
| `sql/phase9_stage1_skus.sql` Section B | ⚠️ **未適用** | #394 QA2「jan→jan_code リネーム・unit カラム追加 未完了」 |

**⚠️ 重要：`phase9_stage1_skus.sql` の Section B（ALTER TABLE）が本番 DB に未適用。**
- `skus.jan` カラムが `jan_code` にリネームされていない
- `skus.unit` カラムが追加されていない
- Stage2 の `inventory` テーブルが `skus` を参照する場合、カラム名の不整合が生じる可能性あり

### 1-3. Stage1 SQL ファイル一覧

```
sql/
├── phase9_stage1_foundation.sql   # owners / skus / user_owners DDL
├── phase9_stage1_rls.sql          # 全テーブル RLS ポリシー（5テーブル × 2ポリシー）
├── phase9_stage1_auth.sql         # profiles / user_owners / handle_new_user trigger
├── phase9_stage1_skus.sql         # skus DDL + ALTER TABLE（Section B 本番未適用）
├── phase9_stage2_inventory.sql    # Stage2 DDL ドラフト（lots/serials/inventory）
├── phase9_stage2_tables_draft.sql # wms_staff / work_orders ドラフト
├── phase9_rls.sql                 # RLS 統合ファイル（Stage2含む）
├── phase9_rollback.sql            # ロールバック手順
└── phase9_seed_testdata.sql       # テストデータ
```

---

## 2. Stage2 着手ブロッカー

以下の条件が **全て解消されるまで Stage2 着手不可**。

### ブロッカー一覧

| # | ブロッカー | 種別 | 担当 | 解消条件 |
|---|---|---|---|---|
| **B1** | **Phase 9-J1 (#181) 未解決** — 致命傷ライン18項目の時吉さん判断が pending | 設計確定 | 時吉さん + くろくん | 時吉さんが MORNING_DECISION_SHEET.md に回答し pending → completed になること |
| **B2** | **Staging (olsaaxihtpxhfwksmdfv) が INACTIVE** | インフラ | こーちゃん or まーちゃん | `restore_project` で ACTIVE に戻し、Stage1 migration が staging で動作すること |
| **B3** | **#828 Phase 9-DB4やり直し** が in_progress | 設計整合 | さーちゃん(5) | completed + verified になること（DB4 最終版が確定してから Stage2 に owner_id 設計を適用） |
| **B4** | **`phase9_stage1_skus.sql` Section B 未適用** — jan→jan_code リネーム・unit 未追加 | DB整合 | さーちゃん(5) | 本番 DB の skus テーブルが最新スキーマになること |

### ブロッカーの優先順位

```
B1（時吉さん判断）→ B3（DB4やり直し完了）→ B4（skus Section B apply）→ B2（staging ACTIVE化）
```

> B1 が全体着手の大前提。B2〜B4 は B1 待ちの間に並行解消が望ましい。

---

## 3. Stage1 → Stage2 依存関係チェック

PHASE9_IMPLEMENTATION_PLAN.md の依存グラフより：

```
DB4（荷主切替）→ DB1 / DB2 / DB3 / DB5
```

Stage2 の全項目（DB-5, DB-2, DB-3, DB-1）は DB-4 のみに依存。
DB-4 は ✅ completed（#370/#392）であるため、**依存関係上の制約は解消済み**。

| Stage2 項目 | 依存 Stage1 項目 | 依存解消 | 補足 |
|---|---|---|---|
| DB-5（locations）| DB-4 | ✅ | DB-4 確定版で owner_id の型確認必要 |
| DB-2（lots）| DB-4 | ✅ | 同上 |
| DB-3（serials）| DB-4 | ✅ | 同上 |
| DB-1（inventory）| DB-4 | ✅ | skus.jan_code との整合（B4解消後） |

---

## 4. Stage2 着手可否判定

### 現時点（2026-05-10）の判定

**❌ 着手不可**

理由：
- B1（Phase 9-J1 pending）: 時吉さんの致命傷ライン判断が出ていない。DB-4 設計が覆る可能性があり、Stage2 全テーブルの owner_id FK 設計が変わり得る。
- B3（#828 in_progress）: DB4 の最終確定版が出ていない。
- B4（skus Section B 未適用）: inventory が skus を FK 参照する際にカラム名不整合リスク。

### 着手 GO サイン（全て ✅ になったら着手可）

```
[ ] Phase 9-J1 (#181) → completed（時吉さん判断完了）
[ ] #828 Phase 9-DB4やり直し → completed + verified
[ ] phase9_stage1_skus.sql Section B 本番 apply 完了
[ ] Staging (olsaaxihtpxhfwksmdfv) → ACTIVE
[ ] Phase 9-QA2 (#394) ✅ 済み（Stage1 本番 DB 整合確認）
```

---

## 5. Stage2 着手時のタスク分解案（GO 後に起票）

### 5-1. さーちゃん（DB 専任・id=5）担当

| # | タスク | 内容 | 工数 | 依存 |
|---|---|---|---|---|
| S2-α | DB-5 locations staging apply | `phase9_stage2_inventory.sql` の locations セクションを staging に apply + 確認 | 1日 | GO全件 |
| S2-β | DB-2/DB-3 lots/serials staging apply | 同ファイルの lots/serials セクション apply + 確認 | 1日 | S2-α |
| S2-γ | DB-1 inventory staging apply | inventory（4軸 UNIQUE）apply + skus FK 確認 | 1日 | S2-β |
| S2-δ | Stage2 本番 apply | staging 検証完了後に本番 apply（snapshot 取得後） | 1日 | S2-γ + にーちゃん E2E |
| S2-ε | Stage2 RLS apply | `phase9_rls.sql` の Stage2 分ポリシー apply | 1日 | S2-δ |

### 5-2. にーちゃん（QA 専任・id=7）担当

| # | タスク | 内容 | 工数 | 依存 |
|---|---|---|---|---|
| S2-i | Stage2 staging E2E 検証 | locations/lots/serials/inventory が DDL・FK・インデックス通りに存在するか検証 | 1日 | S2-β〜S2-γ |
| S2-ii | Stage2 業務シナリオ検証 | 入荷→ロット付与→棚入れ→在庫照会 の最小シナリオを staging で実行 | 2日 | S2-i + seed データ投入 |
| S2-iii | Stage2 RLS E2E | owner 切替で inventory が正しく分離されるか検証 | 1日 | S2-ε |

### 5-3. こーちゃん（PM 兼実装・id=2）担当

| # | タスク | 内容 | 工数 | 依存 |
|---|---|---|---|---|
| S2-1 | Stage2 seed データ作成 | `phase9_seed_testdata.sql` に Stage2 用 locations/lots/serials テストデータ追加 | 0.5日 | S2-α |
| S2-2 | Stage2 分岐ブランチ作成 | `feature/phase9-stage2` ブランチ切り出し・PR 準備 | 0.5日 | GO全件 |

---

## 6. Stage2 SQL ファイル確認（着手前チェック）

着手前に以下を実行して SQL ファイルと本番 DB の整合を確認すること。

```sql
-- Stage1 テーブル確認（3件あること）
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('owners', 'skus', 'user_owners')
ORDER BY table_name;

-- skus カラム確認（jan_code が存在し unit が存在すること）
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'skus'
ORDER BY ordinal_position;

-- Stage2 テーブルがまだ存在しないことを確認（0件）
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('locations', 'lots', 'serials', 'inventory')
ORDER BY table_name;

-- RLS 有効化確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('owners', 'skus', 'user_owners');
```

---

## 7. 関連ファイル

| ファイル | 説明 |
|---|---|
| `specs/PHASE9_IMPLEMENTATION_PLAN.md` | Stage1〜4 全体計画・依存関係図 |
| `specs/MORNING_DECISION_SHEET.md` | 致命傷ライン18項目判断シート（Phase 9-J1） |
| `docs/phase9-stage1-readiness.md` | Stage1 着手準備チェックリスト（こーちゃん作成） |
| `docs/staging-precheck-20260510.md` | staging 事前確認結果（さーちゃん作成） |
| `sql/phase9_stage1_foundation.sql` | Stage1 DDL（owners/skus/user_owners） |
| `sql/phase9_stage2_inventory.sql` | Stage2 DDL ドラフト（locations/lots/serials/inventory） |
| `sql/phase9_rls.sql` | 全 Stage RLS ポリシー統合ファイル |
| `sql/PHASE9_RISK_REPORT.md` | リスク分析（さーちゃん作成） |

---

## 8. まーちゃんへの申し送り

### 即アクション（今すぐ起票が必要）

1. **staging restore タスク**（こーちゃん担当・B2解消）
   - 内容：`restore_project` で olsaaxihtpxhfwksmdfv を ACTIVE に戻す
   - 優先度：high

2. **skus Section B apply タスク**（さーちゃん担当・B4解消）
   - 内容：`phase9_stage1_skus.sql` Section B を本番 DB に apply（jan→jan_code リネーム + unit カラム追加）
   - 優先度：high
   - 注意：#828 完了後に実施（DB4やり直しの影響確認が先）

### 待ちアクション

3. **Phase 9-J1 (#181)**：時吉さんへの致命傷ライン判断の催促（B1解消）
   - 時吉さんが MORNING_DECISION_SHEET.md に回答後、Stage2 GO 判断

### Stage2 GO 後に即起票

全ブロッカー解消後、セクション5のタスク分解案を参照してさーちゃん・にーちゃん・こーちゃんへ一括起票する。

---

*作成：まーちゃんクローン（id=8）/ 2026-05-10 / Phase 9-DOC3 (#836)*
