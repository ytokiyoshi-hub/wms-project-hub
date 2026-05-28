# 外観設定（配色テーマ）機能 — React 版 他サイト移植用 指示書

このドキュメントは **React + インライン style で組まれたサイト** に「配色テーマ（罫線・アクセント・アラート・背景の各色をユーザーが変更できる設定画面）」を追加するための **コピペ用自己完結指示書** です。

CSS 変数ベースの通常版は別ファイル `APPEARANCE_THEME_PORTABLE_GUIDE.md` を参照。

---

## 1. この機能でできること

- ユーザーが**配色を画面から自由に変更**できる
- 変更は**即時プレビュー**、保存ボタンで `localStorage` に永続化
- 全コンポーネントに**自動適用**（ThemeContext で配信）
- **テーマプリセット**（既定/ネイビー濃/グレー/ブルー/グリーン/ウォーム の6種）で一括変更可
- 「既定に戻す」でリセット
- 編集可能な色は **9個**

---

## 2. 前提条件

対象サイトが以下を満たすこと：

1. **React** で組まれている（バージョン 16.8+ / Hooks 利用可）
2. JSX が使える（babel standalone でも、Vite/CRA でも可）
3. **色値が hex 文字列（`"#xxx"`）でハードコーディングされていてもOK**（むしろそれを置き換えるための指示書）

---

## 3. 移植する4つの部品

| # | 種類 | 役割 |
|---|---|---|
| A | ThemeContext + Provider | 全コンポーネントに theme を配信し localStorage と同期 |
| B | useTheme() フック | 各コンポーネントから theme を受け取る |
| C | AppearanceSettings コンポーネント | 設定UI（カラーピッカー＋プリセット＋プレビュー） |
| D | リファクタ手順 | 既存の `"#xxx"` ハードコードを `theme.xxx` 参照に置換 |

---

## 4. 【コピペ A+B】ThemeContext + Provider + useTheme

これを React アプリの「最上位」に近い位置に置きます。babel standalone なら `<script type="text/babel">` 内、ビルドツール環境なら `src/theme.jsx` のような独立ファイル。

```jsx
// === ThemeContext: 配色テーマを全コンポーネントに配信 ===
const THEME_KEY = 'app-theme'; // localStorage キー（サイト名で書き換え可）

// テーマ全体プリセット
const THEME_PRESETS = {
  default: {
    line: '#cdd5df', lineDk: '#94a3b8',
    accent: '#0ea5e9', accentDk: '#0369a1', accentLt: '#e0f2fe',
    alert: '#dc2626', alertLt: '#fef2f2',
    base: '#ffffff', bg: '#f4f5f7',
    text: '#1a1f2e', textSub: '#6b7280', textMute: '#9ca3af',
  },
  navy_strong: {
    line: '#bcc7d6', lineDk: '#6b7d96',
    accent: '#0b2545', accentDk: '#061632', accentLt: '#dbe2ec',
    alert: '#9f0d2f', alertLt: '#fdeef1',
    base: '#ffffff', bg: '#f3f6fa',
    text: '#0f172a', textSub: '#475569', textMute: '#94a3b8',
  },
  gray: {
    line: '#d4d4d4', lineDk: '#737373',
    accent: '#3f3f46', accentDk: '#27272a', accentLt: '#e7e7ea',
    alert: '#b91c1c', alertLt: '#fef2f2',
    base: '#ffffff', bg: '#fafafa',
    text: '#18181b', textSub: '#52525b', textMute: '#a1a1aa',
  },
  blue: {
    line: '#bfd5e6', lineDk: '#5b86ab',
    accent: '#1d4ed8', accentDk: '#1e3a8a', accentLt: '#e0e7ff',
    alert: '#dc2626', alertLt: '#fee2e2',
    base: '#ffffff', bg: '#f1f5fb',
    text: '#0f172a', textSub: '#475569', textMute: '#94a3b8',
  },
  green: {
    line: '#c8d8c8', lineDk: '#6b8e6b',
    accent: '#166534', accentDk: '#0f3f1f', accentLt: '#dcfce7',
    alert: '#b91c1c', alertLt: '#fef2f2',
    base: '#ffffff', bg: '#f5faf5',
    text: '#0f172a', textSub: '#475569', textMute: '#94a3b8',
  },
  warm: {
    line: '#d8cdbf', lineDk: '#94806a',
    accent: '#7c2d12', accentDk: '#431407', accentLt: '#fef3e7',
    alert: '#b91c1c', alertLt: '#fef2f2',
    base: '#fffaf3', bg: '#fcf3e7',
    text: '#1c1917', textSub: '#57534e', textMute: '#a8a29e',
  },
};

const ThemeContext = React.createContext(null);

function ThemeProvider({ children }) {
  const [theme, setThemeState] = React.useState(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          return { ...THEME_PRESETS.default, ...saved };
        }
      }
    } catch {}
    return THEME_PRESETS.default;
  });

  const setTheme = React.useCallback((next) => {
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const previewTheme = React.useCallback((next) => {
    setThemeState(next); // localStorage に書かない（保存ボタン押下で書く想定）
  }, []);

  const resetTheme = React.useCallback(() => {
    try { localStorage.removeItem(THEME_KEY); } catch {}
    setThemeState(THEME_PRESETS.default);
  }, []);

  const value = React.useMemo(() => ({
    theme,
    setTheme,        // 保存も同時に行う
    previewTheme,    // 一時プレビュー（保存しない）
    resetTheme,
    presets: THEME_PRESETS,
  }), [theme, setTheme, previewTheme, resetTheme]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Provider 未配置時のフォールバック
    return { theme: THEME_PRESETS.default, setTheme: () => {}, previewTheme: () => {}, resetTheme: () => {}, presets: THEME_PRESETS };
  }
  return ctx;
}
```

