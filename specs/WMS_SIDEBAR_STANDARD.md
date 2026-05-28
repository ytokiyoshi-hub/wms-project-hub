# WMS サイドバー業界標準リサーチ + マルキ食品WMS 推奨構造

最終更新: 2026-05-29 / 作成: 1号（まーちゃん）  
出典: 8製品のWebサイト・公式ドキュメント・レビュー記事の調査  
関連: test2-mirror/js/nav-manifest.js（本ドキュメントの設計を実装）

---

## 0. 背景

時吉さん指摘:
- 「サイドバー479項目」は開発中の便宜（全画面インデックス）
- 本番は「**代表項目数個 + 階層展開**」が業界標準
- 1号(私)は他社WMSの標準構造を**勉強せずに**自前モックを作っていた

→ 主要8製品を Web調査し、業界標準を抽出。マルキ食品向け推奨構造を確定。

---

## 1. 調査対象（8製品）

| # | 製品 | 出自 | 国内シェア/規模 |
|---|------|------|---------------|
| 1 | ロジザード ZERO | ロジザード | 国内クラウドWMS 56.1%（1位） |
| 2 | SAP EWM (S/4HANA) | SAP | 海外Tier1 |
| 3 | Manhattan Active WMS | Manhattan Associates | 海外Tier1 |
| 4 | Oracle WMS Cloud | Oracle | 海外Tier1 |
| 5 | クラウドトーマス | 関通 | 国内中堅 |
| 6 | ci.Himalayas | シーネット | 国内クラウドWMS 13.3%（2位） |
| 7 | LOGILESS | ロジレス | 国内EC特化 |
| 8 | Infor WMS | Infor | 海外Tier1 |

---

## 2. 業界標準パターン（共通点）

### 2.1 トップレベル項目数

| 製品 | トップ数 |
|------|----------|
| ロジザード ZERO | 6-8 |
| クラウドトーマス | 5 |
| ci.Himalayas | 10 |
| LOGILESS | 5-6 |
| Infor WMS | 6-10 |
| Manhattan Active | 6-8 |
| Oracle WMS Cloud | 5-7 |
| SAP EWM | 5（Easy Access）|

**最頻値: 5〜7項目**。10超（ci.Himalayas）はユニーク。日本のクラウドWMSは5〜6が支配的。

### 2.2 階層深度

**2階層が圧倒的多数**（カテゴリ → 機能）。SAP EWM/Inforのみ3階層伝統だがモダンUIでは2階層化。

### 2.3 必ず含まれるカテゴリ（8製品全部共通）

1. **入荷管理**（Inbound / Receiving / 入庫）
2. **出荷管理**（Outbound / Shipping / 出庫）
3. **在庫管理**（Inventory）
4. **棚卸**（Cycle Count）※独立 or 在庫の中
5. **マスタ管理**（Master Data）
6. **設定**（Configuration）

**任意でよく出現**: 帳票・返品管理・データ連携・ハンディ端末・請求・セット組・労務

### 2.4 業務フロー順がメニュー順序

ほぼ全製品で「商品の流れ」順:

```
入荷 → 在庫(保管) → 棚卸 → 出荷 → マスタ → 設定
```

作業者の頭の中のモデルと一致するため新人教育コストが低い。

### 2.5 ステータス管理（4段階が標準）

ロジザード ZERO代表例:
- 入荷: 未入荷 → 受付済 → 検品中 → 入荷確定
- 出荷: 出荷予定 → 指示済 → 引当処理済 → 出荷確定済

Oracle/ci.Himalayas/トーマスも類似の4-5ステータス。

### 2.6 ロール別表示

| ロール | 見える機能 |
|--------|----------|
| 管理者 | 全機能（マスタ/設定/全業務照会）|
| 倉庫管理者 | 入荷〜出荷全業務 + KPI + 帳票 |
| 作業者 | ハンディ画面 + 検品/ピッキング |
| 荷主(3PL) | 自社分の在庫・入荷予定・出荷指示のみ |

