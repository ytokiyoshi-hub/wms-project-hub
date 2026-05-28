// 共通: pc/audit/*.html の右パネル「期間サマリ / 成功・失敗 / 直近アラート」を実データに
// 1号 MESSAGE_RIGHT_PANE_REAL_AUDIT 対応 Step 2。
//
// 注: 実 audit-log API が無いため、業務イベント (inventory-adjustments) を
// 「監査対象イベント」として代用。承認/却下/保留 を成功/失敗/中間として扱う。
// 未実装の本当のログ系 (api-log / login-history / seal-log 等) は対象 API が
// 存在しないため、現状この代用集計でも妥当な参考値を表示できる。

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
    if (!location.pathname.startsWith('/pc/audit/')) return;

    let rows;
    try {
      const res = await fetch('/api/inventory-adjustments');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows = await res.json();
    } catch (e) {
      console.log(`[audit-stats] TODO: 監査イベント API 取得失敗 (${e.message}). 右パネルはモック維持。`);
      return;
    }
    if (!Array.isArray(rows)) return;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);
    const monthAgoStr = monthAgo.toISOString().slice(0, 10);

    const dateOf = r => String(r.updated_at || r.created_at || r.requested_at || '').slice(0, 10);

    // ① 期間サマリ
    const periodCard = findCardByHeader('期間サマリ');
    if (periodCard) {
      const todayCnt = rows.filter(r => dateOf(r) === todayStr).length;
      const weekCnt = rows.filter(r => dateOf(r) >= weekAgoStr).length;
      const monthCnt = rows.filter(r => dateOf(r) >= monthAgoStr).length;
      setRow(periodCard, '本日件数', todayCnt + '件', 'accent');
      setRow(periodCard, '今週累計', weekCnt + '件');
      setRow(periodCard, '今月累計', monthCnt + '件', 'mute');
    }

    // ② 成功 / 失敗 (approved=成功 / rejected=失敗 / pending=中間)
    const sfCard = findCardByHeader('成功 / 失敗');
    if (sfCard) {
      const success = rows.filter(r => r.status === 'approved').length;
      const failure = rows.filter(r => r.status === 'rejected').length;
      const total = success + failure;
      const successRate = total > 0 ? Math.round(success / total * 1000) / 10 : null;
      setRow(sfCard, '成功', success + '件', 'accent');
      setRow(sfCard, '失敗', failure + '件', failure > 0 ? 'alert' : 'mute');
      setRow(sfCard, '成功率', successRate == null ? '-' : (successRate + '%'));
    }

    // ③ 直近アラート (rejected または pending 長期)
    const alertCard = findCardByHeader('直近アラート');
    if (alertCard) {
      const list = alertCard.querySelector('.mini-list');
      if (list) {
        const alerts = rows.filter(r => r.status === 'rejected' || r.status === 'pending')
          .slice(0, 5);
        if (alerts.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = alerts.map(r => {
            const kind = r.status === 'rejected' ? 'WARN' : 'INFO';
            const name = `${escapeHtml(r.product_code || '-')} ${escapeHtml(r.reason_detail || r.reason_code || '')}`.slice(0, 30);
            const when = formatDate(r.updated_at || r.created_at);
            return `<div class="row">
              <span class="code">${kind}</span>
              <span class="name">${name}</span>
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