### 使い方：アプリのルートを ThemeProvider で包む

```jsx
function App() {
  return (
    <ThemeProvider>
      <YourRootComponent />
    </ThemeProvider>
  );
}
```

babel standalone での例：

```jsx
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ThemeProvider><App /></ThemeProvider>);
```

---

## 5. 【コピペ C】AppearanceSettings コンポーネント

これを「設定画面」として使います。サイドバーから飛ぶページ／タブ／モーダルのどこに置いても動きます。

```jsx
function AppearanceSettings() {
  const { theme, setTheme, previewTheme, resetTheme, presets } = useTheme();
  const [draft, setDraft] = React.useState(theme);

  // theme（保存値）が変わったら draft も追従（リセット時など）
  React.useEffect(() => { setDraft(theme); }, [theme]);

  // ピッカー変更 → 即プレビュー（draft 更新 + 一時適用）
  const onChange = (key, value) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    previewTheme(next);
  };

  const applyPreset = (preset) => {
    setDraft(preset);
    previewTheme(preset);
  };

  const onSave = () => {
    setTheme(draft);
    alert('保存しました');
  };

  const onReset = () => {
    resetTheme();
    setDraft(presets.default);
    alert('既定値に戻しました');
  };

  // 入力フィールド設計
  const fields = [
    { group: '罫線', items: [
      { key: 'line',     label: '薄罫',         hint: 'body の罫線' },
      { key: 'lineDk',   label: '濃罫',         hint: '強調・thead 下' },
    ]},
    { group: 'アクセント（ブランド色）', items: [
      { key: 'accent',   label: 'アクセント',   hint: '主アクション' },
      { key: 'accentDk', label: 'アクセント濃', hint: 'hover' },
      { key: 'accentLt', label: 'アクセント薄', hint: 'active 背景' },
    ]},
    { group: 'アラート（警告色）', items: [
      { key: 'alert',    label: 'アラート',     hint: '削除・警告' },
      { key: 'alertLt',  label: 'アラート薄',   hint: '背景' },
    ]},
    { group: '背景', items: [
      { key: 'base',     label: '基面',         hint: 'カード地' },
      { key: 'bg',       label: '補助',         hint: 'コンテンツ背景' },
    ]},
    { group: 'テキスト', items: [
      { key: 'text',     label: '本文',         hint: '主要テキスト' },
      { key: 'textSub',  label: 'サブ',         hint: 'ラベル・補助' },
      { key: 'textMute', label: 'ミュート',     hint: '無効・脚注' },
    ]},
  ];

  const presetLabels = {
    default: '既定', navy_strong: 'ネイビー濃', gray: 'グレー',
    blue: 'ブルー', green: 'グリーン', warm: 'ウォーム',
  };

  // スタイル（テーマ自身を参照）
  const S = {
    page: { padding: 20, background: draft.bg, minHeight: '100vh', fontFamily: 'sans-serif' },
    h1: { fontSize: 18, marginBottom: 16, color: draft.text },
    card: { background: draft.base, border: `1px solid ${draft.line}`, padding: 16, marginBottom: 14, borderRadius: 6 },
    cardHead: { fontSize: 13, fontWeight: 600, paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${draft.line}`, color: draft.text },
    sectionH: { fontSize: 12, fontWeight: 700, color: draft.textSub, letterSpacing: 0.4, padding: '10px 0 4px', borderBottom: `1px solid ${draft.line}`, marginBottom: 6 },
    row: { display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0' },
    label: { width: 200, fontSize: 13, color: draft.text },
    hint: { display: 'block', fontSize: 11, color: draft.textMute, marginTop: 2 },
    picker: { display: 'flex', alignItems: 'center', gap: 10 },
    color: { width: 46, height: 30, padding: 0, border: `1px solid ${draft.lineDk}`, cursor: 'pointer', background: 'transparent' },
    hex: { fontFamily: 'monospace', fontSize: 12, width: 90, color: draft.text },
    presetWrap: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    preset: { padding: '6px 12px', fontSize: 12, border: `1px solid ${draft.lineDk}`, background: draft.base, color: draft.text, cursor: 'pointer', minWidth: 110, display: 'inline-flex', alignItems: 'center', gap: 6 },
    swatchSet: { display: 'inline-flex', gap: 2 },
    swatch: (c) => ({ display: 'inline-block', width: 12, height: 12, background: c, border: '1px solid #00000022' }),
    actions: { display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${draft.line}` },
    btnPrimary: { padding: '8px 16px', cursor: 'pointer', background: draft.accent, color: '#fff', border: `1px solid ${draft.accent}`, fontWeight: 600 },
    btn: { padding: '8px 16px', cursor: 'pointer', background: draft.base, color: draft.text, border: `1px solid ${draft.lineDk}` },
    note: { background: draft.accentLt, borderLeft: `3px solid ${draft.accent}`, padding: '10px 14px', fontSize: 12, color: draft.text, marginBottom: 14, borderRadius: 4 },
  };

  return (
    <div style={S.page}>
      <h1 style={S.h1}>外観設定（配色テーマ）</h1>

      <div style={S.note}>
        罫線・アクセント・アラート・背景・テキストの各色をカスタマイズできます。
        変更は <b>即座にプレビュー反映</b>、「保存」で永続化（このブラウザに保存）。「既定に戻す」でリセット。
      </div>

      <div style={S.card}>
        <div style={S.cardHead}>テーマプリセット（全色一括）</div>
        <div style={S.presetWrap}>
          {Object.keys(presets).map(key => {
            const p = presets[key];
            const swatches = [p.accent, p.lineDk, p.alert, p.bg];
            return (
              <button key={key} type="button" style={S.preset} onClick={() => applyPreset(p)}>
                <span style={S.swatchSet}>
                  {swatches.map((c, i) => <span key={i} style={S.swatch(c)} />)}
                </span>
                {presetLabels[key] || key}
              </button>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHead}>カスタム調整</div>
        {fields.map(group => (
          <React.Fragment key={group.group}>
            <div style={S.sectionH}>{group.group}</div>
            {group.items.map(it => (
              <div style={S.row} key={it.key}>
                <span style={S.label}>
                  {it.label}
                  <small style={S.hint}>{it.hint}（{it.key}）</small>
                </span>
                <span style={S.picker}>
                  <input type="color" style={S.color}
                    value={draft[it.key] || '#000000'}
                    onChange={(e) => onChange(it.key, e.target.value)} />
                  <span style={S.hex}>{draft[it.key]}</span>
                </span>
              </div>
            ))}
          </React.Fragment>
        ))}
        <div style={S.actions}>
          <button type="button" style={S.btnPrimary} onClick={onSave}>保存して全画面に適用</button>
          <button type="button" style={S.btn} onClick={onReset}>既定に戻す</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHead}>プレビュー</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button style={S.btnPrimary}>主アクション</button>
          <button style={S.btn}>標準</button>
          <button style={{ ...S.btnPrimary, background: draft.alert, borderColor: draft.alert }}>削除</button>
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%', border: `1px solid ${draft.line}` }}>
          <thead>
            <tr style={{ background: draft.bg }}>
              <th style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, borderBottom: `1px solid ${draft.lineDk}`, textAlign: 'left', color: draft.textSub, fontSize: 12 }}>コード</th>
              <th style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, borderBottom: `1px solid ${draft.lineDk}`, textAlign: 'left', color: draft.textSub, fontSize: 12 }}>品名</th>
              <th style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, borderBottom: `1px solid ${draft.lineDk}`, textAlign: 'right', color: draft.textSub, fontSize: 12 }}>数量</th>
              <th style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, borderBottom: `1px solid ${draft.lineDk}`, textAlign: 'center', color: draft.textSub, fontSize: 12 }}>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {[
              { c: 'S-00001', n: 'サンプルA', q: 120, s: { l: '出荷可', bg: draft.accentLt, fg: draft.accent } },
              { c: 'S-00002', n: 'サンプルB', q: 42,  s: { l: '保留',   bg: '#f1f5f9',     fg: draft.textSub } },
              { c: 'S-00003', n: 'サンプルC', q: 8,   s: { l: '引当不足', bg: draft.alertLt, fg: draft.alert } },
            ].map(row => (
              <tr key={row.c}>
                <td style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, color: draft.text, fontSize: 13 }}>{row.c}</td>
                <td style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, color: draft.text, fontSize: 13 }}>{row.n}</td>
                <td style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, color: draft.text, fontSize: 13, textAlign: 'right' }}>{row.q}</td>
                <td style={{ padding: '8px 12px', border: `1px solid ${draft.line}`, textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', background: row.s.bg, color: row.s.fg, borderRadius: 4, fontSize: 11 }}>{row.s.l}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 6. 【コピペ D】既存ハードコード色の置換パターン

既存コードに `"#0ea5e9"` のような hex がベタ書きされている箇所を、`theme.xxx` に置き換えます。

### Before（既存のハードコード）

```jsx
const Card = ({ children }) => (
  <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e8eaed" }}>
    {children}
  </div>
);

const accent = "#0ea5e9";
// ...
<button style={{ background: accent, color: "#fff", border: `1.5px solid ${accent}` }}>保存</button>
```

### After（theme 経由）

```jsx
const Card = ({ children }) => {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.base, borderRadius: 8, border: `1px solid ${theme.line}` }}>
      {children}
    </div>
  );
};

