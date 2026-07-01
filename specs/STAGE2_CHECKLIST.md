# Phase 9 Stage2 着手前チェックリスト

> 作成日：2026-05-10
> 作成者：まーちゃんクローン（id=8）/ Phase 9-DOC3
> 対応 TODO：id=836
> 目的：Stage1→Stage2 依存関係を確認し、Stage2 着手可否を判定する

---

## 【2026-07-01 更新】Phase 9-DOC3 #1119 — 現況再確認チェックリスト

> 更新日：2026-07-01
> 更新者：まーちゃん（id=8）/ Phase 9-DOC3 #1119
> 目的：2026-07-01 時点の todo DB 実態（244件）をもとに Stage1 完了状態を再確認し、着手可否を再判定する

### A. Stage 1 完了確認リスト（2026-07-01 時点）

#### A-1. Stage 1 コアタスク（必須 3 項目）

| タスクID（代表） | タイトル | DB ステータス | 判定 | 備考 |
|---|---|---|---|---|
| #370 / #828 / #1095 | Phase 9-DB4: 荷主切替 owner_id RLS 設計・SQL 作成 | completed（最新 #1095） | ✅ | 後続 #1112 は failed だが代替完了済み |
| #818 / #1027 / #1096 | Phase 9-AU1: users/user_owners テーブル + RLS ポリシー雛形 SQL 作成 | completed（最新 #1096） | ✅ | 3件すべて completed |
| #393 / #821 / #1089 / #1114 | Phase 9-AU2: skus テーブル SQL 作成（owner_id × sku_code × jan UNIQUE） | completed（最新 #1114） | ⚠️ | #1092/#1109/#1110 が failed。#1114 で代替完了済み |

#### A-2. Stage 1 補完・修正タスク

| タスクID | タイトル | DB ステータス | 判定 | 備考 |
|---|---|---|---|---|
| #875 | Phase 9-AU2fix: skus テーブル補完（jan→jan_code リネーム・unit 追加） | completed | ✅ | skus スキーマ最終形完成 |
| #899 | Phase 9-FIXSEC: RLS ポリシー欠落の修正（DB-4 荷主分離違反・7 テーブル） | completed | ✅ | セキュリティ修正完了 |

#### A-3. Stage 1 検証タスク

| タスクID | タイトル | DB ステータス | 判定 |
|---|---|---|---|
| #394 / #1007 / #1013 | Phase 9-QA2: Stage1 DB migration 検証 | completed | ✅ |
| #832 / #1021 / #1088 | Phase 9-QA4: 荷主切替 RLS 検証シナリオ作成 | completed | ✅ |
| #395 | Phase 9-DOC1: Stage1 完了確認・進捗サマリー作成 | completed | ✅ |

#### A-4. Stage 1 タスクステータスサマリー（2026-07-01）

| 分類 | completed | failed | in_progress |
|---|---|---|---|
| DB-4（荷主切替 owner_id RLS） | 9件 | 1件（#1112） | 0件 |
| AU-1（users/user_owners テーブル） | 3件 | 0件 | 0件 |
| AU-2（skus テーブル） | 7件 | 3件（#1092/#1109/#1110） | 0件 |
| Stage1 QA・検証 | 6件 | 0件 | 0件 |

### B. 依存関係サマリー

PHASE9_IMPLEMENTATION_PLAN.md の flowchart より：

| Stage 2 タスク | 依存 Stage 1 項目 | 依存完了状態 |
|---|---|---|
| DB-5: locations テーブル | DB-4（owner_id 方針） | ✅ 完了 |
| DB-2: lots テーブル | DB-4（owner_id 方針） | ✅ 完了 |
| DB-3: serials テーブル | DB-4（owner_id 方針） | ✅ 完了 |
| DB-1: inventory（4 軸 UNIQUE） | DB-4 + AU-2（skus） | ✅ 完了 |

### C. 未完了・未確認の課題一覧（2026-07-01）

#### C-1. failed タスク（Stage 1 関連）

| タスクID | タイトル | ステータス | 影響度 | 対処方針 |
|---|---|---|---|---|
| #1092 | Phase 9-AU2: skus テーブル SQL 作成 | failed | 低 | #1114 で代替完了済み。クローズ可 |
| #1109 | Phase 9-AU2: skus テーブル SQL 作成 | failed | 低 | 同上。クローズ可 |
| #1110 | Phase 9-AU2: skus テーブル SQL 作成 | failed | 低 | 同上。クローズ可 |
| #1112 | Phase 9-DB4: 荷主切替 owner_id RLS 設計・SQL 作成 | failed | 低 | #1095 で代替完了済み。クローズ可 |

#### C-2. in_progress / failed タスク（Stage 4 関連・非ブロッカー）

| タスクID | タイトル | ステータス | Stage 2 ブロック？ |
|---|---|---|---|
| #1115 | Phase 9-DB5: locations テーブル SQL 設計 | in_progress | ⚠️ Stage 2 内タスクそのもの（別インスタンスは completed） |
| #1117 | Phase 9-QA5: 請求・コスト計算シナリオ作成 | in_progress | 非ブロック（Stage 4 前提） |
| #1118 | Phase 9-QA6: HT バーコードスキャン検証シナリオ作成 | failed | 非ブロック（Stage 4 前提） |

### D. Stage 2 着手可否判定（2026-07-01）

**判定：CONDITIONAL-GO（実質 GO）**

