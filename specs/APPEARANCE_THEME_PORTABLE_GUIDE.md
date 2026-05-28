# 外観設定（配色テーマ）機能 — 他サイト移植用 指示書

このドキュメントは **コピペ用の自己完結指示書** です。任意のWebサイト（HTML+CSS+JS で作られたもの）に、「配色テーマ（罫線・アクセント・アラート・背景の各色をユーザーが変更できる設定画面）」を追加するための完全な手順とコードを含みます。

---

## 1. この機能でできること

- ユーザーが**配色を画面から自由に変更**できる
- 変更は**即時プレビュー**、保存ボタンで `localStorage` に永続化
- 全ページに**自動適用**（共通 JS が起動時に CSS 変数を上書き）
- **テーマプリセット**（MORIKA/ネイビー/グレー/ブルー/グリーン/ウォーム の6種）で一括変更可
- 「既定に戻す」でリセット
- 編集可能な変数は **9個**（後述）

---

## 2. 前提条件

対象サイトが以下を満たすこと：

1. **CSS で `:root` の CSS カスタムプロパティ（変数）を使って配色を管理している**
   - 例: `--c-line`, `--c-accent` のような形
   - もし生の色値（`#1a3a5c` など）が直接書かれている場合は、まず CSS 変数化が必要（手順は§7参照）
2. 全ページから読み込まれる**共通 JS ファイル**がある（無ければ新規作成 OK）
3. 全ページが**共通 CSS ファイル**を読み込んでいる

### サイトが使用すべき CSS 変数（標準セット）

```css
:root {
  /* 罫線 */
  --c-line: #cdd5df;       /* 通常の罫線（body 罫線・カード枠） */
  --c-line-dk: #94a3b8;    /* 強めの罫線（thead 下・強調用） */

  /* アクセント（ブランド色） */
  --c-accent: #1a3d6e;     /* 主アクション・active 表示 */
  --c-accent-dk: #132e52;  /* hover・濃いめ */
  --c-accent-lt: #e8eef5;  /* 薄い背景・active 背景 */

  /* アラート（警告色） */
  --c-alert: #be123c;      /* 削除・警告 */
  --c-alert-lt: #fff1f2;   /* アラート薄背景 */

  /* 背景 */
  --c-base: #ffffff;       /* カード・テーブル地 */
  --c-bg:   #f8fafc;       /* コンテンツ背景 */
}
```

**重要**: 変数名は上記と完全一致させる（または、後述のローダで `THEME_VARS` のマッピングを書き換える）。

---

## 3. 移植する3つの部品

| # | 種類 | ファイル例 | 役割 |
|---|---|---|---|
| A | JS | `js/theme-loader.js` または共通 layout JS に統合 | 起動時に localStorage を読み CSS 変数を上書き |
| B | HTML | `settings/appearance.html` | 設定画面（カラーピッカー + プリセット + プレビュー） |
| C | CSS | 既存共通 CSS の `:root` | §2 の変数を定義（または既存名と紐付け） |

---

## 4. 【コピペ A】JS ローダ

ファイル名: `js/theme-loader.js`（または共通 layout JS の冒頭に追記）