// `const accent = "#0ea5e9"` は削除し、必要箇所で:
function SaveButton() {
  const { theme } = useTheme();
  return (
    <button style={{ background: theme.accent, color: "#fff", border: `1.5px solid ${theme.accent}` }}>
      保存
    </button>
  );
}
```

### 置換マッピング目安

| 既存の hex | 多くは theme.xxx |
|---|---|
| `#fff`, `#ffffff`（カード背景・地） | `theme.base` |
| `#f4f5f7`, `#f8fafc` 等のうすグレー（body 背景） | `theme.bg` |
| `#0ea5e9`, `#1a3a5c` などのブランド色 | `theme.accent` |
| `#dc2626`, `#b91c1c` などの赤系（エラー・削除） | `theme.alert` |
| `#e5e7eb`, `#e8eaed`, `#f1f5f9` などの枠線 | `theme.line` |
| `#9ca3af`, `#cbd5e1` などの強めの枠線 | `theme.lineDk` |
| `#111827`, `#1a1f2e` などの本文文字 | `theme.text` |
| `#6b7280` などのラベル文字 | `theme.textSub` |
| `#9ca3af` などのミュート文字 | `theme.textMute` |
| `#fef2f2`, `#fee2e2`（エラー薄背景） | `theme.alertLt` |
| `#e0f2fe`, `#eff6ff`（アクセント薄背景） | `theme.accentLt` |

