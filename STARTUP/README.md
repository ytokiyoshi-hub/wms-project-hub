# STARTUP — 復帰手順サマリ

WMS プロジェクトへの復帰時に最初に読むディレクトリ。

## 復帰手順

1. **claude-agents を git pull**
   ```
   cd ~/github/claude-agents && git pull
   ```

2. **自分の号向けファイルを読む**
   - `STARTUP/1GO.md`（1号）
   - `STARTUP/2GO.md`（2号）
   - `STARTUP/3GO.md`（3号）

3. **PROJECT_CONTEXT.md を読む**
   - WMS固有の案件情報・リポジトリパス・Supabase接続先・runner構成

4. **役割宣言して待機**

## ファイル構成

| ファイル | 目的 |
|---------|------|
| README.md | このファイル（復帰手順サマリ） |
| PROJECT_CONTEXT.md | WMS固有情報を集約 |
| 1GO.md | 1号（まーちゃん）復帰手順 |
| 2GO.md | 2号（実装プロト）復帰手順 |
| 3GO.md | 3号（ヒアリング整理）復帰手順 |
