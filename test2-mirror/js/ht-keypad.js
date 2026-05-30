/* HT キーパッド共通制御 — 実機キーエンス BT-A2000 を想定
 *
 * 画面上の物理キーボタンを実動作させる:
 * - F1〜F4 → 画面下端の .ht-key-labels の対応セルをクリック発火
 * - SCAN → window.htSimulateScan() (各画面が実装) or 入力フォーカス
 * - 0-9 数字パッド → アクティブ input (or jan-input/qty-input/loc-input) に append
 * - CLR → アクティブ input をクリア
 * - ENT → アクティブ input で Enter 発火 (submit と等価)
 * - 十字キー OK → アクティブ要素 click
 *
 * 実機HTでブラウザ表示 → タッチ操作で全機能動作する設計
 */

(function () {
  'use strict';

  // ===== 実機モード: ?real=1 または Capacitor アプリ内なら real-mode クラスを付与（枠なし全画面） =====
  // Capacitor (APK) で動作中は全画面化を常時有効にする（画面遷移ごとにクエリを引き回さなくてよい）
  const _params = new URLSearchParams(location.search);
  if (_params.get('real') === '1' || _params.get('real') === 'true' || window.Capacitor) {
    document.documentElement.classList.add('real-mode');
    const applyRealClass = () => document.body && document.body.classList.add('real-mode');
    if (document.body) applyRealClass();
    else document.addEventListener('DOMContentLoaded', applyRealClass);
  }

  // 直近フォーカスを記憶（キーパッドクリックで input から外れても保持）
  let lastInputEl = null;
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      lastInputEl = e.target;
    }
  });

  // ===== スキャナーウェッジ対応: フォーカスが画面外でも、キー入力を最近の入力欄に転送 =====
  // キーエンス HT はキーボードウェッジモードで「バーコード値+Enter」を フォーカス中入力欄に送る
  // 万一フォーカス外にいる場合は global keydown で誘導
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Tab','Shift','Control','Alt','Meta','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isInput) return; // すでに入力欄なら何もしない
    const target = lastInputEl && document.contains(lastInputEl)
      ? lastInputEl
      : document.querySelector('input[autofocus], input:not([type=hidden])');
    if (!target) return;
    target.focus();
    if (e.key === 'Enter') {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      e.preventDefault();
    } else if (e.key.length === 1) {
      target.value = (target.value || '') + e.key;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      e.preventDefault();
    }
  }, true);

  // ===== 物理ファンクションキー対応: 実機HT(キーエンス)のハードキー F1〜F4 → 画面下端フッターを発火 =====
  // aw9523-key が KEY_F1〜F4 を送出（標準マッピング）→ WebView では e.key='F1'..'F4' / keyCode 112-115。
  // フッター .ht-key-labels は全画面で [F1, F2, F3, F4] の順に並ぶため、インデックスで対応ボタンをクリックする。
  document.addEventListener('keydown', (e) => {
    let idx = -1;
    if (/^F[1-4]$/.test(e.key)) idx = Number(e.key.slice(1)) - 1;
    else if (e.keyCode >= 112 && e.keyCode <= 115) idx = e.keyCode - 112;
    if (idx < 0) return;
    e.preventDefault();
    const labels = document.querySelectorAll('.ht-key-labels .key-lbl');
    const target = labels[idx];
    if (!target || target.classList.contains('disabled')) return;
    target.click();
  }, true);

  function getActiveInput() {
    if (lastInputEl && document.contains(lastInputEl)) return lastInputEl;
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return focused;
    return document.querySelector('input:not([type=hidden]), textarea');
  }

  function appendToInput(ch) {
    const el = getActiveInput();
    if (!el) return;
    el.value = (el.value || '') + ch;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    lastInputEl = el;
  }

  function clearInput() {
    const el = getActiveInput();
    if (!el) return;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    lastInputEl = el;
  }

  function enterInput() {
    const el = getActiveInput();
    if (!el) return;
    // Enter キーを発火
    const evt = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
    el.dispatchEvent(evt);
    // form 入りなら submit / なければ親の button.primary を click
    const form = el.closest('form');
    if (form) { form.requestSubmit?.(); return; }
    // F3 (primary) を発火（次へ進む）
    const primaryKey = document.querySelector('.ht-key-labels .key-lbl.primary');
    if (primaryKey) primaryKey.click();
  }

  // ===== フッターキーの未配線セルにデフォルト動作を付与（押しても無反応を防ぐ） =====
  function htToast(msg) {
    let t = document.getElementById('ht-keytoast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ht-keytoast';
      t.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);' +
        'background:rgba(26,58,92,0.96);color:#fff;padding:10px 18px;border-radius:8px;' +
        'font-size:15px;font-weight:600;line-height:1.4;z-index:10000;max-width:86%;text-align:center;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.32);pointer-events:none;opacity:0;transition:opacity .18s;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    void t.offsetWidth; // reflow して opacity transition を効かせる
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 1500);
  }

  function htKeyLabelText(lbl) {
    const fn = lbl.querySelector('.fn');
    let txt = lbl.textContent || '';
    if (fn) txt = txt.replace(fn.textContent, '');
    return txt.trim();
  }

  // onclick も id 配線も無いフッターキーのデフォルト動作。
  // 明確なグローバル遷移は実遷移、プレースホルダ(−)は無処理、それ以外はモック確認トースト。
  function htDefaultKeyAction(lbl) {
    const text = htKeyLabelText(lbl);
    if (!text || /^[−–—-]+$/.test(text)) return;
    if (/メニュー|ホーム/.test(text)) { location.href = 'ht/menu.html'; return; }
    if (/ログアウト|サインアウト/.test(text)) { location.href = 'ht/login.html'; return; }
    if (/進捗/.test(text)) { location.href = 'ht/wave/progress.html'; return; }
    htToast(text + '（mock）');
  }

  function bindKeypad() {
    // F1〜F4 (キーパッド上段の .pkey.f1)
    // 上段は [F1, F2, SCAN, F3, F4] の5個。クラス f1 が F1/F2/F3/F4 に付与されているはず
    const topRow = document.querySelector('.ht-keypad .row');
    if (topRow) {
      const all = topRow.querySelectorAll('.pkey');
      // [F1, F2, SCAN, F3, F4]
      const labels = document.querySelectorAll('.ht-key-labels .key-lbl');
      const mapping = [0, 1, null, 2, 3]; // pkey index → label index
      all.forEach((btn, idx) => {
        if (btn.hasAttribute('onclick')) return; // 既存 onclick 優先
        if (btn.classList.contains('scan')) {
          // SCAN
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.htSimulateScan === 'function') {
              window.htSimulateScan();
            } else if (typeof window.simulateScan === 'function') {
              window.simulateScan();
            } else if (typeof window.simulateScanLoc === 'function') {
              window.simulateScanLoc();
            } else {
              const el = getActiveInput();
              if (el) el.focus();
            }
          });
        } else {
          const li = mapping[idx];
          if (li !== null && li !== undefined) {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              const target = labels[li];
              if (target && !target.classList.contains('disabled')) target.click();
            });
          }
        }
      });
    }

    // 数字パッド & CLR / ENT (.ht-num-grid 内の .pkey)
    document.querySelectorAll('.ht-num-grid .pkey').forEach(btn => {
      if (btn.hasAttribute('onclick')) return; // 既存 onclick 優先
      const txt = (btn.textContent || '').trim();
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (/^\d$/.test(txt)) {
          appendToInput(txt);
        } else if (txt === 'CLR') {
          clearInput();
        } else if (txt === 'ENT') {
          enterInput();
        }
      });
    });

    // 十字キー OK (中央)
    const dpadOk = document.querySelector('.ht-dpad .ok');
    if (dpadOk) {
      dpadOk.style.cursor = 'pointer';
      dpadOk.addEventListener('click', (e) => {
        e.preventDefault();
        // 現在の primary action を発火
        const primary = document.querySelector('.ht-key-labels .key-lbl.primary');
        if (primary && !primary.classList.contains('disabled')) primary.click();
      });
    }

    // 十字キー本体（dpad の枠）→ クリック位置で上下左右判定（簡易）
    const dpad = document.querySelector('.ht-dpad');
    if (dpad) {
      dpad.style.cursor = 'pointer';
      dpad.addEventListener('click', (e) => {
        if (e.target === dpadOk) return;
        e.preventDefault();
        const rect = dpad.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const absX = Math.abs(x), absY = Math.abs(y);
        if (absX < 6 && absY < 6) {
          // 中央 → OK と同じ
          const primary = document.querySelector('.ht-key-labels .key-lbl.primary');
          if (primary) primary.click();
          return;
        }
        // 上下: リスト項目の移動 / 入力欄移動
        const direction = absY > absX ? (y < 0 ? 'up' : 'down') : (x < 0 ? 'left' : 'right');
        navigateList(direction);
      });
    }

    // フッター .key-lbl: onclick も id も無いセルにデフォルト動作を配線（二重発火防止）
    document.querySelectorAll('.ht-key-labels .key-lbl').forEach(lbl => {
      if (lbl.classList.contains('disabled')) return;
      if (lbl.hasAttribute('onclick')) return;   // 既存インライン優先
      if (lbl.id) return;                          // per-screen JS が id 経由で配線済み想定
      if (lbl.dataset.htDefaultBound) return;
      lbl.dataset.htDefaultBound = '1';
      lbl.style.cursor = 'pointer';
      lbl.addEventListener('click', () => htDefaultKeyAction(lbl));
    });
  }

  function navigateList(direction) {
    // 1) ht-list-item があれば選択を移動
    const items = document.querySelectorAll('.ht-list-item');
    if (items.length > 0) {
      let curIdx = -1;
      items.forEach((el, i) => {
        if (el.style.background && el.style.background.includes('accent-lt') || el.classList.contains('selected')) {
          curIdx = i;
        }
      });
      if (curIdx < 0) curIdx = 0;
      let newIdx = curIdx;
      if (direction === 'down') newIdx = Math.min(items.length - 1, curIdx + 1);
      if (direction === 'up') newIdx = Math.max(0, curIdx - 1);
      if (newIdx !== curIdx && items[newIdx]) {
        items[newIdx].click();
      }
      return;
    }
    // 2) input が複数あれば Tab 相当
    if (direction === 'down' || direction === 'right') {
      const focusable = Array.from(document.querySelectorAll('input, button')).filter(el => el.offsetParent !== null);
      const cur = focusable.indexOf(document.activeElement);
      const next = focusable[Math.min(focusable.length - 1, cur + 1)];
      next && next.focus();
    } else {
      const focusable = Array.from(document.querySelectorAll('input, button')).filter(el => el.offsetParent !== null);
      const cur = focusable.indexOf(document.activeElement);
      const prev = focusable[Math.max(0, cur - 1)];
      prev && prev.focus();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindKeypad);
  } else {
    bindKeypad();
  }
})();

