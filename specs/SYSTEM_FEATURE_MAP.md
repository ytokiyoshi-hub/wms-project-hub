# WMS 機能体系マップ（System Feature Map）

最終更新: 2026-05-18 / 作成: 1号（まーちゃん）/ **v1**（テストサイト2 318画面時点・~700画面まで拡大予定）

---

## 0. このマップの目的

~700規模に向かう画面群を「並べただけの山」にせず**構造化**するための地図。整理の3軸：

1. **業務フロー軸（背骨）** — 倉庫が実際に動く順（マスタ→入荷→在庫→出荷→…→請求）に画面をぶら下げる
2. **ロール軸（層）** — PC(管理者) / HT(現場作業者) / App(従業員) / Portal(荷主) で層を分ける
3. **コア／拡張軸（階層）** — 確定136機能＝コア、大手3PL対応の追加＝拡張

このマップの役割：(1) ナビの背骨 (2) シナリオテストのカバレッジ表 (3) 顧客に見せるシステム全体像 (4) **WMS Project Hub のナビゲーション構造**。

**画面の実体**はテストサイト2（`wms-test2`・port 8778・~700画面予定）。本マップはその索引。全画面の実リストは `wms-impl/INVENTORY_PHASE1.md`。

---

## 1. 全体像 — 13業務領域（背骨）

| # | 業務領域 | PC | HT | App | Portal | 確定機能群 |
|---|---|---:|---:|---:|---:|---|
| 1 | マスタ管理（基盤） | 81 | — | — | — | 全マスタ |
| 2 | 入荷 | 24 | 11 | — | — | 入荷予定・検品・格納 |
| 3 | 在庫 | 40 | 4 | — | — | DB-1〜5 / B在庫ステータス / P補充 |
| 4 | 出荷（引当〜引渡） | 44 | 12 | — | — | A出庫 / C並行 / D積込 / F引渡 / S梱包 |
| 5 | 配送振分 | （出荷に内包） | — | — | — | Q配送業者自動振分 |
| 6 | 棚卸 | 6 | 1 | — | — | 棚卸5モード |
| 7 | 返品 | 7 | 5 | — | — | 返品処理（process_10） |
| 8 | 請求 | 10 | — | — | （Portal） | N明細 / M課金詳細 / CA-1賃率 |
| 9 | 人員・シフト | 9 | — | 5 | — | K人員16件 |
| 10 | レポート・分析 | 18 | — | — | （Portal） | O収支・生産性 |
| 11 | 外部連携 | 10 | — | — | — | G実績送信 / LK外部連携 |
| 12 | 荷主ポータル | — | — | — | 9 | H-11 荷主ポータル |
| 13 | システム管理 | 25 | — | — | — | T権限 / 印刷帳票 |

合計：テストサイト2 **318画面**（HT37 / PC274 / App5 / top2）＋ 荷主ポータル **9画面**（`wms-impl/public/portal/`・完成済）。

---

## 2. 領域別マップ

各領域：業務での位置づけ ／ コア（確定136機能対応） ／ 大手3PL拡張。

### 1. マスタ管理（基盤）— PC 81
すべての業務の前提データ。
- **コア（確定マスタ）**：owners / products / locations / location_types / warehouses / customers / carriers / regions / routes / drivers / vehicles / units / billing_units / materials / packing_rules / replenishment_rules / adjustment_reasons / rates / picking_areas / status / task_types / users / permissions / role_definitions
- **大手3PL拡張**：container_types / hazmat / temperature_zones / sla_definitions / owner_contracts / owner_branding / owner_dashboards / tariff_zones / pricing_tiers / customer_tariffs / cost_centers / exception_routing / sku_attributes / sku_branches / abc_threshold ほか（荷主×SKU×ロケの属性深掘り）

### 2. 入荷 — PC 24 / HT 11
入荷予定 → 検品 → 格納。
- **コア**：PC register / plans / actuals / putaway / discrepancy / quality｜HT inspect（asn/scan/discrepancy/lot_error/done/sign）/ putaway（instructions/location/done）
- **大手3PL拡張**：dock_appointment / dock_assign / carrier_arrival / scheduled_carriers / asn_compare / owner_acceptance / temperature_check / inbound_priority ほか

### 3. 在庫 — PC 40 / HT 4
在庫照会・移動・補充・調整。
- **コア**：summary / lots / lot_serial / move / adjust / hold / transactions / snapshots / replenish / locations_usage｜HT inventory/query・move/scan・replenish/scan・status/change
- **大手3PL拡張**：abc_analysis / aging_analysis / dead_stock / forecast / cross_dock / multi_warehouse / season_analysis / safety_stock / inventory_kpi / inventory_planning / quarantine ほか

