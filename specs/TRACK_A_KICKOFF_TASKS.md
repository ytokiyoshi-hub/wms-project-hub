# Track A 起票タスクプラン — wms-test2 本番品質進化 MVP（1-2週）

最終更新: 2026-05-28（v2: Express維持版に修正） / 作成: 1号（まーちゃん）  
親計画: `specs/WMS_TEST2_EVOLUTION_PLAN.md`

---

## 目的

**MVPフェーズ（1-2週）** の作業をこーちゃん(id=2) 向けに粒度細かく分解し、Supabase `todos` テーブルに起票可能な形にする。

**MVPの定義**:
- wms-test2 を **Express+SQLite → Express+Supabase Postgres** に移行
- **Supabase Auth + RLS** で認証・RLS分離を有効化
- **Vercel 等で公開** → 新URL で時吉さんが触れる
- 既存19シナリオ + 1年BULK 21k件 で本番品質検証 PASS

**重要**:
- フロント（HTML/CSS/JS 482画面）は**そのまま維持** → React化はベータ以降
- wms-test2 内に既存の Phase 9 移行コード（migrations + adapters）を活用

---

## タスク一覧

### A1. Supabase プロジェクト準備

| 項目 | 内容 |
|---|---|
| assigned_to | 2（こーちゃん） |
| 想定工数 | 0.5日 |
| 依存 | なし（起点） |
| serial_ok | 不可 |

**実装内容**:
- Supabase 新規プロジェクト作成（プロジェクト名: `marki-wms-mvp`）
- リージョン: `ap-northeast-1` (Tokyo)
- 環境変数取得（`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`）
- wms-test2 の `.env` に追加（`.env.example` も更新）
- `@supabase/supabase-js` を package.json に追加

**完了条件**:
- `supabase status` でプロジェクトが confirmed
- `.env` 設定で adapters/supabase-adapter.js が import エラーなく起動

---

### A2. DB マイグレーション適用

| 項目 | 内容 |
|---|---|
| assigned_to | 5（さーちゃん） |
| 想定工数 | 0.5日 |
| 依存 | A1 |
| serial_ok | 可 |

**実装内容**:
- `migrations/001_initial_schema.sql`（671行・45テーブル）を Supabase に適用
- `migrations/002_rls_policies.sql`（300行・RLS policy）を適用
- `migrations/003_seed_test_users.sql`（201行・7 actor 投入）を適用
- 検証クエリ実行:
  - `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` → 45以上
  - `SELECT count(*) FROM pg_policies;` → RLS policy 投入確認
  - `SELECT email FROM auth.users LIMIT 10;` → 7 actor 確認

**重要**:
- メモにある「migration適用はMCPセッションから」を遵守
- まーちゃんが承認を得てから、さーちゃんがMCPセッション経由で実施

**完了条件**:
- 全テーブルが Supabase に存在
- RLS policy が有効化されている
- 7 actor の auth.users が投入済み

---

### A3. data-bulk-generator で 1年BULK 投入

| 項目 | 内容 |
|---|---|
| assigned_to | 2（こーちゃん） |
| 想定工数 | 0.5日 |
| 依存 | A2 |
| serial_ok | 可 |

**実装内容**:
- `test-runner/lib/data-bulk-generator.js` を Supabase 対応に修正（adapter経由）
- 1年BULK 投入実行（21k件SO + 6.3k件入荷）
- 投入後の DB サイズ確認
- 性能ベースライン取得（SELECT処理時間など）

**完了条件**:
- `SELECT count(*) FROM shipment_orders;` → 21,000+ 件
- `SELECT count(*) FROM inbound_schedules;` → 6,300+ 件
- 性能ベースライン記録（次のA8で SLA 検証用）

---

### A4. adapter 切替（SQLite → Supabase）

| 項目 | 内容 |
|---|---|
| assigned_to | 2（こーちゃん） |
| 想定工数 | 1.5日 |
| 依存 | A2 |
| serial_ok | 可 |

**実装内容**:
- `server/adapters/supabase-adapter.js` の雛形を完成させる（postgres-js 統合）
- `server/adapters/index.js` の factory を完成（`USE_SUPABASE` env 切替）
- `server/index.js` の SQLite 直叩き呼び出しを adapter経由に置換
  - 164エンドポイントを系統的に書き換え（テンプレ的に変換可能）
  - クエリの構文差（SQLite vs Postgres）を吸収
- ローカル動作確認: `USE_SUPABASE=true npm start` でエラーなく起動

**注意ポイント**（HANDOFF.mdより）:
- N+1 解消パターン（subquery → JOIN+GROUP BY）はそのまま流用可
- AUTOINCREMENT → BIGSERIAL
- `node:sqlite` 同期API → postgres-js 非同期API への変換が必要
- adapters 既存雛形が大部分の方針を示している

**完了条件**:
- `USE_SUPABASE=true npm start` で全エンドポイントがエラーなしに応答
- 主要API（owners, products, shipment_orders, picking_tasks）が正常返答

---

### A5. 認証統合（Supabase Auth）

| 項目 | 内容 |
|---|---|
| assigned_to | 2（こーちゃん） |
| 想定工数 | 1.5日 |
| 依存 | A4 |
| serial_ok | 可 |

**実装内容**:
- `?owner=` クエリ擬似フィルタ → Supabase Auth JWT に置換
- `test-runner/lib/actor-auth-map.js` を Supabase Auth API 呼び出しに修正
- server側に JWT 検証ミドルウェア追加:
  ```javascript
  app.use((req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    // Verify JWT, set req.user
    next();
  });
  ```
