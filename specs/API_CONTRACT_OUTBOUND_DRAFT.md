# API 契約叩き台 — 出庫フロー（中津さん向け）

最終更新: 2026-05-28 / 作成: 1号（まーちゃん）  
**送付タイミング**: MVP 2週目（出庫フロー動作確認後）  
親計画: `specs/WMS_TEST2_EVOLUTION_PLAN.md`

---

## 0. 文書の目的

wms-test2 MVP（Express + Supabase Postgres）で動かす**出庫フロー（ピック→検品→梱包→出荷→積込→引渡）の API契約**を、中津さんが本番実装する際の **叩き台** として整理。

**現状**: wms-test2 内に Express で実装済み（server/index.js）。本番では中津さんが Supabase RPC / API として再実装する想定。

**前提**:
- wms-test2 の migrations/001-003 に Postgres スキーマ + RLS policy 完備済み
- 19シナリオ（runner.js）で動作検証済み
- 中津さんの本番実装と接続点は「MVP完了後の擦り合わせ」で決定

---

## 1. 出庫フロー業務シナリオ（9ステップ）

```
Step 1: 出荷指示一覧取得    → GET  /api/shipment-orders
Step 2: 引当・ウェーブ生成   → POST /api/shipment-orders/:id/allocate
                            → POST /api/shipment-waves
Step 3: ピッキング指示取得   → GET  /api/shipment-orders/:id
Step 4: ピック実績登録      → POST /api/picking-tasks/:id/pick
Step 5: 検品（差異処理）     → POST /api/packings (inspected_at記録)
Step 6: 梱包実績登録        → POST /api/packings
Step 7: 出荷確定           → POST /api/shipment-orders/:id/ship
Step 8: 積込              → POST /api/loadings, /load-order
Step 9: 引渡              → POST /api/loadings/:id/handover
```

---

## 2. 主要APIエンドポイント一覧

### 2-1. 出荷指示（shipment_orders）
| # | Method | Path | 機能 | RLS |
|---|--------|------|------|-----|
| 1 | GET | `/api/shipment-orders` | 一覧（status別集計付き） | owner_code = current OR admin/worker |
| 2 | GET | `/api/shipment-orders/:id` | 詳細（lines + tasks） | 同上 |
| 3 | POST | `/api/shipment-orders` | 作成 | 同上 |
| 4 | DELETE | `/api/shipment-orders/:id` | 削除（planned状態のみ） | 同上 |
| 5 | POST | `/api/shipment-orders/:id/allocate` | 引当実行 | 同上 |
| 6 | POST | `/api/shipment-orders/:id/cancel-allocation` | 引当取消 | 同上 |
| 7 | POST | `/api/shipment-orders/:id/ship` | 出荷確定 | 同上 |
| 8 | GET | `/api/shipment-actuals` | 実績一覧 | 同上 |
| 9 | GET | `/api/loadable-orders` | 積込可能SO一覧 | 同上 |

### 2-2. ウェーブ（shipment_waves）
| # | Method | Path | 機能 |
|---|--------|------|------|
| 10 | GET | `/api/shipment-waves` | ウェーブ一覧 |
| 11 | POST | `/api/shipment-waves` | ウェーブ作成 |

### 2-3. ピッキング（picking_tasks）
| # | Method | Path | 機能 |
|---|--------|------|------|
| 12 | GET | `/api/picking-tasks/pending` | ピック待ち一覧 |
| 13 | POST | `/api/picking-tasks/:id/pick` | ピック実績登録（在庫減算） |

### 2-4. 梱包（shipment_packings + packing_materials）
| # | Method | Path | 機能 |
|---|--------|------|------|
| 14 | GET | `/api/packings` | 梱包実績一覧 |
| 15 | POST | `/api/packings` | 梱包実績登録（材在庫減算） |
| 16-22 | * | `/api/packing-rules`, `/api/packing-materials` | ロジック設定・材マスタCRUD |

### 2-5. 積込・引渡（loadings + loading_orders）
| # | Method | Path | 機能 |
|---|--------|------|------|
| 23 | GET | `/api/loadings` | 積込便一覧 |
| 24 | GET | `/api/loadings/:id` | 積込便詳細 |
| 25 | POST | `/api/loadings` | 積込便作成 |
| 26 | POST | `/api/loadings/:id/load-order` | 積込実績登録（1件ずつ） |
| 27 | POST | `/api/loadings/:id/handover` | 引渡完了 |