### 置換しない（変えない）色
- グラフ系の系列カラー（凡例の色分け）
- カテゴリラベル色マップ（重要・請求・運行 など）
  - これらは「ブランド色」ではなく「意味の色」なので、テーマプリセットで変えない方が一貫性が保てる
- 影（box-shadow の `rgba(0,0,0,0.x)`）も基本据え置きで OK

---

## 7. 適用手順（j-transport-portal のような単一HTML React SPA の場合）

1. **HTML の `<script type="text/babel">` ブロックの最初に §4 のコードを追加**
2. **アプリのルートを `<ThemeProvider>` で包む**：
   ```jsx
   root.render(<ThemeProvider><App /></ThemeProvider>);
   ```
3. **§5 の `AppearanceSettings` コンポーネントを追加**
4. **ナビゲーションメニューに「外観設定」リンクを追加**（既存のページ切替の仕組みに合わせて）
5. **§6 のパターンで、既存の hex ベタ書きを `theme.xxx` に段階的に置換**
   - 最初は主要コンポーネント（Card / Button / Sidebar）のみでも体感は変わる
   - 残りは見つけ次第ぼちぼち置換でOK
6. **動作確認**（§8）

---

## 8. 動作確認（verify）

| # | 項目 | 方法 |
|---|---|---|
| 1 | 設定画面を開く | ナビから「外観設定」へ |
| 2 | プリセットボタンを押す | 全画面が一括で色変わる |
| 3 | カラーピッカーで個別変更 → プレビュー即反映 | 任意のピッカー操作 |
| 4 | 「保存」押下 → localStorage に書込み確認 | DevTools → Application → Local Storage → `app-theme` キー |
| 5 | ページ遷移しても色設定が維持される | 他ページに移動して戻る |
| 6 | リロード後も色設定が維持される | F5 押下 |
| 7 | 「既定に戻す」で localStorage 削除＆デフォルト復帰 | DevTools で確認 |

