# Anthropic 自社製品ナレッジベース

> 起票：2026-05-08 / Phase 8-K1 まーちゃん
> 失敗パターン15（自社製品の新機能を知らない）対策。**全 AI が起動時に必読**。
> 時吉さん哲学：「人間に教えられる側じゃダメ・知らないなら情報収集しろ・毎日新機能出てる」

---

## 0. 心構え（システムプロンプトに含める前提）

- 自社（Anthropic）の機能・新機能を **全部・隅々まで**把握する
- 知らないことは恥
- 知らないなら即 WebSearch / WebFetch で情報収集
- 新機能を **試して使い倒す**
- 本プロジェクト（WMS）への組み込み判断を能動的に行う

---

## 1. 製品ライン（2026年5月時点）

### 1-1. Claude.ai（Web チャット）

URL: https://claude.ai

| 機能 | 概要 |
|------|------|
| 通常チャット | 対話型 AI |
| Projects | プロジェクト単位のコンテキスト管理 |
| Artifacts | コード・図表をリアルタイム生成・編集（あーちゃんが使うツール） |
| Computer Use | デスクトップ操作（一部プラン）|
| Knowledge / Files | プロジェクトに添付したファイルを参照 |

### 1-2. Claude Code（CLI / IDE 統合）

URL: https://claude.com/product/claude-code / https://code.claude.com/docs

我々が今動かしているもの。

| 機能 | 概要 |
|------|------|
| **CLI** | ターミナル / Mac App で動く agentic コーディング |
| **IDE 統合** | VSCode / JetBrains 系拡張 |
| **Skills** | カスタマイズ可能なスキル定義（system reminder で頻出）|
| **Hooks** | PreToolUse / PostToolUse / Stop 等のイベント駆動カスタマイズ |
| **Settings** | settings.json / settings.local.json で挙動制御 |
| **Memory** | `~/.claude/projects/<dir>/memory/` で個別記憶 |
| **Subagents** | Plan / Explore / general-purpose 等の専門 agent 起動 |
| **Worktrees** | Git worktree で並列作業（今夜活用済）|
| **MCP** | Model Context Protocol で外部ツール統合 |
| **Plugins** | Claude Code 用プラグイン10個リリース済 |

### 1-3. Cowork（デスクトップ agentic AI）★今夜時吉さん指摘で発見★

URL: https://claude.com/product/cowork / https://www.anthropic.com/product/claude-cowork

| 機能 | 概要 |
|------|------|
| 動作 | デスクトップ全体を操作する agentic AI |
| アクセス | ローカルファイル・アプリ（許可フォルダ内）|
| 完遂 | 多段ステップタスクを最初から最後まで自動 |
| Human-in-the-loop | プラン承認制 |
| 統合 | **Microsoft 365 / 物流業界 MCP / 金融保険業向けアプリ** |
| プラグイン | 10個リリース済 |
| 利用 | 全 Paid プラン（デスクトップアプリ経由）|

**WMS プロジェクトでの活用候補**：
- わーちゃん（id=4・現 offline）の本格起動
- トークン残量自動取得
- Mac Claude メニューバー監視
- Microsoft 365 連携（Excel・Outlook 経由の事務）
- 物流業界 MCP の活用（キーエンスデモ準備）

### 1-4. Claude Apps / Mobile

| 機能 | 概要 |
|------|------|
| Mac/Win Desktop | Claude.ai のネイティブアプリ |
| iOS/Android | モバイル対応 |
| 通知 | プッシュ通知でタスク完了等 |

---

## 2. モデル（2026年5月時点）

| ファミリー | 用途 | 速度 | コスト |
|---------|------|----|------|
| **Claude Opus 4.6 / 4.7** | 最高性能・難易度高いタスク | 中速 | 高 |
| **Claude Sonnet 4.5 / 4.6 / 4.7** | バランス型 | 速い | 中 |
| **Claude Haiku 4.5** | 軽量・高速 | 最速 | 低 |
| **Claude 4.6 / 4.7** | 通常使用 | — | — |

**WMS 活用方針**：
- Edge Function `ma-chan-webhook`：Haiku 4.5（速度優先）
- Claude Code 各 runner：Opus（複雑判断）or Sonnet（バランス）
- バッチ処理：Haiku（コスト削減）

---

## 3. API 機能（platform.claude.com）

URL: https://docs.anthropic.com / https://platform.claude.com/docs

| 機能 | 概要 | WMS 適用候補 |
|------|------|------|
| **Tool use** | function calling・MCP 経由で外部ツール | 既に Supabase MCP / claude-in-chrome 等で活用 |
| **Files API** | PDF・画像・Excel 直接処理 | 帳票生成・荷主提出書類 |
| **Citations** | 出典付き応答 | キーエンス向け技術資料生成 |
| **Memory tool** | 長期記憶（API 内蔵）| 各 runner の記憶共有・検討候補 |
| **Batch API** | 50%割引・大量処理 | 月次請求書バッチ生成（CA-1）|
| **Prompt Caching** | 90%割引・コンテキスト使い回し | システムプロンプト・kurokun_memo の使い回し |
| **Computer use** | デスクトップ操作（API 経由）| わーちゃん経由で活用 |
| **Streaming** | リアルタイム応答 | 社長室サイトの対話 UI |
| **Extended thinking** | 思考プロセス可視化 | 致命傷ライン判断時に有用 |

### Prompt Caching の威力（要検討）

通常コンテキスト：1M トークン送るたびに課金
キャッシング：1回目だけ通常料金、2回目以降は **90%割引**

WMS プロジェクトでの活用：
- システムプロンプト（KO/SA/NI/MA）= 数万トークン → キャッシュ化
- kurokun_memo の critical 全件 = 数万トークン → キャッシュ化
- **トークン消費 1/10 になる可能性**

→ Phase 8-K7 で本格設計予定。

---

## 4. プラン仕様

URL: https://claude.com/pricing

| プラン | 月額 | 5時間ウィンドウ | 週間制限 | Claude Code |
|------|----|------------|------|-----------|
| Free | $0 | 軽い制限 | あり | 限定 |
| Pro | $20 | あり | あり | 含む |
| **Max 5x** | $100 | **5x の枠** | あり | 含む（5時間枠2倍済） |
| Max 20x | $200 | **20x の枠** | あり | 含む |
| Team | 別 | チーム共有 | — | 含む |
| Enterprise | 別 | 個別調整 | — | 含む |

**我々のプラン：Max 5x**
- 5時間ウィンドウ：使用開始から5時間カウント
- リセット：使用上限到達時 or 5時間経過
- 週間制限：2種（全モデル横断 + Sonnet 専用）
- Claude.ai + Claude Code は **同一プール**で消費

---

## 5. MCP（Model Context Protocol）

URL: https://docs.anthropic.com/en/docs/agents-and-tools/mcp

| 種別 | 例 |
|------|----|
| **公式 MCP** | Filesystem / Slack / GitHub / Memory / Puppeteer |
| **サードパーティ** | Notion / Linear / Stripe / Supabase / Atlassian / Sentry |
| **自作 MCP** | カスタムサーバー実装可（npm パッケージ・Python 等）|

**我々が今夜使った MCP**：
- Supabase MCP（execute_sql / deploy_edge_function 等）
- Claude in Chrome（ブラウザ操作）
- Notion MCP（読み取りのみ・現状）
- Computer Use MCP（デスクトップ操作）

**WMS プロジェクトでの追加候補**：
- Microsoft 365 MCP（わーちゃん用）
- Stripe MCP（請求書連携・将来）
- Linear / Notion MCP（事務効率化）

---

## 6. Plugins（Claude Code / Cowork 用）

URL: https://claude.com/plugins

10個リリース済（2026年）。詳細は要 WebFetch 調査（Phase 8-K で実施予定）。

---

## 7. Managed Agents

URL: https://platform.claude.com/docs/en/managed-agents/overview

| 機能 | 概要 |
|------|------|
| サーバーサイド AI | Anthropic 側がホストする agent |
| 自動デプロイ | コード書かずに agent 構築 |
| MCP 統合 | 外部ツール連携 |

WMS 適用候補：
- 顧客（荷主）向けセルフサービス AI（Phase 9 後期）
- 営業デモ用 AI

---

## 8. Skills（Claude Code 内）★今夜 system reminder で頻出★

Claude Code 内のスキルシステム。`/skills` 系コマンドや keybindings.json 等で定義。

我々のセッションで自動表示されたスキル例：
- update-config（settings.json 編集支援）
- fewer-permission-prompts（permission 緩和提案）
- claude-api / pdf / xlsx / pptx / docx（Anthropic 公式）
- skill-creator（スキル作成）
- consolidate-memory（メモリ整理）
- setup-cowork（Cowork セットアップ）
- schedule（cron 系）
- loop（繰り返し実行）

**WMS プロジェクトでの活用候補**：
- スケジュール系スキルでナイト・ミーティング自動化
- xlsx スキルで請求書 Excel 出力
- pdf スキルで帳票出力
- skill-creator で WMS 専用スキル作成

→ Phase 8-K4 で試用予定。

---

