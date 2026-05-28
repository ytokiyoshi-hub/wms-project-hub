// 共通レイアウト部品 — サイドバー / ヘッダロゴ を全画面で1ヶ所から提供
// 各画面は <aside class="sidebar" id="sidebar"></aside> を持つだけで、中身は本JSが構築する。
// nav-manifest.js を先に読み込んでおくこと（window.NAV_ITEMS / NAV_META）。

(function () {
  if (typeof window === 'undefined') return;

  // === 配色テーマ（ユーザー設定）===
  // 編集可能な CSS 変数: 罫線 / アクセント / アラート / 背景。
  // localStorage に保存された値を起動時に :root に適用する。
  // 設定UI は /pc/settings/appearance.html。
  // 後方互換: 旧 WMS_BORDER_THEME は WMS_THEME のサブセットとして残す。
  const THEME_KEY = 'wms-theme';
  // 編集可能なキー → CSS 変数名 の対応
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
  // テーマ全体プリセット（カラーセット）
  const THEME_PRESETS = {
    default: { // MORIKA 既定（罫線をはっきり化・2026-05-28）
      line: '#a8b1bd', lineDk: '#64748b',
      accent: '#1a3d6e', accentDk: '#132e52', accentLt: '#e8eef5',
      alert: '#be123c', alertLt: '#fff1f2',
      base: '#ffffff', bg: '#f8fafc',
    },
    navy_strong: { // 濃いネイビー
      line: '#bcc7d6', lineDk: '#6b7d96',
      accent: '#0b2545', accentDk: '#061632', accentLt: '#dbe2ec',
      alert: '#9f0d2f', alertLt: '#fdeef1',
      base: '#ffffff', bg: '#f3f6fa',
    },
    gray: { // モノクロ系
      line: '#d4d4d4', lineDk: '#737373',
      accent: '#3f3f46', accentDk: '#27272a', accentLt: '#e7e7ea',
      alert: '#b91c1c', alertLt: '#fef2f2',
      base: '#ffffff', bg: '#fafafa',
    },
    blue: { // ブルー
      line: '#bfd5e6', lineDk: '#5b86ab',
      accent: '#1d4ed8', accentDk: '#1e3a8a', accentLt: '#e0e7ff',
      alert: '#dc2626', alertLt: '#fee2e2',
      base: '#ffffff', bg: '#f1f5fb',
    },
    green: { // グリーン
      line: '#c8d8c8', lineDk: '#6b8e6b',
      accent: '#166534', accentDk: '#0f3f1f', accentLt: '#dcfce7',
      alert: '#b91c1c', alertLt: '#fef2f2',
      base: '#ffffff', bg: '#f5faf5',
    },
    warm: { // ウォーム（ブラウン基調）
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
    if (!t) return; // CSS デフォルト値を使う
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
  window.WMS_THEME = {
    apply: applyTheme,
    read: readTheme,
    save: (t) => { try { localStorage.setItem(THEME_KEY, JSON.stringify(t)); } catch {} ; applyTheme(t); },
    reset: resetTheme,
    presets: THEME_PRESETS,
    vars: THEME_VARS,
  };
  // 旧名: 後方互換
  window.WMS_BORDER_THEME = {
    apply: (t) => applyTheme(t),
    read: readTheme,
    save: (t) => window.WMS_THEME.save(t),
    reset: resetTheme,
    presets: THEME_PRESETS,
  };
  // 起動時に即適用（チラつき防止のため init より前に実行）
  applyTheme();

  const itemsAll = window.NAV_ITEMS || [];
  const meta = window.NAV_META || {};

  // 「展開状態」を sessionStorage に保存（ページ遷移で維持）
  const KEY = 'wms-sidebar-open-sections';
  const readOpen = () => {
    try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]')); }
    catch { return new Set(); }
  };
  const writeOpen = (set) => sessionStorage.setItem(KEY, JSON.stringify([...set]));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // セクションごとに items をグルーピング
  function groupItems() {
    const groups = {};
    for (const it of itemsAll) {
      const sec = it.section || 'other';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(it);
    }
    // セクションを meta.order でソート
    const ordered = Object.keys(groups).sort((a, b) => {
      const oa = (meta[a] && meta[a].order) ?? 999;
      const ob = (meta[b] && meta[b].order) ?? 999;
      return oa - ob;
    });
    return ordered.map(sec => ({ section: sec, items: groups[sec] }));
  }

  // 現在ページのパス
  const here = location.pathname.replace(/\/index\.html?$/, '/') || '/';
  const hereIsRoot = (here === '/' || here === '/index.html');

  // 現在ページが属するセクションを「展開」状態にする
  function currentSection() {
    for (const it of itemsAll) {
      if (it.url === here || it.url === location.pathname) return it.section;
    }
    return null;
  }

  function buildSidebar() {
    const aside = document.getElementById('sidebar');
    if (!aside) return;
    const open = readOpen();
    const curSec = currentSection();
    if (curSec) open.add(curSec);

    const groups = groupItems();

    const html = [];
    html.push('<div class="logo"><a href="/" style="color:inherit; text-decoration:none;">WMS<small>東京DC（WH001）</small></a></div>');
    html.push('<nav class="cl-nav">');

    for (const g of groups) {
      const m = meta[g.section] || { label: g.section, icon: '' };
      // section が "/" の場合はサブメニュー化せず直接リンク
      if (g.section === '/') {
        for (const it of g.items) {
          const active = (it.url === location.pathname || (hereIsRoot && it.url === '/')) ? ' class="active"' : '';
          html.push(`<a href="${esc(it.url)}"${active}>${esc(it.title)}</a>`);
        }
        continue;
      }
      const isOpen = open.has(g.section);
      const containsActive = g.items.some(it => it.url === location.pathname);
      const expanded = isOpen || containsActive;
      html.push(`<div class="cl-section ${expanded ? 'cl-open' : ''}" data-section="${esc(g.section)}">`);
      html.push(`<button type="button" class="cl-section-head" data-toggle="${esc(g.section)}"><span>${esc(m.label)}</span><span class="cl-count">${g.items.length}</span><span class="cl-caret">▾</span></button>`);
      html.push('<div class="cl-section-body">');
      for (const it of g.items) {
        const active = (it.url === location.pathname) ? ' class="active"' : '';
        html.push(`<a href="${esc(it.url)}"${active}>${esc(it.title)}</a>`);
      }
      html.push('</div></div>');
    }
    html.push('</nav>');
    html.push('<div class="sb-footer">テストサイト2 / port 8778 / 459画面</div>');

    aside.innerHTML = html.join('');

    // toggle bind
    aside.querySelectorAll('.cl-section-head').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.toggle;
        const wrapper = btn.closest('.cl-section');
        const isNowOpen = wrapper.classList.toggle('cl-open');
        const set = readOpen();
        if (isNowOpen) set.add(sec); else set.delete(sec);
        writeOpen(set);
      });
    });
  }

  // CSS をその場で注入（共通スタイル）
  function injectStyle() {
    if (document.getElementById('cl-style')) return;
    const s = document.createElement('style');
    s.id = 'cl-style';
    s.textContent = `
      .cl-nav { display:flex; flex-direction:column; }
      .cl-nav a { display:block; padding:6px 14px; color:var(--c-text); text-decoration:none; font-size:12px; border-left:3px solid transparent; }
      .cl-nav a:hover { background:var(--c-bg); }
      .cl-nav a.active { background:var(--c-accent-lt, #e6f3ff); border-left-color:var(--c-accent, #1a73e8); font-weight:600; }
      .cl-section { border-top:1px solid var(--c-line, #eee); }
      .cl-section:first-child { border-top:none; }
      .cl-section-head { display:flex; align-items:center; gap:6px; width:100%; padding:8px 12px; background:transparent; border:none; cursor:pointer; font-size:12px; color:var(--c-text-sub, #666); font-weight:600; text-align:left; font-family:inherit; }
      .cl-section-head:hover { background:var(--c-bg, #f5f5f5); }
      .cl-section-head > span:nth-child(2) { flex:1; }
      .cl-count { font-size:10px; color:var(--c-text-sub, #999); font-weight:400; margin-right:4px; }
      .cl-caret { font-size:10px; color:var(--c-text-sub, #999); transition:transform .15s; }
      .cl-section.cl-open .cl-caret { transform:rotate(180deg); }
      .cl-section-body { display:none; padding:0 0 6px 0; }
      .cl-section.cl-open .cl-section-body { display:block; }
      .sb-footer { padding:10px 14px; font-size:10px; color:var(--c-text-sub, #999); border-top:1px solid var(--c-line, #eee); margin-top:auto; }
      .sidebar { display:flex; flex-direction:column; overflow-y:auto; }

      /* === 共通トースト通知（型・重要度別）===
         ブラウザ標準 alert() の代わり。画面右下に出る非ブロッキング通知。
         重要度で自動消滅有無を変える:
           info/success → 3.5秒で自動消滅
           important   → 自動で消えない（×で閉じる）・色を少し強く
           error       → 自動で消えない（×で閉じる）・赤 */
      .cl-toast-wrap { position:fixed; right:18px; bottom:18px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; max-width:420px; }
      .cl-toast { background:#374151; color:#fff; padding:10px 36px 10px 14px; border-radius:4px; font-size:12px; line-height:1.55; min-width:200px; max-width:400px; box-shadow:0 4px 12px rgba(0,0,0,0.15); pointer-events:auto; animation:cl-toast-in .18s ease-out; position:relative; }
      .cl-toast.success  { background:#15803d; border-left:3px solid #22c55e; }
      .cl-toast.important{ background:#1e3a8a; border-left:3px solid #3b82f6; box-shadow:0 6px 18px rgba(0,0,0,0.25); }
      .cl-toast.error    { background:#7f1d1d; border-left:3px solid #ef4444; box-shadow:0 6px 18px rgba(0,0,0,0.25); }
      .cl-toast.alert    { background:#7f1d1d; border-left:3px solid #ef4444; box-shadow:0 6px 18px rgba(0,0,0,0.25); }
      .cl-toast .kind-lbl { display:inline-block; font-size:10px; padding:1px 6px; background:rgba(255,255,255,0.18); border-radius:2px; margin-right:8px; font-weight:600; letter-spacing:0.5px; vertical-align:middle; }
      .cl-toast .close { position:absolute; top:4px; right:6px; cursor:pointer; opacity:0.7; font-size:18px; line-height:1; padding:2px 8px; }
      .cl-toast .close:hover { opacity:1; }
      @keyframes cl-toast-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

      /* === styled 確認モーダル（型・呼び出しは個別画面側で window.clConfirm() に置換する用）=== */
      .cl-modal-back { position:fixed; inset:0; background:rgba(0,0,0,0.35); display:none; align-items:center; justify-content:center; z-index:10000; }
      .cl-modal-back.show { display:flex; }
      .cl-modal { background:#fff; border:1px solid var(--c-line); max-width:420px; width:90%; }
      .cl-modal-head { padding:12px 16px; border-bottom:1px solid var(--c-line); font-weight:700; font-size:13px; }
      .cl-modal-body { padding:14px 16px; font-size:13px; color:#374151; line-height:1.6; white-space:pre-wrap; }
      .cl-modal-foot { padding:10px 16px; border-top:1px solid var(--c-line); display:flex; gap:8px; justify-content:flex-end; }

      /* === ヘルプアイコン + ポップオーバー（型・D案）===
         画面タイトル横に丸囲み「?」アイコン。クリックでポップオーバー、もう一度クリック/外側クリック/Escで閉じる。
         見せ方B 準拠: 普段は静か、開いた時だけ表示、ふわっと出る。 */
      .intro-help {
        display: inline-flex; align-items: center; justify-content: center;
        width: 16px; height: 16px; border-radius: 50%;
        background: transparent; border: 1px solid var(--c-line-dk);
        color: #6b7280; font-size: 10px; font-weight: 700; font-family: var(--f-base);
        cursor: pointer; margin-left: 6px; vertical-align: middle;
        transition: background .12s, color .12s, border-color .12s;
        user-select: none;
      }
      .intro-help:hover, .intro-help.open { background: #1a3a5c; color: #fff; border-color: #1a3a5c; }
      .intro-help::before { content: "?"; line-height: 1; }
      /* アイコンと相対配置するための anchor */
      .intro-help-anchor { position: relative; display: inline-block; vertical-align: middle; }

      .intro-popover {
        position: absolute; top: calc(100% + 6px); left: -8px;
        min-width: 260px; max-width: 380px;
        background: #fff; border: 1px solid var(--c-line);
        box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        padding: 12px 14px;
        font-size: 12px; line-height: 1.6; color: #374151;
        z-index: 100;
        opacity: 0; transform: translateY(-4px);
        transition: opacity .14s ease-out, transform .14s ease-out;
        pointer-events: none;
        font-weight: 400;
      }
      .intro-popover.show {
        opacity: 1; transform: translateY(0);
        pointer-events: auto;
      }
      .intro-popover .ip-code { font-family: var(--f-mono); font-weight: 600; color: var(--c-accent); margin-right: 8px; }
      .intro-popover .ip-close { float: right; margin-left: 12px; color: #9ca3af; cursor: pointer; font-size: 14px; line-height: 1; }
      .intro-popover .ip-close:hover { color: #374151; }
    `;
    document.head.appendChild(s);
  }

  // === トースト通知 ===
  function ensureToastWrap() {
    let w = document.getElementById('cl-toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.id = 'cl-toast-wrap';
      w.className = 'cl-toast-wrap';
      document.body.appendChild(w);
    }
    return w;
  }
  // 重要度別ラベル (本文の左に表示)
  const KIND_LABEL = {
    info:      '',         // ラベルなし (デフォルト)
    success:   '✓ 完了',
    important: '!  重要',
    error:     '⚠ エラー',
    alert:     '⚠ エラー', // 旧 alert は error と同じ扱い
  };

  // 自動消滅させない重要度
  const PERSISTENT_KINDS = new Set(['important', 'error', 'alert']);

  function showToast(message, kind = 'info', durationMs) {
    const wrap = ensureToastWrap();
    const t = document.createElement('div');
    t.className = 'cl-toast' + (kind ? ' ' + kind : '');
    // 改行 (\n) を <br> に
    const msg = String(message ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])).replace(/\n/g, '<br>');
    const lbl = KIND_LABEL[kind] ? `<span class="kind-lbl">${KIND_LABEL[kind]}</span>` : '';
    t.innerHTML = `<span class="close" title="閉じる">×</span>${lbl}${msg}`;
    t.querySelector('.close').addEventListener('click', () => t.remove());
    wrap.appendChild(t);
    // 重要度別: persistent (important/error) は自動消滅させない
    if (!PERSISTENT_KINDS.has(kind)) {
      const ms = durationMs || 3500;
      setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, ms);
    }
    return t;
  }
  window.clToast = showToast;

  // window.alert を上書き → 既存の全 alert() 呼び出しが自動でトーストに
  // 本文の語彙で kind を簡易判定 (失敗/エラー → error / それ以外 → info)
  // ※ 本当に重要な業務通知は画面側で clToast(msg, 'important') を明示的に呼ぶこと。
  const originalAlert = window.alert;
  window.alert = function (msg) {
    const s = String(msg ?? '');
    const isError = /失敗|エラー|不可|拒否|警告|⚠|🚨|❌|タイムアウト/.test(s);
    showToast(s, isError ? 'error' : 'info');
  };

  // === styled 確認モーダル（個別画面で window.clConfirm に置換可）===
  function clConfirm(message, opts) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'cl-modal-back show';
      back.innerHTML = `
        <div class="cl-modal">
          <div class="cl-modal-head">${(opts && opts.title) || '確認'}</div>
          <div class="cl-modal-body">${String(message ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]))}</div>
          <div class="cl-modal-foot">
            <button class="btn" data-act="no">${(opts && opts.cancelLabel) || 'キャンセル'}</button>
            <button class="btn primary" data-act="yes">${(opts && opts.okLabel) || 'OK'}</button>
          </div>
        </div>
      `;
      document.body.appendChild(back);
      back.querySelector('[data-act="yes"]').addEventListener('click', () => { back.remove(); resolve(true); });
      back.querySelector('[data-act="no"]').addEventListener('click', () => { back.remove(); resolve(false); });
      back.addEventListener('click', (e) => { if (e.target === back) { back.remove(); resolve(false); } });
    });
  }
  window.clConfirm = clConfirm;

  // === ヘルプアイコン + ポップオーバー (D案・全画面共通動作) ===
  // 任意の場所で <span class="intro-help-anchor"><button class="intro-help"
  //   data-intro="本文"
  //   data-intro-code="A-9"></button></span>
  // を置くだけで動く。HTML 内に直接 .intro-popover を書く必要なし。
  function bindIntroHelp() {
    let openPop = null;
    function closeOpen() {
      if (!openPop) return;
      openPop.classList.remove('show');
      openPop.previousElementSibling?.classList.remove('open');
      setTimeout(() => { openPop && openPop.remove(); openPop = null; }, 150);
    }
    function openFor(btn) {
      closeOpen();
      const anchor = btn.parentElement;
      if (!anchor || !anchor.classList.contains('intro-help-anchor')) return;
      const text = btn.dataset.intro || '';
      const code = btn.dataset.introCode || '';
      const pop = document.createElement('div');
      pop.className = 'intro-popover';
      pop.innerHTML = `
        <span class="ip-close" title="閉じる">×</span>
        ${code ? `<span class="ip-code">${code}</span>` : ''}<span class="ip-body"></span>
      `;
      pop.querySelector('.ip-body').textContent = text;
      anchor.appendChild(pop);
      // animate in
      requestAnimationFrame(() => pop.classList.add('show'));
      btn.classList.add('open');
      openPop = pop;
      pop.querySelector('.ip-close').addEventListener('click', (e) => { e.stopPropagation(); closeOpen(); });
    }
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.intro-help');
      if (btn) {
        e.stopPropagation();
        if (openPop && btn.classList.contains('open')) closeOpen();
        else openFor(btn);
        return;
      }
      // 外側クリック
      if (openPop && !e.target.closest('.intro-popover')) closeOpen();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOpen();
    });
  }

  function init() {
    injectStyle();
    buildSidebar();
    bindIntroHelp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
