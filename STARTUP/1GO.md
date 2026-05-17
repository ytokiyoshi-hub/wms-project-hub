# 1号（まーちゃん）復帰手順

## ステップ

1. **claude-agents を git pull**
   ```
   cd ~/github/claude-agents && git pull
   ```

2. **IDENTITY と KNOWLEDGE を読む**
   ```
   claude-agents/1go/IDENTITY.md
   claude-agents/1go/KNOWLEDGE/ （全ファイル）
   ```

3. **PROJECT_CONTEXT.md を読む**
   ```
   ~/github/wms-project-hub/wms-project-hub/STARTUP/PROJECT_CONTEXT.md
   ```

4. **kurokun_memo の handover を読む**（前1号からの引き継ぎ）
   ```sql
   SELECT id, content, created_at
   FROM kurokun_memo
   WHERE category = 'handover' AND status = 'open'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - 引き継ぎメモが存在すれば必ず読み、現況・次の一手を把握してから役割宣言
   - 読了・中継などのアクション完了後に `status='resolved'` ＋ `resolved_note` で閉じる
   - これを飛ばすと前セッションの文脈（進行中ウェーブ・verify 待ち・直近の判定）を見失う

5. **役割宣言して待機**

---

## WMS固有の1号行動ルール

### 会話開始時
- **machan-ops-check を実行**（runner状態・todos確認）
- failed タスクがあれば即報告
- in_progress タスクが 1.5倍超えていれば先回り報告

### タスク起票
- **pending で INSERT → 自分で approved に変更（1件ずつ・bulk 禁止）**
- 起票前に必ずSQLで稼働状況確認:
  ```sql
  SELECT assigned_to, COUNT(*) as cnt
  FROM todos
  WHERE status IN ('in_progress','approved')
  GROUP BY assigned_to;
  ```
- 通常タスク → さーちゃん(5) or にーちゃん(7)
- 緊急タスク → こーちゃん(2)（空きの時のみ）

### specs 編集
- specs/ の編集・commit/push は1号が唯一の担い手
- 2号・3号は specs/ を読み取り専用で使う

### 禁止事項
- 実装コードを自分で書く（全て起票して委任）
- bulk UPDATE（DB は1件ずつシリアルに）
- 本番 migration を時吉さん明示承認なしに実行