```javascript
// === 配色テーマ（ユーザー設定）===
// 編集可能な CSS 変数の値を localStorage に保存／読み込みし、
// 起動時に :root にスタイル上書きで適用する。
// 設定UIは appearance.html。
(function () {
  if (typeof window === 'undefined') return;

  const THEME_KEY = 'app-theme'; // localStorage キー。サイト名で書き換え可

  // 編集可能なキー → CSS 変数名 の対応
  // ※ サイトの変数名に合わせて書き換える
  const THEME_VARS = {
    line:      '--c-line',
    lineDk:    '--c-line-dk',
    accent:    '--c-accent',
    accentDk:  '--c-accent-dk',
    accentLt:  '--c-accent-lt',
    alert:     '--c-alert',
    alertLt:   '--c-alert-lt',
    base:      '--c-base',
    bg:        '--c-bg',
  };

  // テーマ全体プリセット
  const THEME_PRESETS = {
    default: { // 既定
      line: '#cdd5df', lineDk: '#94a3b8',
      accent: '#1a3d6e', accentDk: '#132e52', accentLt: '#e8eef5',
      alert: '#be123c', alertLt: '#fff1f2',
      base: '#ffffff', bg: '#f8fafc',
    },
    navy_strong: {
      line: '#bcc7d6', lineDk: '#6b7d96',
      accent: '#0b2545', accentDk: '#061632', accentLt: '#dbe2ec',
      alert: '#9f0d2f', alertLt: '#fdeef1',
      base: '#ffffff', bg: '#f3f6fa',
    },
    gray: {
      line: '#d4d4d4', lineDk: '#737373',
      accent: '#3f3f46', accentDk: '#27272a', accentLt: '#e7e7ea',
      alert: '#b91c1c', alertLt: '#fef2f2',
      base: '#ffffff', bg: '#fafafa',
    },
    blue: {
      line: '#bfd5e6', lineDk: '#5b86ab',
      accent: '#1d4ed8', accentDk: '#1e3a8a', accentLt: '#e0e7ff',
      alert: '#dc2626', alertLt: '#fee2e2',
      base: '#ffffff', bg: '#f1f5fb',
    },
    green: {
      line: '#c8d8c8', lineDk: '#6b8e6b',
      accent: '#166534', accentDk: '#0f3f1f', accentLt: '#dcfce7',
      alert: '#b91c1c', alertLt: '#fef2f2',
      base: '#ffffff', bg: '#f5faf5',
    },
    warm: {
      line: '#d8cdbf', lineDk: '#94806a',
      accent: '#7c2d12', accentDk: '#431407', accentLt: '#fef3e7',
      alert: '#b91c1c', alertLt: '#fef2f2',
      base: '#fffaf3', bg: '#fcf3e7',
    },
  };

  function readTheme() {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (v && typeof v === 'object') return v;
    } catch {}
    return null;
  }
  function applyTheme(theme) {
    const t = theme || readTheme();
    if (!t) return;
    for (const [k, varName] of Object.entries(THEME_VARS)) {
      if (typeof t[k] === 'string' && t[k]) {
        document.documentElement.style.setProperty(varName, t[k]);
      }
    }
  }
  function resetTheme() {
    try { localStorage.removeItem(THEME_KEY); } catch {}
    for (const varName of Object.values(THEME_VARS)) {
      document.documentElement.style.removeProperty(varName);
    }
  }

  window.APP_THEME = {
    apply: applyTheme,
    read: readTheme,
    save: (t) => { try { localStorage.setItem(THEME_KEY, JSON.stringify(t)); } catch {} ; applyTheme(t); },
    reset: resetTheme,
    presets: THEME_PRESETS,
    vars: THEME_VARS,
  };

  // 起動時に即適用（チラつき防止のため、ページのスタイル適用前に呼ぶのが理想）
  applyTheme();
})();
```

### このファイルを全ページから読み込む
HTML の `<head>` または `<body>` 末尾に：

```html
<script src="/js/theme-loader.js?v=YYYYMMDDHHMM"></script>
```

すでに共通 layout JS がある場合は、その冒頭に上記コードを移植して同梱するのが楽。

---

## 5. 【コピペ B】設定画面 HTML

