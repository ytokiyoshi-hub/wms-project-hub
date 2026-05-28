// 共通: 汎用セクション (billing/reports/notifications/calendars/settings/help) の
// 右パネル「サマリ / 関連情報 / 最近の活動」を実データに。
// 1号 MESSAGE_RIGHT_PANE_REAL_FINAL 対応 Step 4。

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
    const md = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (md) return `${md[2]}-${md[3]}`;
    return String(s);
  }

  // セクション → 主データAPI
  const SECTION_API = {
    billing: { api: '/api/billing-rates', kindLabel: '請求' },
    reports: { api: '/api/inbound-schedules', kindLabel: '帳票' },
    notifications: { api: '/api/notes', kindLabel: '通知' },
    calendars: { api: '/api/calendars', kindLabel: '予定' },
    settings: { api: null, kindLabel: '設定' },
    help: { api: null, kindLabel: 'ヘルプ' },
  };

  async function loadStats() {
    const m = location.pathname.match(/^\/pc\/(billing|reports|notifications|calendars|settings|help)\//);
    if (!m) return;
    const section = m[1];
    const conf = SECTION_API[section];
    if (!conf || !conf.api) {
      console.log(`[generic-stats] TODO: section=${section} に対応 API なし。モック維持。`);
      return;
    }

    let rows;
    try {
      const res = await fetch(conf.api);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows = await res.json();
    } catch (e) {
      console.log(`[generic-stats] TODO: API 取得失敗 (${conf.api}: ${e.message}). モック維持。`);
      return;
    }
    if (!Array.isArray(rows)) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    // ① サマリ
    const sumCard = findCardByHeader('サマリ');
    if (sumCard) {
      const total = rows.length;
      const active = rows.filter(r => (r.status === undefined || r.status === null) ? true : r.status === 'active' || r.status === 'open').length;
      const todayAdded = rows.filter(r => {
        const ts = r.created_at || r.updated_at;
        return ts && String(ts).startsWith(todayStr);
      }).length;
      setRow(sumCard, '合計', total + '件', 'accent');
      setRow(sumCard, 'アクティブ', active + '件');
      setRow(sumCard, '本日追加', todayAdded + '件', todayAdded > 0 ? 'accent' : 'mute');
    }

    // ② 関連情報 (mock 維持 — 関連の意味づけが画面ごとに違うため)

    // ③ 最近の活動
    const recentCard = findCardByHeader('最近の活動');
    if (recentCard) {
      const list = recentCard.querySelector('.mini-list');
      if (list) {
        const sorted = [...rows].sort((a, b) =>
          String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))
        ).slice(0, 5);
        if (sorted.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = sorted.map(r => {
            const code = r.code || r.id || '-';
            const name = r.name || r.title || r.body || r.product_code || '-';
            const when = formatDate(r.updated_at || r.created_at);
            return `<div class="row">
              <span class="code">${conf.kindLabel}</span>
              <span class="name">${escapeHtml(String(name).slice(0, 30))}</span>
              <span class="when">${escapeHtml(when)}</span>
            </div>`;
          }).join('');
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