→ 詳細リクエスト/レスポンスは [wms-test2/server/index.js](https://github.com/ytokiyoshi-hub/wms-test2/blob/main/server/index.js) を参照（2,668行・実コードで仕様確定）

---

## 3. データモデル要点

主要テーブル7種:
- `shipment_orders` — 出荷指示
- `shipment_order_lines` — 出荷明細
- `picking_tasks` — ピッキングタスク
- `shipment_packings` — 梱包実績
- `loadings` — 積込便
- `loading_orders` — 積込対象
- `packing_materials` — 梱包材マスタ

詳細スキーマ: [wms-test2/migrations/001_initial_schema.sql](https://github.com/ytokiyoshi-hub/wms-test2/blob/main/migrations/001_initial_schema.sql) 参照（671行・Postgres完全互換）

RLS policy: [wms-test2/migrations/002_rls_policies.sql](https://github.com/ytokiyoshi-hub/wms-test2/blob/main/migrations/002_rls_policies.sql) 参照（300行）

---

## 4. 中津さんと議論したい論点

### 4-1. RLS 運用設計
- **owner_clerk が複数荷主アクセス可か？** → JWT claims に `owner_codes` (配列) を渡すか、relationship テーブルか
- **HT作業者の権限範囲** → 全荷主 vs 特定荷主専任？ `employee_owner_assignment` テーブル必要か
- **loadings の RLS** → 現状 `is_admin_or_worker` のみ。EXISTS policy 評価コストの本番影響

### 4-2. パフォーマンス（本番スケール）
既に解消済み:
- shipment_orders 一覧の N+1 → JOIN + GROUP BY（36s → 数百ms）
- インデックス `shipment_order_lines(order_id)`, `inbound_schedule_lines(schedule_id)` 追加済

本番で想定される問題:
- 50k SO × 平均10明細 / RLS EXISTS 評価コスト → 複合インデックス `(scheduled_date, status, owner_code)` 必要か
- 引当時の picking_tasks 一括 INSERT（100〜1000件/SO）のトランザクション境界
- packing_materials.stock_qty の競合更新 → 楽観的ロック (version) vs 悲観的ロック (FOR UPDATE)
- inventory_transactions の月100万件超 → パーティション/アーカイブ戦略

### 4-3. トランザクション境界
- SQLite `db.transaction()` → Supabase **RPC (PL/pgSQL function)** への変換
- `shipment_orders` + `shipment_order_lines` + `picking_tasks` 3テーブル一括更新の rollback
- 在庫ロック（一斉棚卸し）との相互作用 → `checkInventoryLock` middleware の RPC化

### 4-4. JWT claims 設計
```json
{
  "sub": "user@company.com",
  "role": "wh_admin" | "ht_worker" | "owner_clerk",
  "owner_code": "MK001",
  "iss": "https://auth.wms.example.com",
  "aud": "wms-api"
}
```
論点:
- 複数荷主アクセス時の `owner_codes` 配列対応
- ロール細分化（picker/packer/loader/qa_inspector）の必要性
- トークンリフレッシュ戦略
- service role（data-generator用）の可視性管理

### 4-5. 削除・キャンセル設計
- **soft delete vs hard delete**: 監査ログ要件から `deleted_at` 導入を検討
- **部分取消**: 出荷指示の一部明細キャンセル対応するか
- **積込便からの削除**: loading_orders に紐付くSO削除時の動作
- **返品フロー（v2）との統合**: purpose_type='return_to_supplier' を return_orders と統合か分離か

---

## 5. 本番実装の概算工数

| Phase | 内容 | 工数 |
|-------|------|------|
| **Phase 1** | 出荷指示 + ピッキング + 在庫連動 + 棚卸ロック | 60h (2週) |
| **Phase 2** | 梱包 + 出荷確定 + packing_materials | 40h (1.5週) |
| **Phase 3** | 積込・引渡 + 全フロー連動 | 40h (1.5週) |
| **Phase 4** | RLS完全適用 + 性能最適化 + ドキュメント | 30h (随時) |
| **合計** | フル実装 | **約168h ≈ 4週間（1名フル）** |

---

## 6. 実装優先度・リスクマトリクス

| 項目 | 優先度 | リスク | 対策 |
|------|--------|--------|------|
| RLS Policy 適用 | 高 | 荷主データ混在 | Phase 1 後の owner 隔離テスト |
| Optimistic Lock | 中 | 並行更新不整合 | picking-tasks/:id/pick の冪等性テスト |
| 棚卸しロック整合 | 高 | 棚卸し中の出庫実行 | RPC 化で原子性保証 |
| 在庫トランザクション整合 | 高 | 在庫不足/超過 | inventory_transactions ログ + 監査 |
| パフォーマンス（50k SO） | 中 | EXISTS policy コスト | 本番テストで RLS cost 計測 |

---

## 7. 中津さんへの依頼事項

### 7-1. レビュー希望
- 本ドラフトの API契約全体
- 議論論点（4-1〜4-5）への中津さんの見解
- 概算工数の妥当性

### 7-2. 本番接続の段取り
MVP 完了後（2週間後）に：
- 本番 Supabase プロジェクトの URL / Key 共有
- MVP用 Supabase からのデータ移行 or 共存方針
- RLS policy の本番適用タイミング
- 本番ユーザー（auth.users）の発行方針

### 7-3. 並行検討
- DB-4 マルチテナント設計（CONSULTATION_DB4_MULTITENANCY.md・回答待ち）
- DB-1〜DB-5（CONSULTATION_DB1_TO_DB5.md・回答待ち）

---

## 8. 関連ファイル

- `~/github/wms-test2/server/index.js` — Express実装（2,668行・164エンドポイント）
- `~/github/wms-test2/migrations/001_initial_schema.sql` — Postgres スキーマ（671行）
- `~/github/wms-test2/migrations/002_rls_policies.sql` — RLS policy（300行）
- `~/github/wms-test2/test-runner/scenarios/` — 43本シナリオ（19本PASS済）
- `~/github/wms-test2/docs/PHASE9_RLS_PREP.md` — RLS設計メモ
- `specs/PRODUCTION_HANDOFF_PLAN.md` — 中津さん本番実装段取り
- `specs/WMS_TEST2_EVOLUTION_PLAN.md` — 本MVP計画
- `specs/TRACK_A_KICKOFF_TASKS.md` — Track A 起票プラン
- `specs/TRACK_B_MVP_TASKS.md` — Track B 画面別タスク

---

**作成: 2026-05-28 / 1号（まーちゃん） — 本ドラフトはMVP 2週目に中津さんへ送付予定**
