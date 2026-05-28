# test2-mirror 動作状態 進捗記録 — 2026-05-29

作成: 2026-05-29 / 1号（まーちゃん）  
目的: 後続セッションが「どこまで動いてるか」を読めば把握できる状態にする。

---

## 公開URL

🎯 **https://ytokiyoshi-hub.github.io/wms-project-hub/test2-mirror/**

---

## 現在の到達点

### サイドバー（業界標準準拠）
- 459項目 → **28項目 / 6カテゴリ / 2階層**
- 業界標準（ロジザード/SAP EWM/Manhattan/Oracle/トーマス/ci.Himalayas/LOGILESS/Infor）8製品調査に基づく
- 業務フロー順: 入荷→出荷→在庫→棚卸→マスタ→設定
- 詳細: `specs/WMS_SIDEBAR_STANDARD.md`

### 業務フロー動作確認（40画面・errors=0）

#### 出庫フロー 12画面
```
orders → allocate → pick/wave → pick/scan → pick/done →
packing/order → packing/scan → loading/scan → loading/confirm →
handover/lane → handover/confirm → outbound/handover
```

#### 入庫フロー 11画面
```
plans → register → actuals → discrepancy → putaway →
inspect/asn → inspect/scan → inspect/done →
putaway/instructions → putaway/location → putaway/done
```

#### 在庫/棚卸/マスタ/設定 17画面
```
inventory: kpi / lot_serial / adjust / stock_alert / layout_a
stocktake: cycle_plan / cycle_result / detail / ht/count
master: products / locations / customers / carriers / users
settings: system / audit/log / integration/edi
```

### データ表示確認（実データ）
- 出荷指示: **21122件中100件表示**（1年BULK）
- 入荷予定: 4件
- ASN一覧: アパレル雑貨/IN-26051901等
- 商品マスタ: SKU-MK001-001 シャンプー、SKU-AP001-001 Tシャツ等
- ピック対象: ウェーブWV-2605-003、FEFO対応、賞味期限表示
- 配送便: LD-260601-01 ヤマト運輸 / LD-260601-02 佐川急便
- 監査ログ: WARN/INFO アラート、2026-06-01 14:35

### 技術仕組み

#### bootstrap inline（全479 HTML の `<head>` 直後）
- `<base href>` 動的設定（Pages / ローカル両対応）
- fetch hook で `/api/X` → `<base>/api/X.json` 振替
- 動的URL（`/api/X/123`, `/api/X?q=Y`, `/api/X/Y/action`）も 親.json[0] にfallback
- POST/PUT/DELETE は `{ok:true, mock:true}` で 200応答
- error logger: `localStorage.__wms_errs` に集積

#### 静的JSON（30本）
- マスタ: owners / products / locations / customers / carriers / warehouses / system-users
- 出荷: shipment-orders (9.4MB BULK) / shipment-actuals / loadings / loadable-orders / packings / packing-materials / carrier-routes
- 入荷: inbound-actuals (5.5MB) / inbound-schedules
- 在庫: inventory / inventory-snapshots / inventory-adjustments / inventory/lots / inventory/move / inventory/transactions
- 棚卸: stocktake-sessions
- 出庫詳細: picking-tasks/pending（手動拡充10件）
- 入庫詳細: putaway-instructions / putaway/pending / discrepancies
- 返品/請求: returns / billing-snapshots
- マスタ管理: csv-format-masters

### Pages 反映
- 全479 HTML curl 200確認
- すべての主要画面で fetch hook 動作
- GitHub Actions deploy success

---

## 関連ドキュメント

- `specs/WMS_TEST2_EVOLUTION_PLAN.md` — MVP〜リリース全体計画
- `specs/WMS_SIDEBAR_STANDARD.md` — 業界標準サイドバー調査
- `specs/SELF_REFLECTION_STOP_PATTERN.md` — 1号の止まる癖と対策
- `specs/TRACK_A_KICKOFF_TASKS.md` — Track A 起票プラン
- `specs/TRACK_B_MVP_TASKS.md` — Track B 24タスク
- `specs/API_CONTRACT_OUTBOUND_DRAFT.md` — 中津さん向けAPI契約
- `specs/MVP_LAUNCH_RUNBOOK.md` — MVP着手手順

---

## 次の方向候補

1. **データ拡充** — picking_tasks pending を 30件、shipment-orders で picking状態のものを増やす
2. **業務クリックチェイン** — 実際にF1ボタンクリック→次画面 を preview_click で連続実行
3. **HT画面のスキャナシミュレーション** — バーコード入力動作を mock
4. **Track A 起票済タスク #1029-1036 の approve** — 時吉さんアクションで runner 消化開始
5. **Supabase接続準備** — wms-test2 リポへ supabase-js 追加（時吉さん明示承認後）

---

**作成: 2026-05-29 / 1号（まーちゃん）**  
**継続セッション向け**: このドキュメントを読めば現状把握可能。