/* =====================================================================
 * 文字サイズ ライブテストパネル（real-mode 限定）
 * 役割別フォント(CSS変数)と全体倍率を実機上でスライダー調整し、
 * localStorage に保存。全HT画面に即反映。確定値はコピーして CSS に焼き込む。
 * ===================================================================== */
(function () {
  'use strict';
  const isReal = document.documentElement.classList.contains('real-mode') ||
    /[?&]real=(1|true)/.test(location.search) || window.Capacitor;
  if (!isReal) return;

  const KEY = 'wms_typescale_v2';
  // 既定値＝プリセット「推奨」。CSS の body.real-mode 既定値と一致させること。
  const ROLES = [
    { k: '--ts',       label: '全体倍率',          min: 0.7, max: 1.8, step: 0.05, def: 1,  px: false },
    { k: '--fs-title', label: '画面名(ヘッダ)',     min: 14,  max: 34,  step: 1,    def: 22, px: true },
    { k: '--fs-head',  label: '重要見出し/商品名',  min: 16,  max: 46,  step: 1,    def: 24, px: true },
    { k: '--fs-num',   label: '強調数値',          min: 20,  max: 64,  step: 1,    def: 30, px: true },
    { k: '--fs-input', label: '入力テキスト',       min: 14,  max: 40,  step: 1,    def: 18, px: true },
    { k: '--fs-label', label: 'ラベル/メタ',        min: 12,  max: 30,  step: 1,    def: 15, px: true },
    { k: '--fs-body',  label: '本文',              min: 12,  max: 30,  step: 1,    def: 16, px: true },
    { k: '--fs-code',  label: 'コード(JAN等)',      min: 12,  max: 30,  step: 1,    def: 17, px: true },
    { k: '--fs-sub',   label: '補足',              min: 10,  max: 24,  step: 1,    def: 13, px: true },
    { k: '--fs-step',  label: 'ステップ',           min: 10,  max: 24,  step: 1,    def: 14, px: true },
    { k: '--fs-key',   label: 'F1〜F4キー',         min: 12,  max: 28,  step: 1,    def: 16, px: true },
  ];

  // 業界ガイドライン(Zebra EC30 / Material / WCAG / ANSI-HFES)準拠の3段階プリセット
  const PRESETS = {
    '標準':   { '--ts':1, '--fs-title':20, '--fs-head':22, '--fs-num':26, '--fs-input':16, '--fs-label':14, '--fs-body':16, '--fs-code':16, '--fs-sub':12, '--fs-step':13, '--fs-key':15 },
    '推奨':   { '--ts':1, '--fs-title':22, '--fs-head':24, '--fs-num':30, '--fs-input':18, '--fs-label':15, '--fs-body':16, '--fs-code':17, '--fs-sub':13, '--fs-step':14, '--fs-key':16 },
    '大きめ': { '--ts':1, '--fs-title':24, '--fs-head':28, '--fs-num':36, '--fs-input':20, '--fs-label':16, '--fs-body':18, '--fs-code':18, '--fs-sub':14, '--fs-step':15, '--fs-key':18 },
  };

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function valOf(s, r) { return (s[r.k] != null) ? s[r.k] : r.def; }
  function applyOne(r, v) { document.body.style.setProperty(r.k, r.px ? (v + 'px') : String(v)); }
  function applyAll(s) { ROLES.forEach(r => applyOne(r, valOf(s, r))); }

  // 保存済みを即適用（FOUC低減のため body 準備後すぐ）
  const settings = load();
  const applyNow = () => applyAll(settings);
  if (document.body) applyNow(); else document.addEventListener('DOMContentLoaded', applyNow);

  function buildPanel() {
    if (document.getElementById('ts-fab')) return;
    const st = document.createElement('style');
    st.textContent =
      '#ts-fab{position:fixed;right:8px;bottom:74px;z-index:99998;width:44px;height:44px;border-radius:50%;background:#1a3a5c;color:#fff;border:2px solid #fff;font-size:18px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:pointer}' +
      '#ts-panel{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:none}' +
      '#ts-panel.open{display:block}' +
      '#ts-sheet{position:absolute;left:0;right:0;bottom:0;max-height:88vh;overflow-y:auto;background:#fff;border-top-left-radius:14px;border-top-right-radius:14px;padding:14px 14px 20px}' +
      '#ts-sheet h3{margin:0 0 10px;font-size:18px;color:#1a3a5c}' +
      '.ts-row{margin-bottom:12px}' +
      '.ts-row .lab{display:flex;justify-content:space-between;font-size:14px;color:#1a1f29;margin-bottom:4px}' +
      '.ts-row .lab b{font-family:monospace;color:#1a3a5c}' +
      '.ts-row input[type=range]{width:100%;height:30px}' +
      '#ts-presets{display:flex;gap:8px;margin-bottom:14px}' +
      '#ts-presets button{flex:1;padding:14px 6px;font-size:15px;font-weight:700;border-radius:8px;border:2px solid #1a3a5c;background:#fff;color:#1a3a5c}' +
      '#ts-presets button.active{background:#1a3a5c;color:#fff}' +
      '.ts-sec{font-size:13px;color:#6c7280;margin:4px 0 8px;border-top:1px solid #e4e7eb;padding-top:10px}' +
      '#ts-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}' +
      '#ts-actions button{flex:1;min-width:96px;padding:12px;font-size:15px;border-radius:8px;border:1px solid #1a3a5c;background:#fff;color:#1a3a5c;font-weight:600}' +
      '#ts-actions button.primary{background:#1a3a5c;color:#fff}' +
      '#ts-out{margin-top:10px;font-family:monospace;font-size:12px;background:#f4f5f7;border:1px solid #e4e7eb;border-radius:6px;padding:8px;white-space:pre-wrap;word-break:break-all}';
    document.head.appendChild(st);

    const fab = document.createElement('div');
    fab.id = 'ts-fab'; fab.textContent = 'Aa';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'ts-panel';
    let rows = '';
    ROLES.forEach(r => {
      const v = valOf(settings, r);
      rows += '<div class="ts-row" data-k="' + r.k + '"><div class="lab"><span>' + r.label +
        '</span><b class="cur">' + v + (r.px ? 'px' : '') + '</b></div>' +
        '<input type="range" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + v + '"></div>';
    });
    let presetBtns = '';
    Object.keys(PRESETS).forEach(name => { presetBtns += '<button data-preset="' + name + '">' + name + '</button>'; });
    panel.innerHTML = '<div id="ts-sheet"><h3>文字サイズ テスト（ガイドライン準拠）</h3>' +
      '<div id="ts-presets">' + presetBtns + '</div>' +
      '<div class="ts-sec">個別微調整（任意）</div>' + rows +
      '<div id="ts-actions"><button id="ts-reset">推奨に戻す</button>' +
      '<button id="ts-copy">現在値をコピー</button>' +
      '<button id="ts-close" class="primary">閉じる</button></div>' +
      '<div id="ts-out">調整中…</div></div>';
    document.body.appendChild(panel);

    function syncSliders() {
      panel.querySelectorAll('.ts-row').forEach(row => {
        const r = ROLES.find(x => x.k === row.getAttribute('data-k'));
        const v = valOf(settings, r);
        row.querySelector('input').value = v;
        row.querySelector('.cur').textContent = v + (r.px ? 'px' : '');
      });
    }
    function markActivePreset() {
      panel.querySelectorAll('#ts-presets button').forEach(b => {
        const p = PRESETS[b.getAttribute('data-preset')];
        const match = ROLES.every(r => valOf(settings, r) === (p[r.k] != null ? p[r.k] : r.def));
        b.classList.toggle('active', match);
      });
    }

    const out = panel.querySelector('#ts-out');
    function refreshOut() {
      const o = {};
      ROLES.forEach(r => { o[r.k] = valOf(settings, r); });
      out.textContent = JSON.stringify(o);
      markActivePreset();
    }
    refreshOut();

    function applyPreset(name) {
      const p = PRESETS[name];
      if (!p) return;
      ROLES.forEach(r => { settings[r.k] = (p[r.k] != null) ? p[r.k] : r.def; applyOne(r, settings[r.k]); });
      save(settings); syncSliders(); refreshOut();
    }
    panel.querySelectorAll('#ts-presets button').forEach(b => {
      b.addEventListener('click', () => applyPreset(b.getAttribute('data-preset')));
    });

    fab.addEventListener('click', () => panel.classList.add('open'));
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.classList.remove('open'); });
    panel.querySelector('#ts-close').addEventListener('click', () => panel.classList.remove('open'));

    panel.querySelectorAll('.ts-row').forEach(row => {
      const k = row.getAttribute('data-k');
      const r = ROLES.find(x => x.k === k);
      const range = row.querySelector('input');
      const cur = row.querySelector('.cur');
      range.addEventListener('input', () => {
        const v = r.px ? parseInt(range.value, 10) : parseFloat(range.value);
        settings[k] = v;
        cur.textContent = v + (r.px ? 'px' : '');
        applyOne(r, v);
        save(settings);
        refreshOut();
      });
    });

    panel.querySelector('#ts-reset').addEventListener('click', () => applyPreset('推奨'));

    panel.querySelector('#ts-copy').addEventListener('click', () => {
      const txt = out.textContent;
      const done = () => { window.clToast ? clToast('現在値をコピーしました', 'success') : alert('コピー: ' + txt); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done, () => alert('コピー: ' + txt));
      } else { alert('コピー: ' + txt); }
    });
  }

  if (document.body) buildPanel(); else document.addEventListener('DOMContentLoaded', buildPanel);
})();

