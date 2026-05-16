# 工程14：外部システム連携（API/EDI/CSV）

> 致命傷ライン LK-1（外部連携方式）の実装工程。差別化4点「連携費用無料」を実現する基盤。

---

## スコープ

- 荷主システムとの双方向 API 連携
- CSV インポート・エクスポート
- EDI 連携（将来・JCA手順 / 全銀手順）
- 上位 ERP / 会計連携
- 連携エラー検知・リトライ・ログ

---

## 関連する致命傷ライン

| ID | 項目 | 連携での扱い |
|----|------|------------|
| **LK-1** | 外部連携方式 | 本工程の中核 |
| LK-2 | HT バーコード | キーエンス HT 連携も本工程で |
| AU-2 | SKU/JAN | 荷主間 SKU マッピングが連携で必要 |
| DB-4 | 荷主切替 | 荷主毎に連携設定 |

---

## 機能リスト

### F-1401：API 受信エンドポイント（Supabase Edge Function）

| 項目 | 内容 |
|------|------|
| 機能 | 荷主システムから WMS への入荷予定・出荷指示等の受信 |
| 認証 | JWT or Bearer Token / IP 制限 |
| エンドポイント例 | POST /api/v1/inbound-plans / POST /api/v1/outbound-orders |
| 出力 | 各業務テーブルへの INSERT |
| 致命傷ライン | LK-1 / DB-4 / AU-2 |
| 9割突っ走り部分 | API ドキュメント体裁 |
| 完璧に詰める部分 | 認証・冪等性（重複受信防止）・荷主毎の SKU マッピング |

**設計方針：** Supabase Edge Function でステートレスに受信 → DB 書き込みは RLS 経由で荷主分離。

### F-1402：API 送信（Webhook）

| 項目 | 内容 |
|------|------|
| 機能 | WMS から荷主システムへの状態通知（出荷完了・在庫変動等） |
| 配信タイミング | 業務イベント発生時 + 日次バッチ |
| 配信方式 | Webhook（指定 URL に POST） |
| 致命傷ライン | LK-1 |
| 9割突っ走り部分 | Webhook 文面 |
| 完璧に詰める部分 | 配信失敗時の指数バックオフリトライ・配信済通知の重複防止 |

### F-1403：CSV インポート / エクスポート

| 項目 | 内容 |
|------|------|
| 機能 | 定型 CSV による日次バッチ連携（FTP / メール / 画面アップロード） |
| 対応フォーマット | 入荷予定 / 出荷指示 / 在庫表 / マスタ |
| 致命傷ライン | LK-1 / AU-2 |
| 9割突っ走り部分 | アップロード画面 |
| 完璧に詰める部分 | 文字コード（UTF-8 / SJIS）・改行コード・項目順の柔軟性 |

**設計方針：** `csv_format_definitions` テーブルで荷主×種別×項目順を定義可能に。

### F-1404：上位 ERP / 会計連携

| 項目 | 内容 |
|------|------|
| 機能 | 請求情報を会計ソフトへ・在庫情報を ERP へ |
| 連携方式 | 会計freee API / マネーフォワード API / 標準 CSV |
| 致命傷ライン | LK-1 / CA-1（請求賃率） |
| 9割突っ走り部分 | 連携設定 UI |
| 完璧に詰める部分 | 仕訳科目マッピング（荷主毎の科目コード差異） |

### F-1405：EDI 連携（将来・Phase 後期）

| 項目 | 内容 |
|------|------|
| 機能 | 大手荷主向け EDI 連携（JCA手順 / 全銀手順） |
| 想定 | 8月末ゴール後の追加機能 |
| 致命傷ライン | LK-1 |
| 完璧に詰める部分 | EDI フォーマット仕様書の精読・テスト環境構築 |

> Phase 8 以降に再評価。中小3PL ターゲットでは優先度低。

### F-1406：連携エラー検知・ログ

| 項目 | 内容 |
|------|------|
| 機能 | 全連携の失敗を検知して管理者通知 |
| 通知先 | LINE（くろくん側 or まーちゃん側）/ メール |
| 出力 | `integration_errors` テーブル |
| 致命傷ライン | LK-1 / 既存の異常検知（worker/anomaly-detector）と統合 |
| 9割突っ走り部分 | 通知文面 |
| 完璧に詰める部分 | エラー分類・自動リトライ vs 人間介入の判断 |

---

## キーエンス HT 連携（LK-2 の実装）

別工程ではなく、**本工程内のサブ機能**として位置付け：

| 項目 | 内容 |
|------|------|
| 機能 | キーエンス HT（BT-W シリーズ等）との通信仕様 |
| プロトコル | HTTP（無線 LAN）/ Bluetooth |
| データ形式 | JSON over HTTPS |
| 致命傷ライン | LK-2 / DB-3（シリアル）/ AU-2（SKU/JAN） |
| 完璧に詰める部分 | HT 側アプリ仕様（キーエンス担当との調整必須）・オフラインモード対応 |

**営業効果：** 「キーエンス HT 標準対応」を訴求できる＝差別化4点の「連携費用無料」と相乗効果。

---

## 工数見積（叩き台）

| 機能 | 見積（日） |
|------|----------|
| F-1401 API 受信 | 5 |
| F-1402 API 送信（Webhook） | 4 |
| F-1403 CSV I/O | 4 |
| F-1404 上位 ERP / 会計 | 5 |
| F-1405 EDI（将来） | （後期）|
| F-1406 エラー検知・ログ | 2 |
| キーエンス HT 連携 | 6 |
| 合計（EDI 除く） | **26** |

> 工程10-16 概要での20日から微増（HT 連携を含めた）。

---

## DB スキーマ（Phase 9-LK1 実装分）

### connectors テーブル

荷主別の外部連携設定を管理する。認証実値は Supabase Secrets に格納し、`auth_secret_ref` でキー名のみ参照する。

| カラム | 型 | 説明 |
|--------|----|------|
| `id` | BIGSERIAL PK | 自動採番 |
| `owner_id` | BIGINT FK→owners | 荷主（ON DELETE CASCADE） |
| `name` | TEXT NOT NULL | 連携設定名（表示用） |
| `connection_type` | TEXT | `api_inbound` / `api_outbound` / `csv_inbound` / `csv_outbound` / `webhook` |
| `format` | TEXT | `json`（デフォ）/ `csv` / `xml` |
| `endpoint_url` | TEXT | API/Webhook 送信先 URL（受信エンドポイントは Edge Function URL） |
| `auth_type` | TEXT | `none` / `bearer_token` / `jwt` / `ip_allowlist` |
| `auth_secret_ref` | TEXT | Supabase Secret 変数名（`CONNECTOR_TOKEN_<id>` 形式推奨） |
| `csv_encoding` | TEXT | `utf-8`（デフォ）/ `sjis` |
| `csv_delimiter` | TEXT | `,`（デフォ）/ TAB / `\|` |
| `is_active` | BOOLEAN | 連携有効フラグ（デフォ true） |
| `created_at` / `updated_at` | TIMESTAMPTZ | タイムスタンプ |

**RLS:** `admin` / `operator` ロールのみ自社荷主レコードにアクセス可。

---

## CSV/API 受信エンドポイント仕様（F-1401 / F-1403 詳細）

### 共通設計方針

1. **荷主識別**: `connectors.id` を URL パスまたは Bearer Token で識別。Edge Function は `connectors` を参照して荷主を特定し、RLS スコープで DB 書き込みを行う。
2. **冪等性**: リクエスト単位で `idempotency_key`（任意ヘッダー `X-Idempotency-Key`）を受け付け、重複受信を防ぐ。
3. **認証フロー**: `connectors.auth_type` に従い Edge Function 内で検証。実トークンは `Deno.env.get(auth_secret_ref)` で参照。

### API 受信エンドポイント（F-1401）

```
POST /functions/v1/connector-receive/{connector_id}
Authorization: Bearer <token>
Content-Type: application/json
X-Idempotency-Key: <uuid>  (任意)
```

**リクエスト body（入荷予定の例）:**
```json
{
  "type": "inbound_plan",
  "payload": {
    "external_ref": "PO-2026-001",
    "sku_code": "SKU-ABC",
    "quantity": 100,
    "scheduled_date": "2026-06-01"
  }
}
```

**レスポンス:**
- `200 OK` + `{ "accepted": true, "record_id": <id> }` — 正常受信
- `400 Bad Request` — バリデーションエラー（body に `errors` を含む）
- `401 Unauthorized` — 認証失敗
- `409 Conflict` — `idempotency_key` の重複検知

### CSV 受信エンドポイント（F-1403）

```
POST /functions/v1/connector-csv/{connector_id}
Authorization: Bearer <token>
Content-Type: text/csv; charset=utf-8
X-CSV-Type: inbound_plan | outbound_order | inventory | master
```

- `csv_encoding` / `csv_delimiter` は `connectors` テーブルから自動取得。
- ヘッダー行必須。カラム順は `connector_id` に紐付く将来の `connector_csv_formats` テーブルで管理（Phase 後期）。
- 1リクエストあたり最大 10,000 行。超過時は `400` で拒否。

**レスポンス:**
- `200 OK` + `{ "accepted": <行数>, "skipped": <行数>, "errors": [] }`

---

## 次工程への申し送り

- キーエンス HT 連携は **キーエンス担当との早期接触**が必要。Phase 8 の最初に着手
- F-1401（API 受信）の認証方式は AU-1（権限）の決定後に詳細化
- F-1404（会計連携）は CA-1（請求賃率）の決定後に詳細化

---

*最終更新: 2026-05-08 / Phase 7-K まーちゃん（工程14 外部連携 6機能の論点叩き台＋HT連携）*
