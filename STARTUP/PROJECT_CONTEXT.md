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
| account1 契約終了 | **2026-05-22**（期限注意） |
| 2号フリートは account2 で稼働中 |  |

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