/* =====================================================================
 * インライン文字サイズの正規化（real-mode 限定・全画面土台固め）
 * 各画面はモック向けに 8〜20px の極小 font-size をインライン直書きしている。
 * real-mode では役割別タイプスケール変数(--fs-*)へマッピングし直し、
 * 全画面を「推奨」サイズ＆プリセット倍率に一括連動させる。
 * すでにタイプスケールで制御済みの要素(検品クラス/ヘッダ/Fキー/入力等)は除外。
 * ===================================================================== */
(function () {
  'use strict';
  const isReal = document.documentElement.classList.contains('real-mode') ||
    /[?&]real=(1|true)/.test(location.search) || window.Capacitor;
  if (!isReal) return;

  // px → 役割変数（モックの相対階層を保ったまま推奨スケールへ）
  function mapVar(p) {
    if (p <= 9) return '--fs-sub';
    if (p <= 11) return '--fs-label';
    if (p <= 13) return '--fs-body';
    if (p <= 16) return '--fs-input';
    if (p <= 20) return '--fs-title';
    if (p <= 28) return '--fs-head';
    return '--fs-num';
  }
  // CSS 側ですでに制御している要素は触らない
  const SKIP = '.insp-cur,.insp-qty,.insp-meta,.insp-info,.insp-field-lbl,.insp-msg,.insp-hint,' +
    '.ht-header,.ht-statusbar,.ht-key-labels,.step-progress,.wms-modal,.wms-modal-backdrop';

  function normalize(root) {
    const els = (root || document).querySelectorAll('[style*="font-size"]');
    els.forEach(el => {
      if (el.closest(SKIP)) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      if (el.dataset.tsDone) return;
      const m = (el.getAttribute('style') || '').match(/font-size:\s*([0-9.]+)px/i);
      if (!m) return;
      const px = parseFloat(m[1]);
      if (!px || px > 40) return; // 既に大きい/想定外はそのまま
      el.style.setProperty('font-size', 'calc(var(' + mapVar(px) + ') * var(--ts))', 'important');
      el.dataset.tsDone = '1';
    });
  }

  function run() { try { normalize(document); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  // 動的描画(一覧の後挿入等)にも追従
  window.addEventListener('load', run);
})();
