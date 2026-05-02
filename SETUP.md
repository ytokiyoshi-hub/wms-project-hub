# セットアップ手順書（GitHub Pages 公開）

このドキュメントは、**WMS Project Hub** を GitHub Pages で公開するための手順書です。
**お客様（非エンジニア）とエンジニアが一緒に作業する**ことを想定しています。

---

## 所要時間

**約30〜45分**（GitHub組織アカウントへの権限がある前提）

---

## 必要なもの

### お客様側
- 配布されたファイル一式（zip解凍済み）
- このドキュメント

### エンジニア側
- GitHub組織アカウントへのログイン権限
- リポジトリ作成権限（Owner または Member with Create role）
- Git がインストールされた PC（Mac/Windows/Linux）

---

## 全体の流れ

```
[1] 作業前の確認 (5分)
       ↓
[2] GitHubリポジトリ作成 (5分)
       ↓
[3] ローカルにファイルを配置 (5分)
       ↓
[4] Git で GitHub にアップロード (5分)
       ↓
[5] GitHub Pages の有効化 (5分)
       ↓
[6] 公開URL の確認 (5分)
       ↓
[7] チームへの周知 (5分)
```

---

## STEP 1：作業前の確認

### お客様 → エンジニアへの伝達事項

エンジニアの方に以下を口頭で確認してください：

```
□ 組織アカウント（例：your-company）にログインできますか？
□ 新しいリポジトリを作成する権限がありますか？
□ 今、Git が使えるPCはありますか？
□ 30〜45分の作業時間を確保できますか？
```

すべて「はい」なら、次に進みます。

### お客様側の準備

配布されたファイルが以下のような構成になっていることを確認してください：

```
wms-project-hub/   ← フォルダ
├── index.html                          ← トップページ
├── README.md                           ← この手順書と一緒に表示される説明
├── SETUP.md                            ← この手順書
├── WMS_仕様書_v3.1.docx
├── WMS_API仕様書_v3.1.docx
├── WMS_ER図_v3.0.html
├── WMS_印刷帳票仕様書_v3.0.docx
├── WMS_実装ガイド_v3.1.docx
├── Manual_Web_v3.1.docx
├── Manual_HT_v3.0.docx
├── WMS_印刷サンプル集_v3.0.html
├── WMS_Web_master_warehouse_owner.html
├── WMS_Set1_master.html
├── WMS_Set2_inventory.html
├── WMS_Set3_outbound.html
├── WMS_Set4_workforce_PC.html
├── WMS_Set4_workforce_App.html
├── WMS_Set5_portal.html
├── WMS_GroupA_master.html
├── WMS_GroupB_billing.html
└── WMS_GroupC_report.html
```

---

## STEP 2：GitHub リポジトリを作成

### エンジニア側の作業

ブラウザで GitHub にログインし、以下を実行してください。

1. 組織アカウント（例：`your-company`）に切り替え
2. 右上の `+` → **New repository** をクリック
3. 以下を入力：

| 項目 | 値 |
|---|---|
| Owner | （あなたの組織名） |
| Repository name | **`wms-project-hub`** |
| Description | `3PL対応 WMS の仕様策定・開発進捗管理ハブ` |
| Public / Private | **Public**（公開） |
| Add a README file | **チェックしない**（後でアップロードするため） |
| Add .gitignore | None |
| Choose a license | None |

4. **Create repository** をクリック

### お客様側

エンジニアが作成したリポジトリのURLを確認してください。次のような形式です：

```
https://github.com/your-company/wms-project-hub
```

このURLを覚えておきましょう。

---

## STEP 3：ローカルにファイルを配置

### エンジニア側の作業

1. ターミナル（Mac）または Git Bash（Windows）を開く
2. 適当な作業ディレクトリに移動
   ```bash
   cd ~/Desktop  # 例
   ```