ファイル名: `settings/appearance.html`（または任意のパス）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>外観設定（配色テーマ）</title>
<!-- 既存サイトの共通 CSS を読み込む -->
<link rel="stylesheet" href="/css/main.css?v=YYYYMMDDHHMM">
<style>
  .color-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
  .color-row .label { width: 220px; font-size: 13px; color: var(--c-text, #111); }
  .color-row .label small { display:block; font-size: 11px; color: var(--c-text-mute, #999); font-family: monospace; margin-top:2px; }
  .color-row .picker { display: flex; align-items: center; gap: 10px; }
  .color-row input[type="color"] { width: 46px; height: 30px; padding: 0; border: 1px solid var(--c-line-dk, #999); cursor: pointer; background: transparent; }
  .color-row .hex { font-family: monospace; font-size: 12px; width: 90px; }
  .preset-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .preset-btn { padding: 6px 14px; font-size: 12px; border: 1px solid var(--c-line-dk, #999); background: var(--c-base, #fff); cursor: pointer; min-width: 110px; }
  .preset-btn:hover { background: var(--c-bg, #f5f5f5); }
  .swatch-set { display: inline-flex; gap: 2px; vertical-align: middle; margin-right: 8px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border: 1px solid #00000022; }
  .actions { display: flex; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--c-line, #ddd); }
  .actions button { padding: 8px 16px; cursor: pointer; }
  .actions .primary { background: var(--c-accent, #1a3d6e); color: #fff; border: 1px solid var(--c-accent, #1a3d6e); }
  .section-h { font-size: 12px; font-weight: 700; color: var(--c-text-sub, #666); letter-spacing: 0.04em; padding: 10px 0 4px; border-bottom: 1px solid var(--c-line, #ddd); margin-bottom: 6px; }
  .card { background: var(--c-base, #fff); border: 1px solid var(--c-line, #ddd); margin-bottom: 14px; padding: 14px 16px; border-radius: 6px; }
  .card-header { font-size: 13px; font-weight: 600; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--c-line, #eee); }
  body { font-family: -apple-system, "Hiragino Sans", "Yu Gothic UI", sans-serif; padding: 20px; background: var(--c-bg, #f8fafc); }
</style>
</head>
<body>

<h1 style="font-size:18px; margin-bottom:16px;">外観設定（配色テーマ）</h1>

<div class="card" style="background: var(--c-accent-lt, #eef); border-left: 3px solid var(--c-accent, #1a3d6e); padding: 10px 14px;">
  罫線・アクセント・アラート・背景の各色をカスタマイズできます。
  変更は<b>即座にプレビュー反映</b>、「保存」で全画面に適用（このブラウザに保存）。「既定に戻す」でリセット。
</div>

<div class="card">
  <div class="card-header">テーマプリセット（全色一括）</div>
  <div class="preset-row" id="presets"></div>
</div>

<div class="card">
  <div class="card-header">カスタム調整</div>

  <div class="section-h">罫線</div>
  <div class="color-row"><span class="label">薄罫<small>--c-line</small></span><span class="picker"><input type="color" data-key="line"><span class="hex" data-hex="line"></span></span></div>
  <div class="color-row"><span class="label">濃罫<small>--c-line-dk</small></span><span class="picker"><input type="color" data-key="lineDk"><span class="hex" data-hex="lineDk"></span></span></div>

  <div class="section-h">アクセント（ブランド色）</div>
  <div class="color-row"><span class="label">アクセント<small>--c-accent</small></span><span class="picker"><input type="color" data-key="accent"><span class="hex" data-hex="accent"></span></span></div>
  <div class="color-row"><span class="label">アクセント（濃）<small>--c-accent-dk</small></span><span class="picker"><input type="color" data-key="accentDk"><span class="hex" data-hex="accentDk"></span></span></div>
  <div class="color-row"><span class="label">アクセント（薄）<small>--c-accent-lt</small></span><span class="picker"><input type="color" data-key="accentLt"><span class="hex" data-hex="accentLt"></span></span></div>

  <div class="section-h">アラート（警告色）</div>
  <div class="color-row"><span class="label">アラート<small>--c-alert</small></span><span class="picker"><input type="color" data-key="alert"><span class="hex" data-hex="alert"></span></span></div>
  <div class="color-row"><span class="label">アラート（薄）<small>--c-alert-lt</small></span><span class="picker"><input type="color" data-key="alertLt"><span class="hex" data-hex="alertLt"></span></span></div>

  <div class="section-h">背景</div>
  <div class="color-row"><span class="label">基面<small>--c-base</small></span><span class="picker"><input type="color" data-key="base"><span class="hex" data-hex="base"></span></span></div>
  <div class="color-row"><span class="label">補助<small>--c-bg</small></span><span class="picker"><input type="color" data-key="bg"><span class="hex" data-hex="bg"></span></span></div>

  <div class="actions">
    <button type="button" class="primary" id="btn-save">保存して全画面に適用</button>
    <button type="button" id="btn-reset">既定に戻す</button>
  </div>
</div>

<div class="card">
  <div class="card-header">プレビュー</div>
  <p style="font-size:12px; color:var(--c-text-sub, #666); margin-bottom:10px;">下記のサンプルで配色の見え方を確認できます。</p>
  <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
    <button style="padding:6px 14px; background:var(--c-accent); color:#fff; border:1px solid var(--c-accent);">主アクション</button>
    <button style="padding:6px 14px; background:var(--c-base); color:var(--c-text); border:1px solid var(--c-line-dk);">標準</button>
    <button style="padding:6px 14px; background:var(--c-alert); color:#fff; border:1px solid var(--c-alert);">削除</button>
  </div>
  <table style="border-collapse:collapse; width:100%; border:1px solid var(--c-line);">
    <thead><tr style="background:var(--c-bg);">
      <th style="padding:8px 12px; border:1px solid var(--c-line); border-bottom:1px solid var(--c-line-dk); text-align:left;">コード</th>
      <th style="padding:8px 12px; border:1px solid var(--c-line); border-bottom:1px solid var(--c-line-dk); text-align:left;">品名</th>
      <th style="padding:8px 12px; border:1px solid var(--c-line); border-bottom:1px solid var(--c-line-dk); text-align:right;">数量</th>
      <th style="padding:8px 12px; border:1px solid var(--c-line); border-bottom:1px solid var(--c-line-dk); text-align:center;">ステータス</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:8px 12px; border:1px solid var(--c-line);">S-00001</td><td style="padding:8px 12px; border:1px solid var(--c-line);">サンプルA</td><td style="padding:8px 12px; border:1px solid var(--c-line); text-align:right;">120</td><td style="padding:8px 12px; border:1px solid var(--c-line); text-align:center;"><span style="display:inline-block; padding:2px 10px; background:var(--c-accent-lt); color:var(--c-accent); border-radius:4px; font-size:11px;">出荷可</span></td></tr>
      <tr><td style="padding:8px 12px; border:1px solid var(--c-line);">S-00002</td><td style="padding:8px 12px; border:1px solid var(--c-line);">サンプルB</td><td style="padding:8px 12px; border:1px solid var(--c-line); text-align:right;">42</td><td style="padding:8px 12px; border:1px solid var(--c-line); text-align:center;"><span style="display:inline-block; padding:2px 10px; background:#f1f5f9; color:#64748b; border-radius:4px; font-size:11px;">保留</span></td></tr>
      <tr><td style="padding:8px 12px; border:1px solid var(--c-line);">S-00003</td><td style="padding:8px 12px; border:1px solid var(--c-line);">サンプルC</td><td style="padding:8px 12px; border:1px solid var(--c-line); text-align:right;">8</td><td style="padding:8px 12px; border:1px solid var(--c-line); text-align:center;"><span style="display:inline-block; padding:2px 10px; background:var(--c-alert-lt); color:var(--c-alert); border-radius:4px; font-size:11px;">引当不足</span></td></tr>
    </tbody>
  </table>
</div>

<!-- 共通 theme-loader.js を読み込む -->
<script src="/js/theme-loader.js?v=YYYYMMDDHHMM"></script>

<script>
(function () {
  const T = window.APP_THEME;
  if (!T) { console.warn('APP_THEME unavailable'); return; }
  const KEYS = Object.keys(T.vars);
  const presetsEl = document.getElementById('presets');

  function currentValues() {
    const saved = T.read();
    const base = T.presets.default;
    return saved ? { ...base, ...saved } : { ...base };
  }
  function setUI(values) {
    for (const k of KEYS) {
      const input = document.querySelector('input[data-key="' + k + '"]');
      const hex = document.querySelector('[data-hex="' + k + '"]');
      if (input && values[k]) input.value = values[k];
      if (hex) hex.textContent = values[k] || '';
    }
  }
  function readUI() {
    const out = {};
    for (const k of KEYS) {
      const input = document.querySelector('input[data-key="' + k + '"]');
      if (input) out[k] = input.value;
    }
    return out;
  }
  function previewApply() {
    const v = readUI();
    for (const k of KEYS) {
      const hex = document.querySelector('[data-hex="' + k + '"]');
      if (hex) hex.textContent = v[k];
      document.documentElement.style.setProperty(T.vars[k], v[k]);
    }
  }

  const labels = { default: '既定', navy_strong: 'ネイビー濃', gray: 'グレー', blue: 'ブルー', green: 'グリーン', warm: 'ウォーム' };
  for (const key of Object.keys(T.presets)) {
    const p = T.presets[key];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset-btn';
    const swatches = [p.accent, p.lineDk, p.alert, p.bg].map(c => `<span class="swatch" style="background:${c};"></span>`).join('');
    b.innerHTML = `<span class="swatch-set">${swatches}</span>${labels[key] || key}`;
    b.addEventListener('click', () => { setUI(p); previewApply(); });
    presetsEl.appendChild(b);
  }

  setUI(currentValues());
  document.querySelectorAll('input[type="color"][data-key]').forEach(inp => inp.addEventListener('input', previewApply));

  document.getElementById('btn-save').addEventListener('click', () => {
    T.save(readUI());
    alert('保存しました（全画面に反映）');
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    T.reset();
    setUI(T.presets.default);
    for (const varName of Object.values(T.vars)) {
      document.documentElement.style.removeProperty(varName);
    }
    alert('既定値に戻しました');
  });
})();
</script>

</body>
</html>
```

---

## 6. 適用手順（任意サイトに展開する流れ）

1. **CSS 変数の準備**（§2 のセットを既存 CSS の `:root` に追加・または既存名にマッピング）
2. **`js/theme-loader.js` を配置**（§4 をコピペ）
3. **全ページに `<script src="/js/theme-loader.js?v=...">` を追加**（共通 layout JS があるならその冒頭に統合でも可）
4. **`settings/appearance.html` を配置**（§5 をコピペ・`/css/main.css` 部分は対象サイトの共通 CSS パスに書き換え）
5. **サイドバー／メニューに「外観設定」リンク追加**
6. **キャッシュバスター `?v=` を bump**

---

## 7. 既存サイトが CSS 変数を使っていない場合

生の色値が CSS にベタ書きされている場合の段取り：

1. 主要な色を 9個（§2）に整理（同じ色が何度も出てくるはず）
2. CSS の最上部に `:root { --c-... }` 定義を追加
3. ベタ書きの色値を sed や IDE で一括置換  
   例: `#1a3a5c` → `var(--c-accent)`
4. 主要画面で見た目が変わっていないか確認
5. その後で §4-§6 を適用

**重要**: この CSS 変数化は **既存サイトのデザインを完全に保つ**ように行う（色を変えるのではなく、変数経由に切り替えるだけ）。

---

## 8. 動作確認（verify）

| # | 確認項目 | 方法 |
|---|---|---|
| 1 | 設定画面が開く | ブラウザで `/settings/appearance.html` を開く |
| 2 | カラーピッカーで色を変更 → プレビューが即変わる | 任意のピッカーを動かす |
| 3 | プリセットで全色が一括変更される | プリセットボタン押す |
| 4 | 「保存」を押すと localStorage に記録 | DevTools → Application → Local Storage で `app-theme` キー確認 |
| 5 | 別ページに移動しても色設定が引き継がれている | 他ページを開く |
| 6 | 「既定に戻す」で localStorage がクリアされ、デフォルトに戻る | DevTools で localStorage を確認 |
| 7 | localStorage を手動で消してもデフォルト表示が壊れない | localStorage.clear() → リロード |

---

## 9. カスタマイズポイント

| 変えたいこと | 編集箇所 |
|---|---|
| プリセットの種類を増やす／減らす | `THEME_PRESETS` |
| 編集可能な変数を増やす（例: テキスト色、アンセフェ色） | `THEME_VARS` に追加 + appearance.html に `<input>` 行を追加 |
| localStorage のキー名 | `THEME_KEY` |
| デフォルト値（CSS の `:root` 値）| 既存 CSS の `:root` 値 |
| グローバル名 `APP_THEME` | `window.APP_THEME` を任意の名前に |

---

## 10. よくある落とし穴

- **CSS の `?v=` キャッシュバスティング忘れ** → 古いキャッシュが残ってデバッグで混乱する。CSS/JS 変更時は必ず bump
- **`THEME_VARS` の変数名が CSS と不一致** → 適用されない。CSS 側と完全一致させる
- **`theme-loader.js` の読み込み順** → 他の JS より**前**に置く（チラつき防止）
- **`!important` で色が固定されている箇所** → CSS 変数で上書きできない。`!important` を外すか、変数自体に `!important` を付ける
- **localStorage が無効化されたブラウザ** → try/catch で握りつぶしているのでエラーにはならないが、保存できない（仕様として許容）

---

## 11. ライセンス・由来

このパターンは WMS テストサイト2（`~/github/wms-test2/`）で実装・運用中の機能を抽出したもの。
無償・自由に利用・改変可。クレジット不要。

実装ファイル参照:
- `~/github/wms-test2/public/js/common-layout.js`（`WMS_THEME` 部分）
- `~/github/wms-test2/public/pc/settings/appearance.html`
- `~/github/wms-test2/public/css/test2.css`（`:root` 配色変数）

---

## 12. 1ファイル完結版

JS と HTML を別ファイルに分けず、1つの HTML 内で完結したい場合：
- §5 の HTML の `<script src="/js/theme-loader.js">` の代わりに、§4 のコードを `<script>` ブロックとして直接埋め込む
- ただし他ページに反映するためには、§4 のローダだけは別ファイル化して全ページから読み込む必要がある（または各ページに同じ `<script>` ブロックを置く）

以上。
