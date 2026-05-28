# Track B 画面別タスクリスト — wms-test2 本番品質MVP 出庫フロー

最終更新: 2026-05-28 / 作成: 1号（まーちゃん）  
親計画: `specs/WMS_TEST2_EVOLUTION_PLAN.md` / `specs/TRACK_A_KICKOFF_TASKS.md`

---

## 目的

MVP 出庫フロー（ピック→検品→梱包→出荷→積込→引渡）の**画面別作業タスク**を 1画面=1タスクで分解。Track A 骨格構築（Supabase化＋認証）と並行で進めるか、Track A 完了後に着手する。

**重要な前提（Track Cで判明）**:
- wms-test2 は **HANDOFF.md記載「421画面に統一構造適用済」** → ほとんどの画面は修正不要
- MVPで本当に必要なのは「Supabase化に伴う API応答確認 / RLS分離検証 / HT実機性能確認」
- **新規実装は最小限**、既存画面の動作保証が中心

---

## 1. wms-test2 全画面構成（479ファイル）

### PC側（451画面）
| カテゴリ | パス | 画面数 |
|---|---|---|
| Master | pc/master | 130 |
| Inventory | pc/inventory | 77 |
| Outbound | pc/outbound | 75 |
| Inbound | pc/inbound | 37 |
| Reports | pc/reports | 18 |
| Audit | pc/audit | 16 |
| Integration | pc/integration | 14 |
| Workforce | pc/workforce | 11 |
| Billing | pc/billing | 10 |
| Returns | pc/returns | 8 |
| Dashboard | pc/dashboard | 8 |
| Stocktake | pc/stocktake | 7 |
| Prints | pc/prints | 6 |
| その他 | settings/help/calendars/notifications | 13 |

### HT側（35画面）
| カテゴリ | パス | 画面数 |
|---|---|---|
| Inspect | ht/inspect | 6 |
| Pick | ht/pick | 5 |
| Returns | ht/returns | 5 |
| Owner | ht/owner | 4 |
| Putaway | ht/putaway | 3 |
| Packing | ht/packing | 2 |
| Loading | ht/loading | 2 |
| Handover | ht/handover | 2 |
| その他 | replenish/move/status/stocktake/login/menu | 6 |

### その他（13画面）: App / Print / Index

---

## 2. MVP最優先 — 出庫フロー画面別タスク（24件）

### 2-1. PC側出庫（7件）

| # | task_id | 画面パス | 機能 | 確認・修正想定 | 優先度 |
|---|---------|---------|------|---------------|--------|
| 1 | T-PC-OB-001 | pc/outbound/orders.html | W-301 出荷指示一覧 | 状態別集計の精度確認 | P0 |
| 2 | T-PC-OB-002 | pc/outbound/register.html | W-302 出荷指示登録 | — | P0 |
| 3 | T-PC-OB-003 | pc/outbound/allocate.html | 引当処理（FIFO） | preview ↔ 実行結果の一致 | P0 |
| 4 | T-PC-OB-004 | pc/outbound/wave_plan.html | ウェーブ計画 | 波生成粒度の確認 | P1 |
| 5 | T-PC-OB-005 | pc/outbound/packing_summary.html | 梱包実績集計 | リアルタイム集計確認 | P0 |
| 6 | T-PC-OB-006 | pc/outbound/loading.html | W-307 積込管理 | 状態遷移確認 | P0 |
| 7 | T-PC-OB-007 | pc/outbound/handover.html | W-309 引渡管理 | 監査ログ記録確認 | P0 |

### 2-2. HT側出庫（17件）

#### HT ピックフロー（5件 / HT-804）
| # | task_id | 画面 | 機能 | 確認 | 優先度 |
|---|---------|------|------|------|--------|
| 8 | T-HT-PK-001 | ht/pick/wave.html | ウェーブ受取 | 読み込み速度 | P0 |
| 9 | T-HT-PK-002 | ht/pick/scan.html | ロケ→SKUスキャン | スキャナ応答 | P0 |
| 10 | T-HT-PK-003 | ht/pick/list.html | タスク一覧 | 即時更新 | P1 |
| 11 | T-HT-PK-004 | ht/pick/done.html | ピック完了 | 状態遷移 | P0 |
| 12 | T-HT-PK-005 | ht/pick/error.html | エラーハンドリング | 復帰フロー | P1 |

