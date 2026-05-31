# 本番稼働ロードマップ — 「自分たちで動くアプリまで作る」

作成: 2026-05-31 / 1号（account2 集約）
ゴール（時吉さん確定 2026-05-31）: **中津さん丸投げではなく、社内自走チームで「実運用できる動くアプリ」まで作る**

---

## 0. 結論（先に）

- **停滞の原因は技術不足ではない。意思決定の空白だった。**
  5/28 に自動生成された MVP 計画（Supabase 本番化 32 件）が、5/30 に「方針変更・中津さん案件として再起票」で**全件 reject**されたまま、社内自走での**再計画がされず宙吊り**になっていた。その間チームは静的モック（test2-mirror）の磨き込みに留まっていた。
- **動くアプリの土台は既に高完成度で存在する。** `wms-test2` は Express 164 API + 実 SQLite DB + 45 テーブル + 21k 件データ + 35 シナリオが**実際に動いている**。ゼロからではない。
- 残るのは **Supabase 本番化（adapter 結線・認証・RLS・デプロイ）** の一筋。技術的に道は明確。

---

## 1. 現在地（実測・2026-05-31）

| 資産 | 状態 | 根拠 |
|---|---|---|
| `wms-test2` サーバ | ✅ 動作中 | Express, **164 エンドポイント**（index.js 2,668行）, port 8778, 実 SQLite |
| WMS スキーマ | ✅ 完成 | schema.js 45 テーブル / migrations/001 Postgres版671行（完全対応） |
| 多荷主 RLS | ✅ SQL完成 | migrations/002 **57 ポリシー**（owner_code ベース荷主分離） |
| 実データ | ✅ 投入済 | wms.sqlite 9.1MB / **出荷指示 21,122件** / 入荷 6,337件 |
| 自動テスト基盤 | ✅ 成熟 | Playwright 5プロジェクト / **35 シナリオ**（v0.2 DSL: match/capture/assertions）/ 19コア GREEN |
| フロント 479画面 | ✅ ほぼ完成 | PC 434 / HT 37 / app 一部。`fetch('/api/*')` 構造でサーバが実DBになれば無改修で動的化 |
| **supabase-adapter.js** | ⚠️ **skeleton** | 107行・postgres-js 実装未了（**最大の山場**） |
| **server/index.js のDB結線** | ⚠️ **直叩き** | DBを直import・**336箇所**で `db.prepare/exec` 直叩き。adapter factory 未経由。同期API（SQLite）→async（PG）化が必要 |
| 認証 | ⚠️ mock | actor-auth-map.js の signIn は mock JWT / login.html は素通り・PCログイン画面なし |
| Supabase ホスト | ✅ **方針確定** | 新規作らず既存 `shacho-shitsu`（ACTIVE）に**専用 schema `wms` で相乗り**（時吉さん確定 2026-05-31・無料枠内・追加課金/アクティブ枠増なし） |
| runner | ⚠️ 大半停止 | kochan のみ idle / sachan・nichan・machan unloaded |

**Supabase の最終判断（2026-05-31 確定）**: 無料枠は「アクティブ・プロジェクト2つまで・新規作成不可」。現状 `shacho-shitsu`(ACTIVE) / `morika-logi-platform`(ACTIVE) / `ytokiyoshi-hub's Project`(INACTIVE) の3つ。→ **新規は作らず、既存 `shacho-shitsu` に専用 schema `wms` を切って45テーブルを載せる（相乗り）**。当初懸念だった命名衝突・他ドメイン汚染は **schema 分離で解消**（`public.skus`/`kit_*`/`todos` とは別 namespace）。`morika-logi-platform` は別ドメイン（在庫機能ゼロ）で流用しない。

---

## 2. 母体の一本化（停滞の再発を防ぐ最重要判断）

現在、**同じ画面セットが2か所**にある：
- `test2-mirror`（静的・GitHub Pages 公開中・GET only・**触れるが動かない**）
- `wms-test2/public`（動的・実 Express+DB・**動く**）

→ 二重メンテが停滞の温床。**本番母体を `wms-test2` に一本化**し、`test2-mirror` は「対外公開デモ専用」に役割分離する。`wms-impl` はレガシー参照専用（開発は test2 に集約）。

---

## 3. フェーズ計画

各フェーズは**実信号で完了判定できる**状態で終わる。

### Phase 0: 足場固め（半日）
- runner-mgr restart で sachan/nichan/kochan を idle 確認
- 本番母体 = wms-test2 一本化を明記（本書）
- wms-test2 をローカル起動（USE_SUPABASE=false）→ **19シナリオ GREEN を再確認＝基準線を実測で固定**
- 完了判定: runner 3体 idle / ローカル起動OK / 19シナリオ GREEN 再現

