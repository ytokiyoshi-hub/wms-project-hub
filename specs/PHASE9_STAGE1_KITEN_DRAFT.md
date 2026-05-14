# Phase 9 Stage 1 起票ドラフト（shacho-shitsu todos 登録用）

> 起票元：2026-05-14 / 時吉さん「全て任せます」を受けた致命傷ライン18項目確定後の最初の実装タスク
> 復元ポイント：`restore-point-2026-05-14`
> 着手条件：致命傷ライン18項目確定 ✅ / 5体runner active ✅ / Phase 8-G ✅

---

## Stage 1 概要

| 項目 | 内容 |
|------|------|
| Stage | 1（基盤）|
| 対象 | DB-4 / AU-1 / AU-2 |
| 工数 | 9人日（5体並列なら実営業日 2〜3日）|
| 前提 | Stage 2〜4 全テーブルの前提となる **owner_id + RLS** を確立 |
| ゴール | Supabase に新スキーマ反映 → staging で RLS isolation テスト pass |

---

## 起票カード 3枚（さーちゃん向け・分割推奨）

### 依頼カード #1：DB-4 RLS 基盤（3人日）

```
──────── 依頼カード ────────
タイトル：Phase 9 Stage 1-1 / DB-4 Supabase RLS ポリシー設計＋owner_id 全テーブル付与方針
要件：
  1. Supabase 上で `owner_id BIGINT NOT NULL` を全業務テーブルに必須化する migration を作成
  2. RLS ポリシー雛形：`policy = current_user has access to owner_id`
  3. specs/MIGRATION_DRAFT.sql を最新化（DB-4=B 論理分離+RLS で確定）
  4. staging に適用 → `specs/test_rls_isolation.md` のテストケースを全て pass させる
  5. 完了後 schedules.id=10（工程3 / DB設計）の review_status='review_completed' に更新
推奨 assigned_to：さーちゃん
verification_method：staging DB照合 + RLS isolation テスト pass
estimated_minutes：1440（3人日 × 8h）
背景：致命傷ライン DB-4 確定（B：論理分離+RLS）。Stage 2 以降の全テーブル設計の前提。
参照：
  - specs/process_03_db_design.md（DB-4 確定内容）
  - specs/MIGRATION_DRAFT.sql（雛形）
  - specs/test_rls_isolation.md（受入テスト）
────────────────────────────
```

### 依頼カード #2：AU-2 skus テーブル（2人日）

```
──────── 依頼カード ────────
タイトル：Phase 9 Stage 1-2 / AU-2 skus テーブル実装（owner_id × sku_code × jan UNIQUE）
要件：
  1. skus テーブル作成：(id BIGINT PK, owner_id BIGINT, sku_code TEXT, jan TEXT, serial_required BOOL, lot_required BOOL, ...)
  2. UNIQUE 制約：(owner_id, sku_code) と (owner_id, jan)
  3. RLS ポリシー適用（カード#1 のポリシー雛形を継承）
  4. seed データ投入（マルキ食品ベースシナリオ × 数十SKU）
  5. specs/process_02_system_design.md AU-2 セクションと整合確認
推奨 assigned_to：さーちゃん（依頼カード#1 完了後）
verification_method：staging で SELECT * FROM skus による確認 + UNIQUE 制約バリデーション
estimated_minutes：960（2人日）
背景：致命傷ライン AU-2 確定（D：荷主×内部SKU+JAN）。LK-2（HTバーコード）の前提でもある。
────────────────────────────
```

### 依頼カード #3：AU-1 users / user_owners + RLS（4人日）

```
──────── 依頼カード ────────
タイトル：Phase 9 Stage 1-3 / AU-1 users・user_owners テーブル＋RLS ポリシー雛形
要件：
  1. users テーブル：Supabase Auth と連動する形で拡張カラム（role 種別、表示名 等）
  2. user_owners 中間テーブル：(user_id, owner_id, role, granted_at, granted_by)
  3. role enum：admin / operator / viewer / shipper
  4. RLS ポリシー：current_user の user_owners 行に基づき owner_id をフィルタ
  5. 承認フロー基盤：approval_required フラグの設計を specs に追記
  6. staging で「ユーザーA=荷主1のみ閲覧可」「ユーザーB=全荷主 admin」のテストケース pass
推奨 assigned_to：さーちゃん（依頼カード#1, #2 完了後）
verification_method：staging RLS isolation テスト + 承認フロー結合テスト
estimated_minutes：1920（4人日）
背景：致命傷ライン AU-1 確定（B：荷主×ロール+RLS）。DB-4 と RLS ポリシーを共有。
────────────────────────────
```

---

## 起票後のフロー（shacho-shitsu 経由）

1. まーちゃんが本ドラフトを参考に shacho-shitsu の todos へ3件起票
2. くろくん（副社長）が承認 or 修正依頼
3. claude-runner.sh がさーちゃん runner を起動 → 実装
4. 実装完了 → まーちゃんが staging 検証 → verified_by_kurokun=true
5. Stage 1 全カード完了で Stage 2 起票（在庫モデル：DB-1 / DB-2 / DB-3 / DB-5）

---

## Stage 1 完了の判定条件（DoD）

- [ ] Supabase staging に owner_id 必須・RLS 有効化された全テーブル雛形が反映
- [ ] skus / users / user_owners の 3 テーブルが本番想定スキーマで作成
- [ ] `specs/test_rls_isolation.md` の全シナリオが staging で pass
- [ ] specs/MIGRATION_DRAFT.sql が最新化・本番投入可能な状態
- [ ] Stage 2 起票準備（DB-1 / DB-2 / DB-3 / DB-5 の依頼カード起票）

---

## 時吉さんへの確認は不要

判断シート確定済みのため、Stage 1 はまーちゃんの起票 → くろくんの承認 → さーちゃんの実装で自走する。
時吉さんへは Stage 1 完了時に staging 動作確認のお願いだけ行う。