#### HT 検品フロー（6件 / HT-403）
| # | task_id | 画面 | 機能 | 確認 | 優先度 |
|---|---------|------|------|------|--------|
| 13 | T-HT-IB-001 | ht/inspect/asn.html | ASN選択 | 読み込み速度 | P0 |
| 14 | T-HT-IB-002 | ht/inspect/scan.html | 3点スキャン | 応答性能 | P0 |
| 15 | T-HT-IB-003 | ht/inspect/done.html | 完了確認 | 棚入タスク生成 | P0 |
| 16 | T-HT-IB-004 | ht/inspect/discrepancy.html | 検品差異処理 | 在庫反映 | P0 |
| 17 | T-HT-IB-005 | ht/inspect/lot_error.html | ロット異常 | 状態遷移 | P1 |
| 18 | T-HT-IB-006 | ht/inspect/sign.html | 署名検品 | デジタル署名 | P1 |

#### HT 梱包・積込・引渡（6件）
| # | task_id | 画面 | 機能 | 確認 | 優先度 |
|---|---------|------|------|------|--------|
| 19 | T-HT-PK-006 | ht/packing/order.html | 出荷No選択 | 待ちリスト | P0 |
| 20 | T-HT-PK-007 | ht/packing/scan.html | SKU→梱包スキャン | 連続スキャン性能 | P0 |
| 21 | T-HT-LD-001 | ht/loading/scan.html | 積込スキャン | LPN応答 | P0 |
| 22 | T-HT-LD-002 | ht/loading/confirm.html | 積込確認 | 引渡遷移 | P0 |
| 23 | T-HT-HO-001 | ht/handover/lane.html | レーン選択 | 割付正確性 | P0 |
| 24 | T-HT-HO-002 | ht/handover/confirm.html | 引渡確定 | 監査ログ | P0 |

---

## 3. MVP起票対象 集計

| 優先度 | 件数 | 内容 |
|--------|------|------|
| P0（必須） | 16 | PC 7 + HT 9（コアフロー） |
| P1（欲しい） | 8 | エラー / 一覧 / 補助 |
| **MVP起票総数** | **24** | |

---

## 4. 各タスクの起票テンプレート

```json
{
  "title": "T-PC-OB-001: pc/outbound/orders.html 動作確認・性能調整",
  "description": "状況: Supabase Postgres移行後の動作確認。具体作業: ①Supabase接続でAPI応答確認 ②状態別集計の精度検証 ③1年BULK 21k件で表示性能測定（SLA 1秒以内）。完了条件: 19シナリオの該当部分がPASS。",
  "assigned_to": 2,
  "status": "approved",
  "tags": ["wms-test2-evolution", "track-b-mvp", "outbound", "p0"],
  "metadata": {
    "evolution_phase": "MVP",
    "track": "B",
    "task_id": "T-PC-OB-001",
    "screen_path": "pc/outbound/orders.html",
    "expected_hours": 2,
    "depends_on": ["A4-adapter-切替"]
  }
}
```

---

## 5. 注意事項

### Track A との依存関係
- **すべての Track B タスクは Track A の A4（adapter切替）+ A5（認証統合）完了後に着手可能**
- それ以前に着手しても、API がまだSQLite ベースなので確認できない
- **推奨**: Track A 完了 → Track B 並列起票・並列消化

### 既存資産の活用
- HANDOFF.md記載「421画面に統一構造適用済」を信用 → ほとんど触らない
- 修正が必要そうに見える箇所も、まず Supabase 環境で動作確認 → 不具合があった場合のみ修正

### 壊れている画面はゼロ
- Explore調査で HTML構文エラー / リンク切れ / サイズ異常 すべて 0件 確認済み
- → 既存の482画面はそのまま動く前提

### スコープ外（ベータ以降に振る）
- PC outbound 残り 68画面（wave詳細・配送計画・ETA・キャンセル等）
- PC 入庫 37画面（HT検品フローはMVP対象、PC側はベータ）
- PC マスタ130画面（全て構造統一済・データ調整のみ）
- HT その他 18画面

---

## 6. 次のアクション

1. Track A 着手・完了（1-1.5週）
2. Track A の A4/A5 完了で API が Supabase 経由で動くようになる
3. このリストの **P0 16タスクを runner（こーちゃん/にーちゃん）に分担起票**
4. シナリオ実行（scn-day-flow-001 / scn-core-outbound-001）で全フロー貫通確認
5. P1 8タスクは並行 or MVP公開後ベータで

---

**作成: 2026-05-28 / 1号（まーちゃん）**