3. リポジトリをクローン
   ```bash
   git clone https://github.com/your-company/wms-project-hub.git
   cd wms-project-hub
   ```

### お客様 → エンジニアにファイルを渡す

配布された `wms-project-hub/` フォルダの**中身全部**を、エンジニアがクローンしたフォルダ（`wms-project-hub/`）にコピーしてください。

確認：
```bash
ls -la
# index.html, README.md, SETUP.md, WMS_*.docx, WMS_*.html などが見えればOK
```

---

## STEP 4：Git でアップロード

### エンジニア側の作業

```bash
# 変更内容を確認
git status

# すべてのファイルをステージング
git add .

# コミット
git commit -m "Initial commit: WMS Project Hub"

# GitHub にプッシュ
git push origin main
```

`git push` で GitHub のユーザー名・パスワード（または Personal Access Token）を求められた場合、入力してください。

### 確認

ブラウザで GitHub のリポジトリページを開きます：
```
https://github.com/your-company/wms-project-hub
```

ファイルがすべてアップロードされていれば成功です。

---

## STEP 5：GitHub Pages を有効化

### エンジニア側の作業

1. リポジトリページ右上の **Settings** をクリック
2. 左メニューから **Pages** をクリック
3. 以下を設定：

| 項目 | 値 |
|---|---|
| Source | **Deploy from a branch** |
| Branch | **main** |
| Folder | **/ (root)** |

4. **Save** をクリック

### 公開を待つ

設定後、GitHub が自動的にビルドします。**1〜2分待ってから**ページをリロードすると、画面上部に以下のような表示が出ます：

```
Your site is live at https://your-company.github.io/wms-project-hub/
```

---

## STEP 6：公開URLの確認

### お客様とエンジニアが一緒に確認

ブラウザで以下のURLを開いてみましょう：

```
https://your-company.github.io/wms-project-hub/
```

確認ポイント：

```
□ サイドバーに「ダッシュボード」「画面モック」などのメニューが表示される
□ ダッシュボードのKPIタイル（98機能、65画面 等）が表示される
□ 画面モックタブをクリックして 65画面が見える
□ 画面モックのカードをクリックして該当HTMLが新タブで開く
□ ドキュメントタブで仕様書のダウンロードリンクがある
□ 追加機能リストで98機能が表示・検索できる
```

すべてOKなら**公開完了**です。

---

## STEP 7：チームへの周知

### メール文例

お客様からチームに送るメール文例を、別ファイル `ANNOUNCE.md` に用意しています。コピーしてご利用ください。

---

## トラブルシューティング

### 問題1：GitHub Pages の設定後も「Page not found」が出る

- **原因**：ビルドに時間がかかっている、またはファイル名が `index.html` になっていない
- **対処**：
  - 5分待ってから再度アクセス
  - `index.html` がリポジトリのルートにあるか確認

### 問題2：画面モックのリンクが切れている

- **原因**：ファイルがアップロードされていない、または相対パスの不一致
- **対処**：
  ```bash
  ls *.html
  # 全HTMLファイルが表示されるか確認
  git status
  # 未追跡ファイルがあれば git add . && git commit -m "Add files" && git push
  ```

### 問題3：日本語が文字化けする

- **原因**：HTMLファイルの文字コードが UTF-8 でない
- **対処**：通常はあり得ません。配布されたファイルはすべて UTF-8 です。

### 問題4：Word/PDFファイルがブラウザで開けない

- **正常動作**：ブラウザによってはダウンロードされる仕様です。Word の場合はダウンロード後にローカルで開いてください。

---

## 今後の更新方法

ファイルを更新する場合の手順は別ファイル `MAINTENANCE.md` を参照してください。

---

## 困ったとき

エンジニアの方が解決できない場合、以下に問い合わせ：

- GitHub公式ドキュメント: https://docs.github.com/ja/pages
- GitHub Pages トラブルシューティング: https://docs.github.com/ja/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites
