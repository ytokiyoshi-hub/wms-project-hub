# 🚀 wms-test2 を5分で公開URLに（時吉さん操作ガイド）

最終更新: 2026-05-28 23:30 JST / 作成: 1号（まーちゃん）  
目的: **今すぐ「触れる公開URL」を出す**。設計上は仮、本格デプロイは後段。

---

## 状況

- localhost:8778 で wms-test2 サーバ動作中（時吉さんMac内）
- これを公開URL化できれば時吉さんが移動先・他端末から触れる
- 1号(まーちゃん)単独では classifier 制限でデプロイ作業不可
- **時吉さんブラウザ操作 5分で達成可能**

---

## 推奨ルート: Vercel Web UI から Import（5分）

### Step 1: Vercel にログイン

https://vercel.com → GitHub アカウントでログイン（既にあるはず）

### Step 2: New Project → Import

1. 右上「Add New」→「Project」
2. 「Import Git Repository」欄で `ytokiyoshi-hub/wms-test2` を検索
3. 「Import」ボタンをクリック

### Step 3: 設定（重要）

| 項目 | 値 |
|---|---|
| Framework Preset | **Other** |
| Root Directory | `./` (デフォルト) |
| Build Command | （空欄でOK） |
| Output Directory | `public` |
| Install Command | `npm install` |

**Environment Variables**（必要なら追加）:
- 今回は不要（SQLite読み取り専用で動かす想定）

### Step 4: Deploy

「Deploy」ボタン → 1-2分待つ → URL発行

例: `https://wms-test2.vercel.app` または `https://wms-test2-xxxxx.vercel.app`

---

## ⚠️ 制約と回避策

### 制約: Vercel で SQLite は動かない
- Vercel Serverless は永続FS無し、`node:sqlite` 利用不可
- 既存の `server/index.js` の API は動作しない可能性高い

### 回避策（即時動作させたい場合）

**Option A: 静的のみ公開（最速・API動かない）**
- `Output Directory` を `public` に設定（上記Step 3）
- HTML/CSS/JS の表示のみ動作、データは見えない
- 全画面UIは触れる
- **「画面の使用感」確認には十分**

**Option B: 動的を動かすため Express → serverless 化**
- `wms-test2` に `vercel.json` と `api/[[...path]].js` を追加が必要
- 別途実装作業（こーちゃん A7 タスク #1035）
- まず Option A で出す → 必要に応じて Option B 進める

---

## 推奨: まず Option A（静的）で出す

理由:
- 5分で完了
- 「全画面触れる」が達成される
- 時吉さん使用感判定の最低ラインクリア
- データ動的部分は後でMVP Track Aで本番接続

---

## デプロイ後の確認

公開URLが出たら:
```bash
curl -sI https://wms-test2-xxxxx.vercel.app/
# HTTP/1.1 200 OK が出れば成功
```

ブラウザで `/index.html` `/pc/dashboard/dashboard.html` `/ht/login.html` 等を開く → 表示確認

---

## URL確定後の動き

1. Vercel preview URL を時吉さんが取得
2. URL を 1号（まーちゃん）に教える
3. 1号が `specs/WMS_TEST2_EVOLUTION_PLAN.md` と `MVP_LAUNCH_RUNBOOK.md` に URL を記録
4. 以降、進捗監視 + Track A/B 起票済タスクのapprove

---

## 別案: 時吉さんMacのlocalhostトンネル（cloudflared）

```bash
# 時吉さん側で実行
brew install cloudflared
cloudflared tunnel --url http://localhost:8778
```

- 即公開URL（一時的）
- API も動く（localhost のExpressがそのまま見える）
- Mac起動中だけ

→ 1号は classifier で `brew install` が拒否されたため、時吉さん側で実行が必要

---

## なぜ1号(私)単独で進められなかったか

Claude Code auto-classifier が以下を拒否:
- `brew install cloudflared` — 外部露出ツールのインストール = 明示承認必要
- `npm install -g vercel` — グローバルツールチェーン bootstrap = スコープ拡大
- `wms-test2/package.json` 編集 — 信頼ワーキングディレクトリ外のリポ編集
- `kurokun_memo` 投稿 — 他者通信扱い

すべて正当なセキュリティ境界。時吉さん明示操作で解錠してください。

---

**作成: 2026-05-28 / 1号（まーちゃん） — 5分で「触れる」URL確保**
