// 業界標準準拠版 — マルキ食品WMS サイドバー
// 出典: specs/WMS_SIDEBAR_STANDARD.md
// 業界標準（ロジザード/SAP EWM/Manhattan/Oracle/トーマス/ci.Himalayas/LOGILESS/Infor）に基づく
// 6カテゴリ・2階層・業務フロー順（入荷→在庫→棚卸→出荷→マスタ→設定）

window.NAV_META = {
  "/": { label: "トップ", icon: "🏠", order: 0 },
  "inbound": { label: "入荷管理", icon: "📥", order: 10 },
  "outbound": { label: "出荷管理", icon: "📤", order: 20 },
  "inventory": { label: "在庫管理", icon: "📦", order: 30 },
  "stocktake": { label: "棚卸", icon: "🧮", order: 40 },
  "master": { label: "マスタ管理", icon: "🗂", order: 50 },
  "settings": { label: "システム設定", icon: "⚙️", order: 60 }
};

window.NAV_ITEMS = [
  { "url": "/index.html", "title": "ホーム", "section": "/", "sub": null },

  // === 入荷管理（6） ===
  { "url": "/pc/inbound/plans.html",        "title": "入荷予定一覧",     "section": "inbound", "sub": null },
  { "url": "/pc/inbound/register.html",     "title": "入荷予定登録",     "section": "inbound", "sub": null },
  { "url": "/pc/inbound/actuals.html",      "title": "入荷実績",         "section": "inbound", "sub": null },
  { "url": "/pc/inbound/discrepancy.html",  "title": "検品差異処理",     "section": "inbound", "sub": null },
  { "url": "/pc/inbound/putaway.html",      "title": "棚入れ指示",       "section": "inbound", "sub": null },
  { "url": "/pc/returns/list.html",         "title": "返品入荷",         "section": "inbound", "sub": null },

  // === 出荷管理（6） ===
  { "url": "/pc/outbound/orders.html",          "title": "出荷指示一覧",     "section": "outbound", "sub": null },
  { "url": "/pc/outbound/register.html",        "title": "出荷指示登録",     "section": "outbound", "sub": null },
  { "url": "/pc/outbound/allocate.html",        "title": "在庫引当・ウェーブ", "section": "outbound", "sub": null },
  { "url": "/pc/outbound/packing_summary.html", "title": "ピッキング・梱包", "section": "outbound", "sub": null },
  { "url": "/pc/outbound/loading.html",         "title": "積込・出荷確定",   "section": "outbound", "sub": null },
  { "url": "/pc/outbound/handover.html",        "title": "引渡",             "section": "outbound", "sub": null },

  // === 在庫管理（5） ===
  { "url": "/pc/inventory/inventory_kpi.html", "title": "在庫照会（商品軸）", "section": "inventory", "sub": null },
  { "url": "/pc/inventory/layout_a.html",       "title": "在庫照会（ロケ軸）", "section": "inventory", "sub": null },
  { "url": "/pc/inventory/lot_serial.html",     "title": "ロット・賞味期限",   "section": "inventory", "sub": null },
  { "url": "/pc/inventory/adjust.html",         "title": "在庫調整",          "section": "inventory", "sub": null },
  { "url": "/pc/inventory/stock_alert.html",    "title": "在庫アラート",      "section": "inventory", "sub": null },

  // === 棚卸（3） ===
  { "url": "/pc/stocktake/cycle_plan.html",   "title": "棚卸計画",   "section": "stocktake", "sub": null },
  { "url": "/pc/stocktake/cycle_result.html", "title": "棚卸実績",   "section": "stocktake", "sub": null },
  { "url": "/pc/stocktake/detail.html",       "title": "棚卸差異",   "section": "stocktake", "sub": null },

  // === マスタ管理（5） ===
  { "url": "/pc/master/products.html",  "title": "商品マスタ",       "section": "master", "sub": null },
  { "url": "/pc/master/locations.html", "title": "ロケーション",     "section": "master", "sub": null },
  { "url": "/pc/master/customers.html", "title": "取引先",           "section": "master", "sub": null },
  { "url": "/pc/master/carriers.html",  "title": "配送業者",         "section": "master", "sub": null },
  { "url": "/pc/master/users.html",     "title": "ユーザー・権限",   "section": "master", "sub": null },

  // === システム設定（3） ===
  { "url": "/pc/settings/system.html",   "title": "全般設定",   "section": "settings", "sub": null },
  { "url": "/pc/audit/log.html",         "title": "操作履歴",   "section": "settings", "sub": null },
  { "url": "/pc/integration/edi.html",   "title": "外部連携",   "section": "settings", "sub": null }
];
