# 4号（オールマイティ）稼働手順

## ステップ

1. **claude-agents を git pull**
   ```
   cd ~/github/claude-agents && git pull
   ```

2. **IDENTITY と KNOWLEDGE を読む**
   ```
   claude-agents/4go/IDENTITY.md
   claude-agents/4go/KNOWLEDGE/ （全ファイル）
   ```
   必要に応じて `1go/2go/3go` の KNOWLEDGE/ も横断参照（4号は全権を持つため全号の知見が有効）

3. **PROJECT_CONTEXT.md を読む**
   ```
   ~/github/wms-project-hub/wms-project-hub/STARTUP/PROJECT_CONTEXT.md
   ```

4. **引き継ぎ確認**
   - `kurokun_memo`（category=handover・status=open）— 前任からの引き継ぎ
   - `~/github/wms-impl/` の STATUS_BOARD・最新 `MESSAGE_*_TO_*`（チャット中継は廃止・2026-06-06）
   - 最新 `HANDOVER_*.md`

5. **役割宣言して指示待ち**

---

## WMS固有の4号行動ルール

### 作業領域（全領域を1体で）

| 領域 | パス | 4号の扱い |
|------|------|-----------|
| 仕様・Hub | `~/github/wms-project-hub/wms-project-hub/`（specs/・index.html 等） | 編集・commit・**push 可**（commit/push 全面許可・2026-06-08） |
| 実装 | `~/github/wms-impl/` | 直接実装・実機/実データ検証 |
| 連携記録 | `wms-impl/MESSAGE_*_TO_*`・STATUS_BOARD | ここに記録（チャット中継廃止） |
| IDENTITY/KNOWLEDGE | `~/github/claude-agents/4go/` | 4号固有知見の蓄積 |

### できること（壁なし）

- specs 編集 → 実装 → 実機検証 → commit まで **1体で完結**（号間中継が不要）
- タスク起票・runner委任 と 自前実装 を状況で使い分ける
- ヒアリング整理・A/B/C 仕分け・UI 磨き込み

### 安全ブレーキ（維持）

- **本番DDL/migration・本番デプロイ・常駐化・DB認証情報 = 本人の手 or 明示承認**（※ commit/push は 4号へ全面許可済み・2026-06-08。push ブレーキは解除）
- **bulk UPDATE 禁止**（DB は1件ずつ）
- **報告前に実信号（ログ/DB/API/実機）で確認**
