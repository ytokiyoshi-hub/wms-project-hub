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

  // ===== 実機モード: ?real=1 で body に real-mode クラスを付与（枠なし全画面） =====
  const _params = new URLSearchParams(location.search);
  if (_params.get('real') === '1' || _params.get('real') === 'true') {
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