- session 注入: `SELECT set_config('request.jwt.claims', $1, true)` でRLS用
- フロント側のログイン画面 (`public/login.html` 等) を Supabase Auth UI に置換 or 既存ログインを SDK 経由に

**完了条件**:
- 7 actor で login → JWT 取得 → API 呼び出し が動作
- `?owner=` 不要で actor 自動フィルタが効く

---

### A6. RLS 検証 + 19シナリオ再走

| 項目 | 内容 |
|---|---|
| assigned_to | 7（にーちゃん）+ 2（こーちゃん修正対応） |
| 想定工数 | 1日 |
| 依存 | A5 |
| serial_ok | 可 |

**実装内容**:
- `test-runner/runner.js` を Supabase 対応に修正
  - シナリオの `?owner=` クエリ削除（RLSが自動フィルタ）
  - base URL を Supabase 環境向けに切替
- 全19シナリオを Supabase 環境で再実行
- 失敗があれば原因特定 → こーちゃんに修正起票

**重要シナリオ**:
- `scn-day-flow-001`: 1日業務貫通（11ステップ）
- `scn-core-outbound-001`: 出庫貫通（MVP対象フロー）
- `scn-rls-isolation-001`: RLS分離検証
- `scn-load-sla-001`: 性能SLA（1秒以内）

**完了条件**:
- 全19シナリオ PASS（flaky なし）
- RLS 分離が効くこと確認（mk-clerk が ap-clerk のデータ見えない）

---

### A7. Vercel デプロイ準備

| 項目 | 内容 |
|---|---|
| assigned_to | 2（こーちゃん） |
| 想定工数 | 1日 |
| 依存 | A4 |
| serial_ok | 可（A5, A6 と並列可） |

**実装内容**:
- Express を Vercel 互換に調整:
  - `api/[[...path]].js` で Express handler を serverless でラップ（`@vercel/node`）
  - or Vercel Edge Runtime 対応
- `vercel.json` 設定（routes / build / env）
- 静的ファイル（public/）の serve 設定
- 環境変数を Vercel に登録（`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `USE_SUPABASE=true`）
- preview デプロイ確認

**完了条件**:
- Vercel preview URL でアクセス → ログイン → 業務画面表示が動作

---

### A8. 公開 + MVP判定

| 項目 | 内容 |
|---|---|
| assigned_to | 2（こーちゃん）+ 1（まーちゃん判定） |
| 想定工数 | 0.5日 |
| 依存 | A6, A7 |
| serial_ok | 不可（最後のステップ） |

**実装内容**:
- Vercel production デプロイ
- カスタムドメイン or 仮ドメイン取得（例: `marki-wms.vercel.app`）
- HTTPS 確認
- 時吉さん用テストアカウント発行
- まーちゃんから時吉さんへ「新URL公開」連絡

**MVP判定条件**:
- 新URL から HTTPS でアクセス可能
- ログイン → 業務画面（特に出庫フロー）が動作
- 19シナリオ PASS 状態を維持
- 1年BULK データで性能 SLA クリア
- 時吉さんが触って「使用感」を判定（次の段階方針を決める）

---

## 依存関係グラフ

```
A1 (Supabase準備)
 ├─ A2 (migration適用) ─ A3 (BULK投入) ┐
 │                                      │
 └─ A4 (adapter切替) ─ A5 (認証統合) ─ A6 (19シナリオ再走)─┐
                  └─ A7 (Vercel準備) ─────────────────── A8 (公開+MVP判定)
```

---

## 工数集計

| タスク | 工数 | 担当 |
|---|---|---|
| A1: Supabase準備 | 0.5日 | こーちゃん |
| A2: migration適用 | 0.5日 | さーちゃん |
| A3: BULK投入 | 0.5日 | こーちゃん |
| A4: adapter切替 | 1.5日 | こーちゃん |
| A5: 認証統合 | 1.5日 | こーちゃん |
| A6: RLS+19シナリオ | 1日 | にーちゃん |
| A7: Vercel準備 | 1日 | こーちゃん |
| A8: 公開+MVP判定 | 0.5日 | こーちゃん+まーちゃん |
| **合計（直列）** | **7日** | |
| **合計（並列考慮）** | **5-6日** | |

→ **1.5週でMVP公開可能**（時吉さん要望「1-2週」と整合）

---

## Supabase todos 起票時の項目

各タスクは `todos` テーブルに以下形式で起票:

```json
{
  "title": "A1: Supabase プロジェクト準備",
  "description": "（上記の実装内容そのまま）",
  "assigned_to": 2,
  "status": "approved",
  "tags": ["wms-test2-evolution", "track-a-mvp", "kickoff"],
  "metadata": {
    "evolution_phase": "MVP",
    "track": "A",
    "task_id": "A1",
    "depends_on": [],
    "expected_hours": 4
  }
}
```

---

## まーちゃん自身のタスク（起票しない・1号領分）

- 各タスクの設計レビュー
- A2 適用前に specs/PRODUCTION_HANDOFF_PLAN.md との整合確認
- 中津さんへの状況連絡（A1完了時 + A8完了時）
- 各タスク完了確認とフロー進行管理
- MVP判定（A8）後の次フェーズ方針決定

---

## ベータフェーズ予告（MVP完了後）

MVP完了後、次に着手する内容:
- 中津さん本番DB（既存 Supabase）への接続切替
- フロント React化（領域別に段階的、まず出庫から）
- 帳票・印刷の整備
- 不備リスト28件の解消（特に高影響度7件）
- 25工程フル統合（wms-impl の機能群を wms-test2 に取り込み）

---

**作成: 2026-05-28 / 1号（まーちゃん） / v2(Express維持版)**
