# メンテナンス手順書

WMS Project Hub の更新・メンテナンス手順です。

---

## ファイルを更新したいとき

### よくあるケース

- 仕様書が新版（v3.2 など）になった
- 新しい画面モックが追加された
- 整理表に新しい機能が追加された
- 進捗状況を更新したい

### 手順（最もシンプル：GitHub Web UIから直接編集）

#### 単一ファイルの差し替え

1. GitHub のリポジトリページを開く
2. 差し替えたいファイル（例：`WMS_仕様書_v3.1.docx`）をクリック
3. 右上のゴミ箱アイコンで削除 → コミット
4. 同じ画面で **Add file → Upload files** で新ファイルをアップロード
5. コミットメッセージに「`WMS_仕様書を v3.2 に更新`」など書いて、Commit changes
6. **1〜2分待つ** → 公開サイトが自動更新される

#### 複数ファイルの差し替え（一括）

GitHubのWeb UIで複数ファイルを一度に処理するのは面倒なので、ローカルで作業してgit pushする方法が早い：

```bash
# リポジトリに移動
cd ~/Desktop/wms-project-hub

# 最新を取得
git pull origin main

# 古いファイルを削除して新ファイルを配置
# （macOS / Linux の例）
rm WMS_仕様書_v3.1.docx
cp ~/Downloads/WMS_仕様書_v3.2.docx .

# 変更を確認
git status

# コミット & プッシュ
git add .
git commit -m "WMS_仕様書を v3.2 に更新"
git push origin main
```

---

## index.html を更新したいとき

進捗状況やKPI数値を更新する場合、`index.html` の中身を編集します。

### 編集箇所の目安

| 編集したい項目 | 検索キーワード |
|---|---|
| 最終更新日 | `最終更新：` |
| KPIの数値（98機能・65画面 等） | `class="val"` |
| フェーズの進捗% | `<div class="pct">` |
| 工程レビューの状態 | `<span class="pill pill-` |
| 確定事項の追加 | `<div class="decision">` |

### 編集方法（エンジニアが直接編集）

1. GitHub のリポジトリページで `index.html` を開く
2. 右上の鉛筆アイコン（編集）をクリック
3. 該当箇所を編集
4. 下部のコミットメッセージを書いて Commit changes
5. 1〜2分後に公開サイトが更新される

---

## 画面モックを追加したいとき

新しい画面モックHTMLを公開サイトに追加する場合：

### Step 1：ファイルをアップロード

```bash
git pull
cp ~/Downloads/WMS_NewScreens.html .
git add WMS_NewScreens.html
git commit -m "新画面モック追加"
git push
```

### Step 2：index.htmlに登録

`index.html` の以下の部分を編集：

```javascript
const screens = [
  // 既存のリスト...
  
  // 末尾に追記
  {id:'W-XXX', name:'新画面名', device:'pc', file:'WMS_NewScreens.html#W-XXX'},
];
```

その後、画面数を表示している箇所も更新：

```html
<!-- KPI部分 -->
<div class="val">66</div>  <!-- 65 → 66 に更新 -->

<!-- タブのカウント -->
<div class="tab" data-screen-tab="all">すべて (66)</div>
```

---

## 古いバージョンに戻したいとき

GitHubは過去のすべての変更履歴を保持しています。

### Step 1：履歴を確認

GitHubリポジトリの **Commits** タブで過去の変更履歴が見られます。

### Step 2：特定のバージョンに戻す

```bash
# コミットハッシュを指定して特定バージョンに戻す
git revert <コミットハッシュ>
git push
```

または、特定のファイルだけ戻す：

```bash
git checkout <コミットハッシュ> -- ファイル名
git commit -m "Revert ファイル名 to old version"
git push
```

---

## 公開サイトのキャッシュをクリアしたいとき

ファイルを更新したのに公開サイトが古いまま、というときは、ブラウザのキャッシュを削除：

- **Chrome / Edge**: Ctrl + Shift + R（Windows）/ Cmd + Shift + R（Mac）
- **Firefox**: 同上
- **Safari**: Cmd + Option + R

それでも反映されない場合、5〜10分待ってから再度アクセス。

---

## アクセス権限の管理

### 編集権限を増やしたいとき

エンジニアがリポジトリにアクセスできない場合：

1. リポジトリの Settings → Manage access
2. **Add people** でユーザーを追加
3. 権限を選択：
   - Read: 閲覧のみ
   - Write: 編集可能
   - Admin: 設定変更可能

### リポジトリを非公開にしたい

将来、機密情報が増えてきた場合：

1. Settings → 一番下の Danger Zone
2. **Change visibility** → Private
3. （注意）GitHub Pagesの公開URLは Private にすると停止する場合あり

---

## トラブル時の連絡先

- GitHub公式サポート: https://support.github.com/
- 社内のGitHub管理者（IT部門）

---

## メンテナンス頻度の目安

| 頻度 | 内容 |
|---|---|
| 都度（仕様変更時） | ドキュメント更新、画面モック追加 |
| 週1回程度 | 進捗状況の更新（フェーズ・工程の進捗%） |
| 大型変更時 | バージョン更新（v3.1 → v4.0 など） |
