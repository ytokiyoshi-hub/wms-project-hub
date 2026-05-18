# WMS 機能体系マップ（System Feature Map）

最終更新: 2026-05-18 / 作成: 1号（まーちゃん）/ **v2**（3スケール tier 対応・線引き案）

---

## 0. このマップの目的

~700規模の画面群を「並べただけの山」にせず**構造化**する地図。整理の3軸：

1. **業務フロー軸（背骨）** — 倉庫が動く順（マスタ→入荷→在庫→出荷→…→請求）に画面をぶら下げる
2. **ロール軸（層）** — PC(管理者) / HT(現場) / App(従業員) / Portal(荷主)
3. **スケール軸（階層）** — 小規模 / 中堅 / 大手（v2で「コア/拡張」2段 → 3段に詳細化）

役割：ナビの背骨／シナリオテストのカバレッジ表／顧客に見せる全体像／Hubのナビ構造／**3スケール表示プロファイルの定義**。

実体画面はテストサイト2（`wms-test2`・~700画面予定）。全画面の実リストは `wms-impl/INVENTORY_PHASE1.md`。

---

## 1. 3スケール表示プロファイル

WMS には全機能が実装されて生きている。各画面に **tier（小/中/大）** を付け、3つの「表示プロファイル」を定義する：

| プロファイル | 対象 | 見える画面 |
|---|---|---|
| **小規模** | 小規模3PL倉庫（少人数・1拠点・基本業務） | tier=小 |
| **中堅** | 中堅3PL（複数荷主・シフト管理・分析を行う） | tier=小＋中 |
| **大手** | 大手3PL（SOX監査・原価分析・EDI連携・SLA管理） | tier=小＋中＋大（全画面） |

累積式：中堅は小規模の全画面＋α、大手は全部。

### 設計原則（QA-13 と整合）

- 機能は**消さない**。表示プロファイルで**メニューの見え方を絞るだけ**。機能はシステムに生きている。
- スケールアップ＝**プロファイル切替のみ**（追加開発なし）。
- 「3つの静的プリセット」として持つ。**顧客ごとに自由ON/OFFする管理画面は作らない** — QA-13 が廃案にした「機能マスタ＋依存関係チェック＋APIアクセス制御」のサブシステムは実装しない。本方式はそれより遥かに軽い、静的なメニュー表示プロファイル。
- 「隠して業務が成立するか」は **スケール別シナリオテスト**で担保（実行時の依存チェックエンジンは作らない）。小規模シナリオが隠れた画面を要したら → その画面の tier を見直す。

**全機能は、全スケールのインストールに常に実装されて存在する。** 小規模インストールにも中・大 tier の機能は入っている（メニューに出ないだけ）。プロファイルは「表示の割当」にすぎない。
→ よって tier はテスト結果に応じて **いつでも変更可（コード変更不要・該当画面の tier ラベルを変えるだけ）**。大→中、中→小 の移動も実装コストゼロ。

※ §3 の tier 付けは時吉さんレビュー済（2026-05-18・§4 の判断ポイント含め OK）。Phase 3 のスケール別シナリオテストで継続調整する。

---

## 2. 全体像 — 13業務領域 × スケール

| # | 業務領域 | 小規模 | 中堅（＋） | 大手（＋） |
|---|---|---|---|---|
| 1 | マスタ管理 | 基本マスタ | 運用マスタ | 荷主属性・契約・SLA |
| 2 | 入荷 | 予定・検品・格納 | 品質・実績 | バース予約・温度・ASN高度 |
| 3 | 在庫 | 照会・移動・調整 | 補充・スナップショット | ABC・需要予測・複数倉庫 |
| 4 | 出荷（引当〜引渡） | 指示〜引渡の一本道 | ウェーブ詳細・配送振分 | 最適化・KPI・カゴ管理 |
| 5 | 棚卸 | 基本棚卸 | 循環棚卸 | — |
| 6 | 返品 | 受入・判定・承認 | 品質チェック | 返品ラベル・追跡 |
| 7 | 請求 | 月次・請求書 | プレビュー・入金 | 原価試算・与信・収益分析 |
| 8 | 人員・シフト | （なし） | シフト・勤怠・従業員App | 予測・生産性・教育 |
| 9 | レポート・分析 | （なし） | KPI・収支・生産性 | ABC・SLA・各種ダッシュボード |
| 10 | 外部連携 | （なし） | 実績送信ジョブ | EDI・TMS・ERP・API |
| 11 | 荷主ポータル | 基本ポータル | フルポータル | （中堅と同） |
| 12 | システム管理 | 基本帳票・設定 | 通知・ヘルプ・カレンダー | SOX監査・セキュリティ |

（配送振分は「出荷」に内包）

---

## 3. 領域別 tier マップ（線引き案 v2）

各領域、画面を 小／中／大 で仕分け。

### 1. マスタ管理（PC 81）
- **小**：owners / products / locations / warehouses / customers / carriers / units / rates / users（業務を回す基本マスタ）
- **中**：location_types / regions / routes / drivers / vehicles / billing_units / materials / packing_rules / replenishment_rules / adjustment_reasons / picking_areas / status / task_types / permissions / role_definitions / movement_reasons / return_reasons / holidays / closing_calendar / scan_devices ほか（運用マスタ）
- **大**：container_types / hazmat / temperature_zones / sla_definitions / owner_contracts / owner_branding / owner_dashboards / tariff_zones / pricing_tiers / customer_tariffs / cost_centers / sku_attributes / sku_branches / abc_threshold / billing_methods ほか 約40（荷主属性・契約・SLA・原価の深掘り）

### 2. 入荷（PC 24 / HT 11）
- **小**：PC register / plans / putaway / discrepancy｜HT inspect（scan / done）/ putaway（location / done）
- **中**：PC actuals / quality / inspection_status / inspection_history / returns / return_inbound_detail｜HT inspect（asn / discrepancy / lot_error / sign）/ putaway（instructions）
- **大**：dock_appointment / dock_assign / carrier_arrival / scheduled_carriers / asn_import / asn_view / asn_compare / asn_history / owner_acceptance / temperature_check / inbound_priority / quality_template / diff_summary

### 3. 在庫（PC 40 / HT 4）
- **小**：PC summary / lots / move / adjust / hold / transactions｜HT inventory/query / move/scan / status/change
- **中**：PC snapshots / replenish / lot_serial / locations_usage / expiry / stock_alert / owner_summary / inbound_history / outbound_history / movements_summary｜HT replenish/scan
- **大**：abc_analysis / aging_analysis / dead_stock / forecast / cross_dock / multi_warehouse / season_analysis / safety_stock / inventory_kpi / inventory_planning / inventory_value / inventory_audit / quarantine / warehouse_compare / serial_inquiry / bara_management ほか

### 4. 出荷（引当〜引渡）（PC 44 / HT 12）
- **小**：PC orders / register / allocate / waves / loading / handover / tracking｜HT pick（list / scan / done）/ packing（scan）/ loading（scan）/ handover（confirm）
- **中**：PC wave_detail / wave_plan / order_detail / order_split / actuals / labels / picking_areas / packing_summary / routing / courier_assignment / pre_ship_check / cancel｜HT pick（wave / error）/ packing（order）/ wave/progress / loading（confirm）/ handover（lane）
- **大**：dispatch_board / eta_calculator / sequence_optimizer / load_planning / load_efficiency / leadtime_kpi / wave_kpi / wave_template / sub_waves / sla_breach_history / dropship / consolidation / cage_management / courier_rate / lane_assignment / billing_snapshot / shipment_send ほか

### 5. 棚卸（PC 6 / HT 1）
- **小**：PC sessions / detail / count_detail / request｜HT stocktake/count
- **中**：cycle_plan / cycle_result（循環棚卸）

### 6. 返品（PC 7 / HT 5）
- **小**：PC list / return_request / restock_approval / disposal_approval｜HT returns（scan / judge / status）
- **中**：PC quality_check｜HT returns（approval / auto）
- **大**：return_label / return_tracking

### 7. 請求（PC 10）
- **小**：monthly / invoice / partner（3期制・2期制・坪貸し）
- **中**：invoice_preview / payment_status
- **大**：cost_simulation / credit_notes / dispute / invoice_drilldown / revenue_share

### 8. 人員・シフト（PC 9 / App 5）
- **中**：PC shifts / employees / attendance / shift_template｜App home / shifts / timecard / notice
- **大**：PC forecast / productivity / utilization / training / payroll｜App payroll
- 小規模：人員・シフトモジュールは使わない（少人数のため WMS 外で管理）

### 9. レポート・分析（PC 18）
- **中**：reports kpi / profit / productivity / owner_kpi
- **大**：reports abc_turnover / cost_breakdown / customer_kpi / sla / incident_report / hourly｜dashboard realtime / manager_view / owner_view / site_overview / inbound_view
- 小規模：分析専用画面は使わない（基本の数字は各業務画面で見る）

### 10. 外部連携（PC 10）
- **中**：jobs（実績送信ジョブ）
- **大**：edi / webhook / sftp_sync / tms_sync / erp_sync / api_keys / api_endpoints / validation / file_history
- 小規模：外部連携なし

### 11. 荷主ポータル（Portal 9）
- **小**：login / dashboard / inventory / shipment-status（基本ポータル）
- **中**：inventory-trend / delivery-track / shipment-order / reports / invoices（フルポータル）

### 12. システム管理（PC 25）
- **小**：prints（picking_list / inbound_receipt / invoice）／ settings system
- **中**：prints（hub / loading / inventory）／ notifications（list / notes）／ help（manual / faq）／ calendars
- **大**：audit 8画面（SOX対応）／ notifications（templates / subscriptions / channels）／ help（release_notes / contact_support）／ settings security

---

## 4. 線引きの判断ポイント（時吉さんレビュー用）

下記は1号判断で線を引いたが、特に時吉さんの実感での確認希望：

- **人員・シフト／レポート分析／外部連携を「小規模tierなし」とした** — 小規模3PL倉庫はこれらを WMS で持たない想定。実際の小規模倉庫がシフト/分析を WMS に求めるなら中→小へ降ろす。
- **荷主ポータル** — 小規模でも基本ポータル（在庫照会・出荷状況）は出す前提にした。小規模はポータル自体なし、なら全部中へ。
- **マスタ管理** — 「基本9マスタ＝小」とした。小規模でも温度帯/危険物等が要る業態（食品・化学）はあるので、業態によっては個別調整。
- **棚卸に大tierなし／返品の大は薄い** — 妥当と判断。

---

## 5. WMS Project Hub との連携

本マップが **Hub の新しいナビゲーション構造**になる。
- Hub は「画面モック一覧」から「**システムの地図**」へ進化。13業務領域 → ロール → 画面の階層ナビ。
- 各ノードはテストサイト2（公開ホスティング予定）の実画面にリンク。**Hub＝整理された地図／テストサイト2＝実体**。二重管理しない。
- 3スケールプロファイルは Hub 上でも切替表示できると、顧客に「あなたの規模だとこれ」を見せられる。

---

## 6. メンテナンス方針

- テストサイト2 は ~700画面まで拡大予定。**新規画面は必ず〔13領域 × ロール × tier〕に分類して本マップに追加**する。
- 画面が増えるたび本マップを追記し、Hub ナビと同期。
- Phase 3 のシナリオテストを **スケール別プロファイルごと**に実行し、「そのスケールの可視画面だけで業務が完結するか」を検証。隠れた画面が必要になったら tier を見直す。どの画面もシナリオで通らなければ削減候補として印付け。
