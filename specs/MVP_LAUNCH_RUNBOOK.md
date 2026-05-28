# MVP LAUNCH RUNBOOK — wms-test2 本番品質進化MVP着手手順

最終更新: 2026-05-28 / 作成: 1号（まーちゃん）  
親計画: `specs/WMS_TEST2_EVOLUTION_PLAN.md`

---

## 0. このRunbookで達成すること

明日以降「やるだけ」状態で MVP 着手できるよう、実行手順 + 起票SQL + 監視方法を1ファイルに集約。

**所要時間（人間操作）**: 約30分（Step 1〜5）
**所要時間（runner消化）**: 1.5週（Track A + B並列）

---

## 1. 前提状態確認

```bash
# runner状態確認（全員loaded・idleであること）
~/github/shacho-shitsu/worker/runner-mgr status

# 期待:
# kochan: loaded / idle
# sachan: loaded / idle
# nichan: loaded / idle
# machan: loaded / idle
```

✅ 2026-05-28 21:45時点で全員 loaded・idle 確認済み

---

## 2. Step 1: Supabase プロジェクト作成（人手・10分）

1. Supabase ダッシュボード（https://supabase.com/dashboard）にログイン
2. 「New Project」で `marki-wms-mvp` プロジェクト作成
3. リージョン: `ap-northeast-1` (Tokyo)
4. パスワード設定（記録）
5. プロジェクト作成完了後、以下を取得：
   - Project URL（`https://xxxxx.supabase.co`）
   - `anon` public key
   - `service_role` secret key

→ これらを `~/github/wms-test2/.env` に追加（後段で）

---

## 3. Step 2: DB migration 適用（さーちゃん起票・3分）

> ⚠️ **メモ準拠**: migration適用はMCP有効セッションから（runner不可）

### 起票SQL — さーちゃん向け migration 適用タスク

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A2: wms-test2 migrations 001-003 を Supabase へ適用',
  '〔背景〕wms-test2のSupabase Postgres移行MVPの第一歩。
〔作業〕
1. Supabase MCPセッションで以下を順次実行:
   - ~/github/wms-test2/migrations/001_initial_schema.sql (45テーブル作成)
   - ~/github/wms-test2/migrations/002_rls_policies.sql (RLS policy)
   - ~/github/wms-test2/migrations/003_seed_test_users.sql (7 actor投入)
2. 検証クエリ:
   - SELECT count(*) FROM information_schema.tables WHERE table_schema=''public''; → 45以上
   - SELECT count(*) FROM pg_policies; → policy投入確認
   - SELECT email FROM auth.users LIMIT 10; → 7 actor確認
〔完了条件〕全テーブル + RLS policy + 7 actor が存在',
  5,
  'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A2', 'migration', 'mcp-required'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A2","expected_hours":4}'::jsonb
);
```

---

## 4. Step 3: Track A 起票（こーちゃん向け 7タスク）

### A1: Supabase プロジェクト準備

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A1: Supabase プロジェクト準備 + supabase-js 導入',
  '〔作業〕
1. ~/github/wms-test2/.env に SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY を追加
2. .env.example も更新
3. @supabase/supabase-js を package.json に追加
4. lib/supabase.js でクライアント実装
5. 接続テスト（簡単なping）
〔完了条件〕USE_SUPABASE=true npm start でエラーなく起動',
  2, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A1'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A1","depends_on":[],"expected_hours":4}'::jsonb
);
```

### A3: 1年BULK 投入

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A3: data-bulk-generator で 1年BULK を Supabase へ投入',
  '〔依存〕A2 完了
〔作業〕
1. test-runner/lib/data-bulk-generator.js を data-generator-adapter経由でSupabase対応
2. 1年BULK投入実行（21k件SO + 6.3k件入荷）
3. 投入後の検証
〔完了条件〕
- SELECT count(*) FROM shipment_orders; → 21000+
- SELECT count(*) FROM inbound_schedules; → 6300+',
  2, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A3'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A3","depends_on":["A2"],"expected_hours":4}'::jsonb
);
```

### A4: adapter 切替（SQLite → Supabase）

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A4: server/adapters/supabase-adapter.js を完成・USE_SUPABASE切替',
  '〔依存〕A2 完了
〔作業〕
1. server/adapters/supabase-adapter.js の雛形をpostgres-jsベースで完成
2. server/adapters/index.js の factory完成（USE_SUPABASE env切替）
3. server/index.js のSQLite直叩きを adapter経由に置換（164エンドポイント）
4. クエリ構文差（SQLite vs Postgres）を吸収
5. ローカル動作確認 USE_SUPABASE=true npm start
〔完了条件〕全エンドポイントがエラーなしに応答
〔参考〕HANDOFF.md のadapter切替手順、N+1解消パターン',
  2, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A4'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A4","depends_on":["A2"],"expected_hours":12}'::jsonb
);
```

### A5: 認証統合（Supabase Auth）

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A5: Supabase Auth 統合・JWT検証・actor-auth-map修正',
  '〔依存〕A4 完了
〔作業〕
1. ?owner=クエリ擬似フィルタを Supabase Auth JWT に置換
2. test-runner/lib/actor-auth-map.js を Supabase Auth API呼び出しに修正
3. server側にJWT検証middleware追加（Authorization Bearer token）
4. session注入 SELECT set_config(request.jwt.claims, $1, true) でRLS用
5. フロント側ログイン画面（public/ht/login.html等）を Supabase Auth SDK経由に
〔完了条件〕7 actorで login→JWT取得→API呼び出し が動作',
  2, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A5'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A5","depends_on":["A4"],"expected_hours":12}'::jsonb
);
```

### A6: RLS検証 + 19シナリオ再走（にーちゃん）

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A6: 19シナリオを Supabase 環境で再走・RLS分離検証',
  '〔依存〕A5 完了
〔作業〕
1. test-runner/runner.js を Supabase対応に修正
   - シナリオの?owner=クエリ削除（RLSが自動フィルタ）
   - base URLを Supabase 環境向けに切替
2. 全19シナリオをSupabase環境で再実行
3. 失敗があれば原因特定→こーちゃんに修正起票（自分でinsertか or 報告）
〔重要シナリオ〕
- scn-day-flow-001: 1日業務貫通（11ステップ）
- scn-core-outbound-001: 出庫貫通（MVP対象）
- scn-rls-isolation-001: RLS分離検証
- scn-load-sla-001: 性能SLA（1秒以内）
〔完了条件〕全19シナリオ PASS（flakyなし）+ RLS分離確認',
  7, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A6', 'qa'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A6","depends_on":["A5"],"expected_hours":8}'::jsonb
);
```

### A7: Vercel デプロイ準備

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A7: Vercelデプロイ設定・Express を serverless対応',
  '〔依存〕A4 完了（A5/A6と並列可）
〔作業〕
1. Express を Vercel互換に調整
   - api/[[...path]].js で Express handler を @vercel/node でserverless wrap
   - or Vercel Edge Runtime対応検討
2. vercel.json 設定（routes/build/env）
3. 静的ファイル（public/）のserve設定
4. 環境変数をVercelに登録（SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE=true）
5. preview deploy
〔完了条件〕Vercel preview URL でログイン→業務画面動作',
  2, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A7'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A7","depends_on":["A4"],"expected_hours":8}'::jsonb
);
```

### A8: 公開 + MVP判定

```sql
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-A8: Vercel production deploy + 時吉さんアカウント発行 + MVP判定',
  '〔依存〕A6, A7 完了
〔作業〕
1. Vercel production deploy
2. カスタムドメイン or 仮ドメイン取得（例: marki-wms.vercel.app）
3. HTTPS確認
4. 時吉さん用テストアカウント発行（admin/warehouse_manager/worker各1）
5. まーちゃんへ「新URL公開」通知（MVP判定セッション起動）
〔MVP判定条件〕
- 新URL から HTTPS でアクセス可能
- ログイン→業務画面（特に出庫）動作
- 19シナリオ PASS維持
- 1年BULKで性能SLAクリア
- 時吉さん使用感判定',
  2, 'approved',
  ARRAY['wms-test2-evolution', 'track-a-mvp', 'A8', 'launch'],
  '{"evolution_phase":"MVP","track":"A","task_id":"A8","depends_on":["A6","A7"],"expected_hours":4}'::jsonb
);
```

---

## 5. Step 4: Track B 起票（A4完了後・並列消化 / 24タスク）

> Track B は Track A の **A4 (adapter切替)** 完了後に起票・着手するのが効率的。それまで pending として置く。

### 一括INSERT用テンプレート（P0タスク16件）

```sql
-- T-PC-OB-001 ~ T-PC-OB-007 (PC側出庫 7件)
-- T-HT-PK-001 ~ T-HT-PK-007 (HT pick/packing)
-- T-HT-IB-001 ~ T-HT-IB-004 (HT inspect)
-- T-HT-LD-001 ~ T-HT-LD-002 (HT loading)
-- T-HT-HO-001 ~ T-HT-HO-002 (HT handover)

-- 例: T-PC-OB-001
INSERT INTO todos (title, description, assigned_to, status, tags, metadata)
VALUES (
  'MVP-B-PC-OB-001: pc/outbound/orders.html 動作確認・性能調整',
  '〔状況〕Supabase Postgres移行後の動作確認
〔作業〕
1. Supabase接続でAPI応答確認
2. 状態別集計（待機中/進行中/完了）の精度検証
3. 1年BULK 21k件で表示性能測定（SLA 1秒以内）
〔完了条件〕scn-core-outbound-001の該当部分PASS',
  2, 'pending',  -- A4完了まで pending
  ARRAY['wms-test2-evolution', 'track-b-mvp', 'outbound', 'p0', 'pc'],
  '{"evolution_phase":"MVP","track":"B","task_id":"T-PC-OB-001","screen_path":"pc/outbound/orders.html","depends_on":["A4","A5"],"expected_hours":2}'::jsonb
);

-- (他23タスクは TRACK_B_MVP_TASKS.md の表を SQL化して同様に挿入)
```

→ 詳細リストは `specs/TRACK_B_MVP_TASKS.md` の表を参照して生成

---

## 6. Step 5: 中津さんへ連絡

```bash
# 内容
cat ~/github/wms-project-hub/wms-project-hub/specs/MESSAGE_TO_NAKATSU_2026-05-28_MVP_LAUNCH.md
```

→ 内容を時吉さんが中津さんに転送（メッセージング手段は時吉さん判断）

API契約叩き台:
```bash
cat ~/github/wms-project-hub/wms-project-hub/specs/API_CONTRACT_OUTBOUND_DRAFT.md
```

---

## 7. 進捗監視

### runner状態（定期）
```bash
~/github/shacho-shitsu/worker/runner-mgr status

# 各runnerの最新ログ
LOG_DIR=~/github/shacho-shitsu/worker/logs
for f in kochan-runner sachan-runner nichan-runner; do
  echo "=== $f ==="
  tail -5 "$LOG_DIR/$f.log"
done
```

### Supabase todos 状態（MCP経由）
```sql
SELECT
  m.name AS runner,
  COUNT(CASE WHEN t.status='in_progress' THEN 1 END) AS in_progress,
  COUNT(CASE WHEN t.status='approved' THEN 1 END) AS approved,
  COUNT(CASE WHEN t.status='completed' AND t.updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS done_today,
  COUNT(CASE WHEN t.status='failed' AND t.updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS failed_today
FROM members m
LEFT JOIN todos t ON t.assigned_to = m.id
  AND 'wms-test2-evolution' = ANY(t.tags)
WHERE m.id IN (2, 5, 7)
GROUP BY m.id, m.name
ORDER BY m.id;
```

---

## 8. トラブルシューティング

### runner が消化しない場合
1. `~/github/shacho-shitsu/worker/runner-mgr status` で状態確認
2. ログ末尾確認 (`tail -50 ~/github/shacho-shitsu/worker/logs/kochan-runner.log`)
3. タスクの `assigned_to` と `status='approved'` を確認
4. tags に `serial-ok` or `full-burst-ready` がない場合、runnerは自己 approved できない

### migration 適用エラー
1. メモ「migration適用はMCPセッションから」を確認
2. service_role_key の権限確認
3. 既存テーブルとの衝突確認 (DROP TABLE が必要な場合あり)

### Vercel デプロイ失敗
1. SQLite (`db/wms.sqlite`) を bundle に含めない（.vercelignore）
2. Express を `@vercel/node` で wrap した serverless handler に
3. node:sqlite は使えない（Vercel Node.js ランタイム制限）→ adapter切替が前提

---

## 9. ファイル参照リンク

- [WMS_TEST2_EVOLUTION_PLAN.md](WMS_TEST2_EVOLUTION_PLAN.md) — 全体計画
- [TRACK_A_KICKOFF_TASKS.md](TRACK_A_KICKOFF_TASKS.md) — Track A 詳細
- [TRACK_B_MVP_TASKS.md](TRACK_B_MVP_TASKS.md) — Track B 24タスクリスト
- [API_CONTRACT_OUTBOUND_DRAFT.md](API_CONTRACT_OUTBOUND_DRAFT.md) — 中津さん向けAPI契約
- [MESSAGE_TO_NAKATSU_2026-05-28_MVP_LAUNCH.md](MESSAGE_TO_NAKATSU_2026-05-28_MVP_LAUNCH.md) — 中津さん連絡ドラフト
- [PRODUCTION_HANDOFF_PLAN.md](PRODUCTION_HANDOFF_PLAN.md) — 既存・中津さん向け段取り

---

## 10. 着手予定タイムライン

```
2026-05-28（今日）
├ 壁打ち完了 ✅
├ 5文書作成・commit/push 完了 ✅
└ Runbook作成 ✅

2026-05-29（明日・人手で起票）
├ Step 1: Supabase プロジェクト作成
├ Step 2: A2 起票（MCPセッション）→ さーちゃんが migration 適用
├ Step 3: A1, A3-A8 起票
└ Step 5: 中津さんへ連絡

2026-05-30〜06-03（runner消化）
├ A1, A2, A3 完了
├ A4 着手・完了 → ここで Track B 起票
└ A5-A8 + Track B P0 並列消化

2026-06-04〜06-11
├ MVP判定 (A8)
├ 時吉さん使用感確認
└ 次フェーズ判定
```

---

**作成: 2026-05-28 / 1号（まーちゃん） — このRunbookで明日以降の動きが「実行するだけ」に**