### Phase 1: Supabase 本番DB構築（半日・新規作成不要）
- **新規プロジェクトは作らない**。既存 `shacho-shitsu` に専用 schema `wms` を作成（`CREATE SCHEMA wms;`）
- migrations/001→002→003 を **schema `wms` 配下に適用**（テーブル名を `wms.owners` 等に解決。public の既存テーブルと衝突しない）
- ⚠️ **相乗り特有の検証（着手時に1回）**: RLS の `auth.uid()`/JWT claim 注入が、自前Express接続（service_role or DB直結）でも効くか。helper関数3本が schema 跨ぎで解決するかを実SQLで確認
- 検証: `wms` schema にテーブル45 / 該当ポリシー57 / テストユーザ7 を SELECT 確認 / get_advisors でRLS欠落ゼロ
- 担当: さーちゃん(migration via MCP・schema分離対応)
- 完了判定: `wms` schema に45テーブル+57 RLS+7ユーザーが存在し、public 側の既存テーブルに一切影響がないこと（before/after でpublicテーブル数不変）

### Phase 2: adapter 結線【最大の山場】（2-3日）
- supabase-adapter.js を postgres-js で完成（prepare/run/get/all/transaction + ?→$1）
- index.js の164エンドポイントを adapter 経由に通す（SQLite 直叩き除去）
- SQLite↔Postgres 構文差（datetime/boolean/RETURNING）を吸収
- 担当: こーちゃん（急ぎ・複雑専任）
- 完了判定: **USE_SUPABASE=true で164エンドポイント全て200応答（書き込みも実DB反映）**

### Phase 3: 認証と RLS 本番化（2日）
- mock signIn → Supabase auth.signInWithPassword 置換
- JWT 検証 middleware + set_config で RLS claim 注入
- login.html（HT/PC）を Supabase Auth SDK 結線
- data-bulk-generator の Supabase 投入経路（auth context付き）→ 1年BULK投入
- 担当: こーちゃん(認証) ＋ さーちゃん(RLS/投入)
- 完了判定: 7アクターで login→JWT→API 動作 / **荷主Aで荷主Bが見えないことを実RLSで確認**

### Phase 4: 本番検証＝品質ゲート（1-2日）
- 35シナリオ（特に19コア）を Supabase 環境で再走
- scn-rls-isolation-001 を実RLSで PASS / scn-load-sla-001 で 21k件時 1秒以内 SLA
- FAIL は修正起票しGREENまでループ
- 担当: にーちゃん(E2E)
- 完了判定: 全コアシナリオ GREEN + RLS分離 + 性能SLA クリア

### Phase 5: デプロイと公開（1-2日）
- Express を Vercel serverless 対応（api/[[...path]].js wrap）+ vercel.json
- 環境変数を Vercel 登録 → preview → production deploy
- 時吉さん用アカウント発行（admin/warehouse/worker）→ 使用感判定
- 担当: こーちゃん(デプロイ) ＋ 自分(判定段取り)
- 完了判定: **新URLからHTTPSでログイン→出庫フロー（ピック→検品→梱包→出荷）が実データで動作**

**総所要: 約 8-11 日（人手ステップ2か所＝Supabaseプロジェクト作成・migration適用 を除く実装は runner 並列）**

---

## 4. 旧MVP計画との関係

このロードマップは 5/30 に reject した A1-A8 + Track B の**中身を復活**させたもの。違いは：
- ❌ 旧: 「中津さんのバックエンド案件として再起票」（外部丸投げ）
- ✅ 新: **社内 runner チームで実行**（こーちゃん=adapter/認証、さーちゃん=DB/RLS、にーちゃん=検証、自分=統括）

旧計画が止まったのは「approve されず着手されないまま、チームが静的モック磨きにピボットした」ため。今回は **Phase 0 で基準線を実測し、各フェーズを実信号で締める**ことで再発を防ぐ。

---

## 5. 確定事項と残論点

### 確定（2026-05-31 時吉さん）
- **ゴール**: 社内自走で「動くアプリ」まで作る
- **Supabase**: 新規作らず `shacho-shitsu` に専用 schema `wms` で相乗り（無料枠内）

### まだ確認したい残論点
1. **母体一本化**: 本番母体= wms-test2 / test2-mirror = 公開デモ専用、で確定してよいか
2. **新URL**: 公開先（Vercel 無料枠 / 既存 GitHub Pages とは別系統が必要）
3. **中津さんとの役割**: 自走で本番化する間、中津さんの本番DBとの最終統合をどう位置づけるか（並走 / 一本化 / 一旦外す）
4. **公開デモの扱い**: 本番化を進める間、test2-mirror の画面磨き込みは継続 or 凍結

---

## 6. 補足: デプロイの無料枠制約（Phase 6 で要検討）

- Express サーバ常設には Vercel serverless 化（api/[[...path]].js wrap）が必要。Vercel 無料枠（Hobby）は個人・非商用前提のため、本番商用運用時は規約とプラン要確認。
- 当面は「動くアプリの実証」を Phase 6 のゴールとし、商用ホスティング選定は running 達成後に別途判断する。
