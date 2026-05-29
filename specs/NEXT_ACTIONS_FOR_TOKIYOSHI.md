# 時吉さん次アクション — ワンクリック手順書

作成: 2026-05-29 / 1号（まーちゃん）  
目的: 残3アクションを最短手順で実行可能にする

---

## 現状

test2-mirror は「触れる本番品質」レベル到達:
- 公開URL: https://ytokiyoshi-hub.github.io/wms-project-hub/test2-mirror/
- 479画面 errors 0
- 業務シナリオ14ステップ通し成功
- データ: 出荷指示21k件 + 業務データ拡充済

残るは時吉さんアクション3件。

---

## アクション1: Supabase プロジェクト作成（10分）

### 手順
1. https://supabase.com/dashboard を開く
2. 右上「New Project」クリック
3. 設定:
   - Project name: `marki-wms-mvp`
   - Database password: 任意（記録）
   - Region: `Northeast Asia (Tokyo)`
   - Plan: Free
4. 「Create new project」クリック（プロビジョニング 2分待ち）
5. 完了後、Settings → API から以下を控える:
   - Project URL（`https://xxxxx.supabase.co`）
   - anon public key
   - service_role secret key

---

## アクション2: Track A 起票済タスク approve（5分）

### Supabase ダッシュボード → SQL Editor で実行

```sql
-- A1から順次approve
UPDATE todos SET status='approved' WHERE id=1029;  -- A1: Supabase準備
```

A1完了後、 こーちゃんが次タスクを取れるよう順次approve:
```sql
UPDATE todos SET status='approved' WHERE id IN (1030, 1031, 1032);  -- A2-A4
```

A4完了後、Track B も一括approve可能:
```sql
UPDATE todos SET status='approved' WHERE id BETWEEN 1037 AND 1060;
```

### approve 順序の参考
- A1 → A2（さーちゃん migration）→ A3, A4（並列）→ A5 → A6（にーちゃん検証）→ A7, A8（並列）

---

## アクション3: 中津さんへ状況連絡送付（5分）

### 送付内容
`specs/MESSAGE_TO_NAKATSU_2026-05-28_MVP_LAUNCH.md` の本文をコピー → 中津さんに送付

要点だけ伝えるなら以下のコピペでOK:

```
中津さん

wms-test2 を本番品質に進化させる計画が動き出しました。
公開URL: https://ytokiyoshi-hub.github.io/wms-project-hub/test2-mirror/

達成事項:
- 全479画面 Pages 200動作
- 業務シナリオ14ステップ通し成功
- データ: 出荷指示21k件 BULK / 商品マスタ / ASN / 配送便 / KPI / 月次請求

次の段階で中津さんへ依頼:
1. 既存相談書（CONSULTATION_DB4_MULTITENANCY / DB1_TO_DB5）の業界知見コメント
2. MVP完了タイミング（2週間後）の本番DB接続擦り合わせ
3. MVP 2週目に送るAPI契約叩き台のレビュー

詳細: specs/MESSAGE_TO_NAKATSU_2026-05-28_MVP_LAUNCH.md
```

送付方法は時吉さん判断（メール / Slack / 別経路）。LINE は当面不使用。

---

## アクション4（オプション）: 進捗監視

approve後、runner 消化状況を確認:

### Supabase SQL Editor
```sql
SELECT
  CASE WHEN id BETWEEN 1029 AND 1036 THEN 'Track A' ELSE 'Track B' END as track,
  status,
  COUNT(*) as count
FROM todos
WHERE id BETWEEN 1029 AND 1060
GROUP BY 1, 2
ORDER BY 1, 2;
```

### runner ログ確認
```bash
LOG_DIR=~/github/shacho-shitsu/worker/logs
for f in kochan-runner sachan-runner nichan-runner; do
  echo "=== $f ===" 
  tail -5 "$LOG_DIR/$f.log"
done
```

---

## 困ったら

- test2-mirror 動作異常 → ブラウザで Cmd+Shift+R 強制リロード
- runner動かない → `~/github/shacho-shitsu/worker/runner-mgr status` で状態確認
- それ以外 → 私（次セッションの1号）に相談 / specs/SELF_REFLECTION_STOP_PATTERN.md を見れば対策F-H で進められる

---

**作成: 2026-05-29 / 1号（まーちゃん）**
