// 共通: pc/integration/*.html の右パネル「連携状況 / 直近エラー / 接続先」を実データに
// 1号 MESSAGE_RIGHT_PANE_REAL_INTEGRATION 対応 Step 3。
//
// 注: 実 integration/connections API が無いため、外部連携の代用として
// 入荷予定 (ASN受信代用) と 在庫調整 (連携イベント代用) を集計。
// 接続先一覧は荷主マスタ (/api/owners) ベース (荷主毎に EDI/API 連携想定)。

(function () {
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function findCardByHeader(text) {
    for (const card of document.querySelectorAll('.right-pane .card')) {
      const span = card.querySelector('.card-header > span:first-child');
      if (span && span.textContent.trim() === text) return card;
    }
    return null;
  }
  function setRow(card, label, value, modifier) {
    if (!card) return;
    for (const row of card.querySelectorAll('.summary-row')) {
      const lbl = row.querySelector('.lbl');
      if (lbl && lbl.textContent.trim() === label) {
        const val = row.querySelector('.val');
        if (val) {
          val.textContent = value;
          val.className = 'val' + (modifier ? ' ' + modifier : '');
        }
        return;
      }
    }
  }
  function formatDate(s) {
    if (!s) return '-';
    const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
    return String(s);
  }

  async function loadStats() {
    if (!location.pathname.startsWith('/pc/integration/')) return;

    let adj, sched, owners;
    try {
      [adj, sched, owners] = await Promise.all([
        fetch('/api/inventory-adjustments').then(r => r.json()).catch(() => []),
        fetch('/api/inbound-schedules').then(r => r.json()).catch(() => []),
        fetch('/api/owners').then(r => r.json()).catch(() => []),
      ]);
    } catch (e) {
      console.log(`[integration-stats] TODO: API 取得失敗 (${e.message}). 右パネルはモック維持。`);
      return;
    }
    if (!Array.isArray(adj)) adj = [];
    if (!Array.isArray(sched)) sched = [];
    if (!Array.isArray(owners)) owners = [];

    const today = new Date().toISOString().slice(0, 10);
    const dateOf = r => String(r.updated_at || r.created_at || '').slice(0, 10);

    // ① 連携状況
    // ASN受信 + 在庫調整 を「連携イベント」として代用
    const integrationCard = findCardByHeader('連携状況');
    if (integrationCard) {
      const activeOwners = owners.length; // 連携先 = 荷主数 代用
      const errors = adj.filter(r => r.status === 'rejected').length;
      const todayEvents = [...sched, ...adj].filter(r => dateOf(r) === today).length;
      setRow(integrationCard, 'アクティブ', activeOwners + '件', 'accent');
      setRow(integrationCard, '停止', '0件', 'mute');
      setRow(integrationCard, 'エラー中', errors + '件', errors > 0 ? 'alert' : 'mute');
      // 「今日の連携回数」相当ラベルがあれば追加
      setRow(integrationCard, '本日件数', todayEvents + '件');
    }

    // ② 直近エラー
    const errorCard = findCardByHeader('直近エラー');
    if (errorCard) {
      const list = errorCard.querySelector('.mini-list');
      if (list) {
        // rejected な調整 + (失敗ステータスの予定があれば) を時系列でTOP5
        const errors = adj.filter(r => r.status === 'rejected')
          .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
          .slice(0, 5);
        if (errors.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = errors.map(r => `
            <div class="row">
              <span class="code">ERR</span>
              <span class="name">${escapeHtml(r.product_code || '-')} ${escapeHtml(r.reason_detail || r.reason_code || '')}</span>
              <span class="when">${escapeHtml(formatDate(r.updated_at || r.created_at))}</span>
            </div>`).join('');
        }
      }
    }

    // ③ 接続先
    const connCard = findCardByHeader('接続先');
    if (connCard) {
      const list = connCard.querySelector('.mini-list');
      if (list) {
        // 荷主マスタを「接続先」として代用 (上位5)
        const tops = owners.slice(0, 5);
        if (tops.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = tops.map(o => `
            <div class="row">
              <span class="code">${escapeHtml(o.code || '-')}</span>
              <span class="name">${escapeHtml(o.name || '-')}</span>
              <span class="when">OK</span>
            </div>`).join('');
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStats);
  } else {
    loadStats();
  }
})();