---

## 9. カスタマイズポイント

| 変えたいこと | 編集箇所 |
|---|---|
| プリセットの種類 | `THEME_PRESETS` |
| 編集可能な色キーを増やす（例: グラフ用シリーズ色） | `THEME_PRESETS.default` に追加 + `fields` 配列に追加 |
| localStorage キー名 | `THEME_KEY` |
| デフォルトテーマ | `THEME_PRESETS.default` |
| カラーピッカーUIをモーダル化 | `AppearanceSettings` をモーダルとして開く設計に |

---

## 10. よくある落とし穴（React 版固有）

- **useTheme() を Provider の外で呼ぶ** → フォールバックでデフォルト値が返るので画面は壊れないが、テーマが反映されない
- **メモ化された子コンポーネントが theme 変更を拾わない** → `React.memo(...)` でラップしているコンポーネントは props 経由で theme を渡すか、`useTheme()` を中で呼ぶ
- **インライン style ではなく className を使っているコンポーネント** → §6 はインライン style 向け。className 中心ならグローバル CSS に `style` タグを動的注入する別アプローチが必要
- **previewTheme と setTheme を混同** → ピッカー操作中は previewTheme（保存なし）、保存ボタンで setTheme（保存あり）
- **`React.createContext` を Provider 内に書く** → Provider が再生成されてコンテキスト共有が壊れる。**Provider の外（モジュールトップレベル）** に書く

---

## 11. j-transport-portal への適用メモ

このサイトの場合、特に書き換えが効くのは以下の箇所：

| 既存（概略） | After |
|---|---|
| `const accent = "#0ea5e9"` | 削除して `theme.accent` を使用 |
| `Card` コンポーネントの `border: "1px solid #e8eaed"` | `border: \`1px solid \${theme.line}\`` |
| `body { background: #f4f5f7 }`（CSS の方）| `body` 側はそのままで OK（or AppearanceSettings 側で body 背景を上書き）|
| ラベルカラーマップ（`重要:["#fef2f2","#dc2626"]` 等）| **据え置きでOK**（カテゴリ色は意味の色）|

---

## 12. ライセンス・由来

WMS テストサイト2（`~/github/wms-test2/`）の `WMS_THEME` 機能を React 向けに移植したもの。
無償・自由に利用・改変可。クレジット不要。

CSS 変数ベース版: `APPEARANCE_THEME_PORTABLE_GUIDE.md`

以上。
