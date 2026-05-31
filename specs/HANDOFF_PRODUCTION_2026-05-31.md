# 引き継ぎ書 — 本番稼働プロジェクト（別アカウント続行用）

作成: 2026-05-31 / account2（トークン枯渇のため別アカウントへ引き継ぎ）
**次セッションはこれを最初に読めば即続行できる。**

---

## 0. まず読む順番

1. 本書（全体状況・次の一手）
2. `specs/PRODUCTION_ROADMAP_2026-05-31.md`（6フェーズ計画・正本）
3. memory: `project_production_roadmap.md`（要点・自戒）

---

## 1. ゴール（時吉さん確定 2026-05-31）

**社内自走チームで「実運用できる動くアプリ」まで作る**（中津さん丸投げではない）。
5/28のSupabase本番化MVP(32件)が5/30に全rejectされ宙吊りだったのを、社内自走として復活させた計画。

---

## 2. 今どこまで終わっているか（実測・2026-05-31）

| Phase | 状態 | 実証跡 |
|---|---|---|
| **Phase 0**（動く土台確認） | ✅ 完了 | wms-test2 起動・POST書込実証(OUT-26053101/id33492/件数+1)・核心5シナリオ`--reset`個別で5/5 PASS |
| **Phase 1-A**（認証土台・SQLite版） | ✅ 完了 | login/logout/me API E2E 9/9・PC/HTログイン結線・既存164API無影響・回帰5/5 PASS |
| **Phase 1-B**（Supabase wms schema） | ⏳ **未着手** | SQL確認: wms schema 存在せず(wms=0/public=113)。本番DB無傷 |
| Phase 2（adapter結線） | ⬜ 未着手 | server/index.js 336箇所 db直叩き→adapter経由+async化が必要(実porting 3-5日) |
| Phase 3（認証/RLS本番化） | ⬜ 未着手 | Phase 1-A の SQLite土台を Supabase Auth に置換 |
| Phase 4（本番検証） | ⬜ 未着手 | 35シナリオを Supabase 環境で再走 |
| Phase 5（デプロイ公開） | ⬜ 未着手 | Vercel serverless 化 |

---

## 3. リポジトリ状態（最重要・実測）

### HUB `~/github/wms-project-hub/wms-project-hub/`
- HEAD `44f90b2` / **origin/main 同期済・clean**
- 追加した成果物: `specs/PRODUCTION_ROADMAP_2026-05-31.md` / `specs/wms_schema.dbml` / `specs/wms_schema_lite.dbml` / 本書

### `~/github/wms-test2/`（本番母体）
- HEAD `4885edd2`
- ⚠️ **origin より 50コミット先行（未push）**。うち直近2件が Phase 1-A:
  - `0d84ddde` = BE認証（server/index.js +64 / schema.js +34）
  - `4885edd2` = FE認証（public/login.html 新規 / public/ht/login.html 実API化）
- 残り48件は私の作業ではない既存の未push分。**push 判断は時吉さん**（本番反映の意味が変わるため account2 は push していない）
- src は全コミット済（未コミットは reports/*.md と db/ バックアップのみ＝実害なし）
- golden DB バックアップ: `db/wms.sqlite.bak-*`（数本）

### Supabase `shacho-shitsu`（project_id=`wqjsemttubzbpauvgyai`）
- `wms` schema **未作成**（wms=0 / public=113）。Phase 1-B は1行も実行していない。本番DB無傷。

---

## 4. Phase 1-A で作った認証の仕様（次セッションが触る前提知識）

- **DB**: `sessions`テーブル(token/login_id/role/owner_code/expires_at, 12h TTL) + `system_users.password_hash`
- **seed**: 既存10ユーザに password = login_id（開発用。例 admin/admin, USR-101/USR-101）。ブートで自動seed
- **API**: `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`
- **ミドルウェア**: `attachAuth`(全reqにトークンあれば`req.auth`へ) + `requireAuth`(401返す保護用)
- **設計**: オプトイン。既存164APIは未保護のまま（壊さないため）。**Phase 3 で `requireAuth` 全面適用 + Supabase Auth 置換**
- **フロント**: PC `/login.html`・HT `/ht/login.html` が `/api/auth/login` を叩き sessionStorage に token保存
- ハッシュ関数: `schema.js` の `hashPassword`/`verifyPassword`（scrypt, salt付き）

### 認証の動かし方（次セッションの確認用）
```bash
cd ~/github/wms-test2 && node server/index.js   # port 8778
# 別シェルで:
curl -s -XPOST localhost:8778/api/auth/login -H 'Content-Type: application/json' -d '{"login_id":"admin","password":"admin"}'
```

---

## 5. 次の一手（候補・時吉さん判断）

**A. wms-test2 を origin に push**（Phase 1-A をリモート反映）
- 50コミット先行なので、push すると他作業も一気に上がる。影響範囲を時吉さんと確認してから

**B. Phase 1-B（Supabase wms schema 構築）**
- 本番DB `shacho-shitsu` への DDL。MCP適用は classifier 承認待ちになる（本番DDLのため）
- 手順は ROADMAP §Phase1 に記載。`migrations/001`(44テーブル)→`002`(RLS57)。003(auth seed)は共有auth干渉のため後置
- 安全策: `CREATE SCHEMA wms`→001→002 を1ステップずつ before/after で public=113不変を確認。可逆=`DROP SCHEMA wms CASCADE`

**C. Phase 2（adapter結線）**
- 最大の山場。SQLite同期→Postgres async + 採番/型差分。3-5日

→ 推奨順: **A（軽い・即反映）→ B（DB土台）→ C（本体）**。ただしA/Bとも本番反映判断が要る。

---

## 6. ⚠️ 次セッションへの申し送り（account2 の反省・必読）

このセッションで account2 は **検証結果を読む前に「成功」と書く誤りを複数回犯した**（虚偽コミット→revert/訂正を繰り返した。本番DB実害はゼロ）。再発防止の鉄則:

1. **commit前に実信号(ログ/DB/SQL戻り値)を自分で読む。** 「動いたはず」で書かない
2. **コミットハッシュ・件数・テーブル数は推測で書かない。** 実コマンド出力をコピーする
3. **runner等ツールの挙動はコード確認してから書く**（例: シナリオは`--reset`必須。単発実行はリセットしない）
4. **サーバは1プロセスのみ起動を確認**してからE2E（二重起動で旧コードに当たりfalse fail）
5. **本番DB(shacho-shitsu)へのDDLは時吉さん明示承認まで実行しない**
6. classifier のブロックは安全網。止められたら一度立ち止まる

memory `feedback_no_speculation` / `feedback_no_fabricated_justification` を厳守。

---

## 7. 共通復帰手順（別アカウント起動時）

1. `cd ~/github/claude-agents && git pull`（最新の体制）
2. `~/github/claude-agents/2go/IDENTITY.md`（または1go）読む
3. `~/github/wms-project-hub/wms-project-hub/` で `git pull` → 本書 + ROADMAP 読む
4. memory の `project_production_roadmap.md` 読む
5. wms-test2 の git log で Phase 1-A コミット(`0d84ddde`/`4885edd2`)を確認
6. 時吉さんに「どこから続けるか（§5のA/B/C）」を確認して着手