| 確認項目 | 状態 | 判定 |
|---|---|---|
| DB-4 owner_id 方針確定（全テーブルの前提） | completed（#1095 等） | ✅ |
| AU-1 RLS ポリシー雛形完成 | completed（#1096） | ✅ |
| AU-2 skus テーブル完成 | completed（#1114）、failed 3件は代替完了 | ✅ |
| Stage 1 QA2 migration 検証 PASS | completed（#1013 等） | ✅ |
| Stage 1 QA4 RLS 検証 PASS | completed（#1088 等） | ✅ |
| Stage 1 セキュリティ修正完了 | completed（#899） | ✅ |
| QA7 Stage 3-4 統合検証 PASS | completed（#898） | ✅（Stage 4 まで到達済み）|

**PHASE9_IMPLEMENTATION_PLAN.md の記録では「Stage 1〜4 全ステージ完了・QA7統合検証PASS（2026-05-16）」とあり、Stage 2 はすでに完了している。**
failed タスクはすべて「同一目的の後続タスクが completed」であり、実質的なアウトプットに欠落はない。

### E. 推奨アクション（2026-07-01）

| 優先度 | アクション | 担当 |
|---|---|---|
| 高 | #1115（DB-5 locations SQL: in_progress）の完了確認とクローズ | さーちゃん(5) |
| 高 | failed タスク #1092/#1109/#1110/#1112 を cancelled でクローズ（代替完了済み） | まーちゃん → さーちゃん |
| 中 | #1117（QA5: in_progress）の完了促進 | にーちゃん(7) |
| 中 | #1118（QA6: failed）の再起票（Stage 4 LK-2 前提） | まーちゃん → 新規起票 |
| 低 | timeout タスク #1106/#1107/#1108 の再起票要否を時吉さんと確認 | まーちゃん |

---

---

## 1. Stage1〜4 完了状況（2026-05-16 更新）

### 1-1. Stage1 タスク別完了状況

| Stage1 項目 | Todo ID | ステータス | 成果物 | 備考 |
|---|---|---|---|---|
| **DB-4** 荷主切替 owner_id RLS 設計 | #370 / #392 | ✅ completed + verified | `sql/phase9_stage1_rls.sql`（272行） | commit: 2dc528e |
| **DB-4やり直し** | #828 | ✅ completed + verified | RLS最終確定版 | Phase 9-FIXSEC/FIXSEC3で完成 |
| **AU-2** skus テーブル SQL | #821 | ✅ completed + verified | `sql/phase9_stage1_skus.sql` | commit: e1d789 |
| **AU-1** users/user_owners + RLS | #818 | ✅ completed + verified | `sql/phase9_stage1_auth.sql` | commit: 2085952 |

### 1-2. Stage1 DB 適用状況（本番 wqjsemttubzbpauvgyai）

| ファイル | 本番適用 | 確認ソース |
|---|---|---|
| `sql/phase9_stage1_foundation.sql` | ✅ 適用済み | #394 QA2 検証済み（owners/skus/user_owners 存在確認） |
| `sql/phase9_stage1_rls.sql` | ✅ 適用済み（RLS有効化） | #394 QA2 確認 / rowsecurity=true |
| `sql/phase9_stage1_auth.sql` | ✅ 適用済み | #818 completion_note |
| `sql/phase9_stage1_skus.sql` Section B | ✅ 適用済み | #875 Phase 9-AU2fix（jan→jan_code リネーム・unit 追加 完了）|

✅ 全 Stage1 SQL が本番 DB に適用済み（2026-05-16 確認）。

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

| # | ブロッカー | 種別 | 担当 | 解消状況 |
|---|---|---|---|---|
| **B1** | Phase 9-J1 (#181) 致命傷ライン18項目の時吉さん判断 | 設計確定 | 時吉さん + くろくん | ✅ 解消（2026-05-14 全確定） |
| **B2** | Staging (olsaaxihtpxhfwksmdfv) が INACTIVE | インフラ | こーちゃん or まーちゃん | ✅ 解消（ACTIVE 化済み） |
| **B3** | #828 Phase 9-DB4やり直し が in_progress | 設計整合 | さーちゃん(5) | ✅ 解消（Phase 9-FIXSEC/FIXSEC3 完了） |
| **B4** | `phase9_stage1_skus.sql` Section B 未適用 | DB整合 | さーちゃん(5) | ✅ 解消（#875 Phase 9-AU2fix 完了） |

> ✅ 全ブロッカー解消済み（2026-05-16 確認）。

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

## 4. Stage2〜4 完了状況（2026-05-16 更新）

### 現時点（2026-05-16）の判定

**✅ Stage 2〜4 全て完了・QA7統合検証PASS**

| Stage | 内容 | 完了日 | 主要タスク |
|-------|------|--------|-----------|
| Stage 2 | 在庫モデル（DB-5/2/3/1） | 2026-05-16 | #887/#878/#875/#877 |
| Stage 3 | 業務フロー（BF-2/3/4） | 2026-05-16 | #889/#891/#882 |
| Stage 4 | 計算・連携（CA-1/2/LK-1/2） | 2026-05-16 | #883/#888/#881/#890/#895 |
| QA7統合 | Stage 3-4 引当・請求・原価・RLS分離 | 2026-05-16 | #898（全PASS） |

### 着手 GO サイン（全て ✅ 解消済み）

```
[x] Phase 9-J1 (#181) → completed（2026-05-14 時吉さん判断完了）
[x] #828 Phase 9-DB4やり直し → completed + verified
[x] phase9_stage1_skus.sql Section B 本番 apply 完了（#875）
[x] Staging (olsaaxihtpxhfwksmdfv) → ACTIVE
[x] Phase 9-QA2 (#394) ✅ 済み（Stage1 本番 DB 整合確認）
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
*最終更新：にーちゃん(id=7) / 2026-05-16 / Phase 9-DOC-UPDATE (#912) — Stage 1-4 完了・全ブロッカー解消・QA7統合検証PASS反映*
