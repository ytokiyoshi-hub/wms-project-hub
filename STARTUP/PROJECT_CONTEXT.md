# PROJECT_CONTEXT — WMS固有情報

## ドメイン

**3PL 倉庫管理システム（WMS）**
荷主ごとの在庫管理・入出庫・ピッキング・棚卸・請求を一元管理。

---

## 各号の呼び名

| 号 | 役割 | 別名 |
|----|------|------|
| 1号 | タスク統括 / 仕様策定 | まーちゃん |
| 2号 | 実装プロト | — |
| 3号 | ヒアリング整理専任 | — |

---

## リポジトリ

| 項目 | パス |
|------|------|
| **WMS メインリポジトリ**（1号・3号の作業場所） | `~/github/wms-project-hub/wms-project-hub/` |
| remote | `ytokiyoshi-hub/wms-project-hub` |
| **WMS 実装リポジトリ**（2号の作業場所） | `~/github/wms-impl/` |
| 2号リポジトリ（1号・3号は読み取り専用） | — |
| **claude-agents**（IDENTITY・KNOWLEDGE置き場） | `~/github/claude-agents/` |

---

## Supabase

| 項目 | 値 |
|------|-----|
| project_id | `wqjsemttubzbpauvgyai` |
| URL | `https://wqjsemttubzbpauvgyai.supabase.co` |

---

## アカウント情報

| 項目 | 値 |
|------|-----|
| account1 契約終了 | **2026-05-22**（確定・2026-05-17 時吉さん確認） |
| 2026-05-23 以降 | **account2 集約**（同一セッションで 1号 / 2号 兼任）|
| 2号フリートは account2 で稼働中 |  |

### 2026-05-23 以降の運用（確定）

- 「1号復帰」「2号復帰」の指示で都度切替。IDENTITY.md と STARTUP/{1,2}GO.md を切替時に読み直す
- 切替時は kurokun_memo（category=handover）に現況を残してから切替
- 役割は混在させない: 1号セッション中に実装コードを書かない、2号セッション中に specs を編集しない

### runner フリート移行（2026-05-22 切替・B案確定）

時吉さん希望「社長室ダッシュボード・WMS Project Hub・メンバーをそのまま使い続けたい」を満たすため、members テーブル（id 2/5/6/7 / 8/12/15/17）と runner 名（さーちゃん/にーちゃん/こーちゃん/まーちゃん）は維持し、**plist の認証先のみ account2 に切替**して継続稼働させる。

| runner | id | 5/22 以前 | 5/23 以降 |
|---|---|---|---|
| さーちゃん | 5 | account1 認証 | **account2 認証へ切替** |
| にーちゃん | 7 | account1 認証 | **account2 認証へ切替** |
| こーちゃん | 2 | account1 認証 | **account2 認証へ切替** |
| まーちゃん | 6 | account1 認証 | **account2 認証へ切替** |
| さーちゃん2号 | 15 | account2 | 変更なし |
| にーちゃん2号 | 17 | account2 | 変更なし |
| こーちゃん2号 | 12 | account2 | 変更なし |
| まーちゃん2号 | 8 | account2 | 変更なし |

**切替手順**: 各 plist（`~/Library/LaunchAgents/com.shacho-shitsu.{sa,ni,claude,ma}-chan-runner.plist`）の `EnvironmentVariables` に以下1行を追加し、`launchctl unload && launchctl load` で再読込：

```xml
<key>CLAUDE_CONFIG_DIR</key>
<string>/Users/tokiyoshiyusuke/.claude-account2</string>
```

**運用上の留意**: 5/23 以降は 8 runner が account2 のトークン枠を共有する。同時並列稼働で limit hit が増えるため、runner-mgr で同時実行数を 3〜4 に制限する運用に切替予定。

---

## wms-impl 起動情報

| 項目 | 値 |
|------|-----|
| ポート | 8777 |
| 起動コマンド | `cd ~/github/wms-impl && npm start` |
| DB | `db/wms.sqlite`（自動生成） |

```bash
# headless Chrome での screenshot 検証（puppeteer 使用）
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8777');
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
  console.log('screenshot.png saved');
})();
"
```

---

## runner フリート構成

| runner | assigned_to | 状態 | 用途 |
|--------|-------------|------|------|
| さーちゃん | 5 | 実働 | DB設計・migration・SQL・RLS |
| にーちゃん | 7 | 実働 | E2E検証・staging検証・業務シナリオ |
| こーちゃん | 2 | **急ぎ専任** | 緊急・複雑タスクのみ。通常タスクは5/7へ |

---

## 主要 specs パス

`~/github/wms-project-hub/wms-project-hub/specs/`

| ファイル | 内容 |
|---------|------|
| `HEARING_SHEET_wms_requirements.md` | WMS要件ヒアリングシート |
| `MORNING_DECISION_SHEET.md` | 朝の判断シート |
| `PHASE9_IMPLEMENTATION_PLAN.md` | Phase 9 実装計画 |
| `process_01_requirements.md` | 要件定義 |
| `process_02_inbound.md` | 入庫フロー |
| `process_03_db_design.md` | DB設計 |
| `process_NN_*.md` | 各業務プロセス仕様（01〜16） |

---

## 現在のフェーズ

**Phase 9 実装中**（2026-05-17時点）
- Stage 1〜4 完了（DB・引当・請求・RLS）
- ヒアリングシート（HEARING1）回答取得・specs反映中
- account1 が 2026-05-22 に終了するため、account2 移行が急務