Oracle/Manhattan/SAP はロール別UI強力。日本系は権限ロールで画面ごとに表示/非表示。

---

## 3. マルキ食品WMS 推奨構造（実装版）

### 3.1 トップレベル: 6項目

業界最頻値5-7の中央値、業務フロー順:

```
1. 入荷管理 📥
2. 出荷管理 📤
3. 在庫管理 📦
4. 棚卸    🧮
5. マスタ管理 🗂
6. システム設定 ⚙️
```

### 3.2 カテゴリ別 子項目（計28項目）

#### 入荷管理（6）
- 入荷予定一覧（ステータス: 未入荷/受付済/検品中/入荷確定）
- 入荷予定登録（手動 + CSV取込）
- 入荷実績
- 検品差異処理
- 棚入れ指示
- 返品入荷

#### 出荷管理（6）
- 出荷指示一覧（ステータス: 出荷予定/指示済/引当処理済/出荷確定）
- 出荷指示登録（手動 + CSV取込 + 受注連携）
- 在庫引当・ウェーブ（先入先出 / 賞味期限優先）
- ピッキング・梱包
- 積込・出荷確定
- 引渡

#### 在庫管理（5）
- 在庫照会（商品軸）— 出荷予定数/入荷予定数/在庫数を一画面
- 在庫照会（ロケ軸）— 棚番別の商品・在庫
- ロット・賞味期限照会（食品なので必須）
- 在庫調整
- 在庫アラート（不動在庫・期限切れ警告）

#### 棚卸（3）
- 棚卸計画
- 棚卸実績
- 棚卸差異

#### マスタ管理（5）
- 商品マスタ（賞味期限管理含む）
- ロケーション
- 取引先（仕入先/出荷先）
- 配送業者
- ユーザー・権限ロール

#### システム設定（3）
- 全般設定
- 操作履歴・監査ログ
- 外部連携（API/EDI/CSV）

### 3.3 MVPで「省く」業界機能（後段で追加検討）

- 労務管理（Labor Management）— Manhattan/Infor級エンタープライズ機能、中堅食品卸には過剰
- Wave Planning高度版 — 大規模DC向け、1拠点では不要
- Crossdocking — 食品卸の標準業務には不要
- Yard/Dock Management — 大規模DC向け
- KPIダッシュボード — 後付け可能
- セット組管理 — 食品卸では限定的
- 請求管理 — 自社倉庫なら不要（3PL受託時のみ）

→ MVPは「入荷/出荷/在庫/棚卸/マスタ/設定」**6カテゴリ・28画面に集中**

---

## 4. 実装メモ

- `test2-mirror/js/nav-manifest.js` を本ドキュメントの構造で書き換え済み
- `test2-mirror/js/common-layout.js` の階層展開UI（`cl-section`/`cl-section-body`）は既存実装で動く
- 459項目 → 28項目（**94% 削減**）
- 開発中の全画面（479ファイル）は test2-mirror/ に物理的に残る（直接URLで参照可）が、サイドバーには出ない

---

## 5. 主要ソース

- [ロジザードZERO 公式](https://www.logizard-zero.com/services/)
- [SAP EWM help](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE)
- [Manhattan Active WMS](https://www.manh.com/en-gb/products/manhattan-active-warehouse-management)
- [Oracle WMS Cloud User Guide](https://docs.oracle.com/en/cloud/saas/warehouse-management/20d/owmsu/system-overview.html)
- [クラウドトーマス機能一覧](https://xn--gckr5a9ce1k1c3h.jp/func/)
- [ci.Himalayas](https://www.cross-docking.com/service/wms-standard/)
- [LOGILESS WMS](https://www.logiless.com/operator/)
- [Infor WMS Documentation](https://docs.infor.com/wms/2024.x/en-us/wmsolh/)

---

**作成: 2026-05-29 / 1号（まーちゃん）**