## 9. Hooks（Claude Code 内）★今夜何度も活用機会逃した★

イベント駆動カスタマイズ。`settings.json` の `hooks` セクションで定義。

| イベント | 用途例 |
|---------|------|
| PreToolUse | Edit 前にバックアップ |
| PostToolUse | Write 後に prettier 自動実行 |
| Stop | セッション終了時に統計記録 |
| PreCompact | 会話圧縮前にメモリ保存 |
| SessionStart | 開始時に環境チェック |
| Notification | プッシュ通知連携 |

**WMS 活用候補**：
- 失敗パターン14 対策：PostToolUse で git status を自動チェック
- 自動 commit/push：Stop 時に WIP 検出→警告
- Sentry 等のエラー監視連携

→ Phase 8-K5 で試用予定。

---

## 10. 直近の主要リリース（2026年）

| 時期 | リリース |
|------|--------|
| 2026 春 | Claude Opus 4.6 / Sonnet 4.6 |
| 2026 春 | Cowork 一般提供開始 |
| 2026 春 | Claude Code Plugin 10個リリース |
| 2026 春 | Microsoft 365 統合（Cowork 経由）|
| 2026 春 | Claude Code 5時間枠 2倍に拡大 |
| 2026 4月 | Anthropic Labs 発表 |
| 2026 5月 | Claude March 2026 usage promotion 終了 |

**監視すべき情報源**：
- https://www.anthropic.com/news（公式ブログ）
- https://claude.com/blog（プロダクトブログ）
- https://code.claude.com/docs/en/whats-new/（Claude Code 週次更新）
- https://support.claude.com（サポート記事）
- https://platform.claude.com/docs（API ドキュメント）

---

## 11. 我々のプロジェクトでの活用状況・候補

### 既に活用中

- ✅ Claude Code（5体並列で AI 並列運用）
- ✅ Skills（システム経由・update-config 等で頻繁に使用）
- ✅ Hooks（部分・PostToolUse で system-reminder 受信）
- ✅ MCP（Supabase / Claude in Chrome / Computer Use / Notion）
- ✅ Memory（individual memory ファイル・PM ミーティング履歴）
- ✅ Worktrees（並列開発用）
- ✅ Subagents（Plan / Explore で活用）

### 活用準備中（Phase 8-K で試用）

- 🟡 Cowork（わーちゃん起動・Phase 8-K8）
- 🟡 Skills 全機能（Phase 8-K4 試用）
- 🟡 Hooks 全機能（Phase 8-K5 試用）
- 🟡 Memory tool（API・Phase 8-K6 試用）
- 🟡 Files API（Phase 8-K6 試用）
- 🟡 Batch API（Phase 8-K6 試用）
- 🟡 Prompt Caching（Phase 8-K7 設計）

### 未活用・将来候補

- ❌ Citations（営業資料生成時に検討）
- ❌ Computer use（API 経由・現在 MCP で代用）
- ❌ Streaming（社長室サイトの対話 UI 改善）
- ❌ Extended thinking（致命傷ライン判断時）
- ❌ Managed Agents（顧客向けセルフサービス AI）

---

## 12. 「知らなかったら恥」マスター・チェックリスト

各 AI は起動時にこれをチェック：

- [ ] Anthropic 公式の最新リリース情報を週1で確認したか？
- [ ] 直近の Claude Code Plugins 10個を把握しているか？
- [ ] Cowork でできることを言えるか？
- [ ] Skills と Hooks の違いを説明できるか？
- [ ] Prompt Caching の使い方を知っているか？
- [ ] Memory tool（API）と memory ファイル（Claude Code）の違いを区別できるか？
- [ ] Batch API の50%割引を WMS に適用できる場面を3つ挙げられるか？
- [ ] 自分の知らない機能があったら即 WebSearch するか？

---

## 13. 更新ルール

このファイルは **常に最新** を保つ：

- **わーちゃん**（Cowork 起動後）が日次で公式更新を監視
- **こーちゃん**（PM）が新機能を試用・組み込み判断
- **にーちゃん**（QA）が試用結果を検証
- **まーちゃん**（副社長）がナイト・ミーティング前に統括レビュー
- **更新時は kurokun_memo に category='anthropic_knowledge' で INSERT**

---

## 関連

- kurokun_memo の failure_pattern 15
- kurokun_memo の マスター記録（PM ミーティング決定事項）
- Phase 8-K2〜K8（情報収集・試用・本格活用）
- ナイト・ミーティングの「今日の新機能」セクション

---

*最終更新: 2026-05-08 / Phase 8-K1 まーちゃん（副社長・初版）*