### 4. 出荷（引当〜引渡）— PC 44 / HT 12
出荷指示 → 引当 → ウェーブ → ピッキング → 梱包 → 積込 → 引渡。
- **コア**：orders / allocate / waves / wave_detail / picking_areas / packing_summary / loading / handover / tracking / actuals / order_split / labels｜HT pick（wave/list/scan/done/error）/ packing（order/scan）/ wave/progress / loading（scan/confirm）/ handover（lane/confirm）
- **大手3PL拡張**：dispatch_board / eta_calculator / sequence_optimizer / load_planning / load_efficiency / leadtime_kpi / wave_kpi / sla_breach_history / dropship / consolidation / cage_management ほか

### 5. 配送振分 — （出荷PCに内包）
方面マスタ → 便候補 → 振分。
- **コア**：routing / courier_assignment（Q系）
- **大手3PL拡張**：courier_rate / lane_assignment / transit_time / eta_calculator

### 6. 棚卸 — PC 6 / HT 1
- **コア**：sessions / detail / count_detail / request（棚卸5モード）｜HT stocktake/count
- **大手3PL拡張**：cycle_plan / cycle_result（循環棚卸の計画・実績）

### 7. 返品 — PC 7 / HT 5
- **コア**：list / return_request / quality_check / restock_approval / disposal_approval（process_10）｜HT returns（scan/judge/status/approval/auto）
- **大手3PL拡張**：return_label / return_tracking / return_policies

### 8. 請求 — PC 10
- **コア**：monthly / invoice / partner（N明細・M課金・CA-1賃率／3期制・2期制・坪貸し）
- **大手3PL拡張**：cost_simulation / credit_notes / dispute / invoice_drilldown / invoice_preview / payment_status / revenue_share

### 9. 人員・シフト — PC 9 / App 5
- **コア**：shifts / employees / shift_template / attendance（K系）｜App home/shifts/timecard/payroll/notice（従業員スマホアプリ）
- **大手3PL拡張**：forecast / productivity / utilization / training / payroll

### 10. レポート・分析 — PC 18（reports 12 + dashboard 6）
- **コア**：kpi / profit / productivity / owner_kpi（O収支・生産性）
- **大手3PL拡張**：abc_turnover / cost_breakdown / customer_kpi / sla / incident_report / hourly｜dashboard realtime / manager_view / owner_view / site_overview / inbound_view

### 11. 外部連携 — PC 10
- **コア**：jobs / edi（G実績送信・LK外部連携）
- **大手3PL拡張**：webhook / sftp_sync / tms_sync / erp_sync / api_keys / api_endpoints / validation / file_history

### 12. 荷主ポータル — Portal 9（完成済）
- **コア**：login / dashboard / inventory / inventory-trend / shipment-status / delivery-track / shipment-order / reports / invoices（H-11）

### 13. システム管理 — PC 25
横断的な管理機能。
- **コア**：prints（hub / picking_list / inbound_receipt / loading / invoice / inventory＝印刷帳票）/ settings system
- **大手3PL拡張**：audit 8画面（log / login_history / login_failures / access_review / data_change / configuration_history / api_log / dependency_health＝SOX対応）/ notifications 4 / help 4 / calendars / settings security

---

## 3. コア／大手3PL拡張

- **コア（確定136機能）**：中小〜標準規模の3PL倉庫が必要とする基本機能。`CLAUDE.md` の確定機能 A〜T 群に対応。
- **大手3PL拡張**：大手3PL事業者向けの深掘り機能（SOX監査・原価/収益分析・SLA管理・外部連携の細分化・荷主属性の深掘り等）。2号が大手対応として追加。
- 同じシステムを「コアのみ＝標準構成」「コア＋拡張＝大手フル構成」として規模で見せ分けられるよう、本マップで階層を明示する。
- ※「機能ON/OFF」概念は廃案（QA-13）。階層は**マップ上の整理**であり、システムの動的切替ではない。

---

## 4. WMS Project Hub との連携

本マップが **Hub の新しいナビゲーション構造**になる。
- Hub は「画面モック一覧」から「**システムの地図**」へ進化する。
- 13業務領域 → ロール → 画面、の階層ナビ。各ノードはテストサイト2（公開ホスティング予定）の実画面にリンク。
- **Hub＝整理された地図／テストサイト2＝実体**。画面の二重管理はしない。

---

## 5. メンテナンス方針

- テストサイト2 は ~700画面まで拡大予定。**新規画面は本マップの13領域のどこかに必ず分類して追加**する（領域に収まらない画面が出たら、領域の見直しを検討）。
- v1 は領域・コア/拡張の構造を確定したもの。画面が増えるたび本マップに追記し、Hub ナビと同期させる。
- Phase 3 のシナリオテスト後、**どの画面もシナリオで通らない＝不要**をカバレッジで判定し、削減候補を本マップ上で印付けする。
