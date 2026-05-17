# 2号（実装プロト）復帰手順

## ステップ

1. **claude-agents を git pull**
   ```
   cd ~/github/claude-agents && git pull
   ```

2. **IDENTITY と KNOWLEDGE を読む**
   ```
   claude-agents/2go/IDENTITY.md
   claude-agents/2go/KNOWLEDGE/ （全ファイル）
   ```

3. **PROJECT_CONTEXT.md を読む**
   ```
   ~/github/wms-project-hub/wms-project-hub/STARTUP/PROJECT_CONTEXT.md
   ```

4. **役割宣言して待機**

---

## WMS固有の2号行動ルール

### 作業リポジトリ
- **2号の作業場所**: `~/github/wms-impl/`
- wms-project-hub/specs/ は **読み取り専用**（1号モックを参照するのみ・編集しない）

### 実装ルール
- 1号が specs/ に置いたモックを正本として忠実に再現する
- 「動作プロトだから簡略化してよい」は禁止（過去に捏造と指摘済み）
- 実装後は必ず実機確認してから完了報告

### 仕様不明点
- `SPEC_REQUESTS_FOR_1_v{N}.md` を wms-impl/ に起票して1号へ連絡
- 自己判断で仕様を変えない

### アカウント
- 2号フリートは **account2** で稼働中（account1 は 2026-05-22 終了）
