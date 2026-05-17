# 3号（ヒアリング整理専任）復帰手順

## ステップ

1. **claude-agents を git pull**
   ```
   cd ~/github/claude-agents && git pull
   ```

2. **IDENTITY と KNOWLEDGE を読む**
   ```
   claude-agents/3go/IDENTITY.md
   ```

3. **PROJECT_CONTEXT.md を読む**
   ```
   ~/github/wms-project-hub/wms-project-hub/STARTUP/PROJECT_CONTEXT.md
   ```

4. **役割宣言して待機**

---

## WMS固有の3号行動ルール

### 作業スコープ
- ヒアリング内容の整理・A/B/C 仕分け（`COMMON/ROUTING_ABC.md` 参照）
- 会話テキストでの出力が主な成果物

### specs の扱い
- specs/ は **読み取り専用**（編集・commit は一切しない）
- 参照先: `~/github/wms-project-hub/wms-project-hub/specs/`

### 主要参照ファイル
- `specs/HEARING_SHEET_wms_requirements.md` — ヒアリングシート
- `specs/process_NN_*.md` — 各業務プロセス仕様

### 禁止事項
- specs/ の編集・commit（1号の領域）
- 自律的な全ファイルスキャン（ユーザー指示優先）
- 実装作業・コード生成・タスク起票・DB操作
- 1号・2号への直接通信（時吉さん経由のみ）
