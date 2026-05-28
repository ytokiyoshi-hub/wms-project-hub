// 共通: 入出荷/作業系 (inbound/outbound/workforce/returns/stocktake) の
// 右パネル「本日サマリ / 進捗 / 要対応」を実データに。
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

  async function loadStats() {
    const path = location.pathname;
    if (!/^\/pc\/(inbound|outbound|workforce|returns|stocktake)\//.test(path)) return;

    // セクション別に主データを変える
    let primary = '/api/inbound-schedules';
    let primaryDateField = 'scheduled_date';
    if (path.startsWith('/pc/outbound')) { primary = '/api/shipment-orders'; primaryDateField = 'scheduled_date'; }
    if (path.startsWith('/pc/returns')) { primary = '/api/inbound-schedules'; primaryDateField = 'scheduled_date'; } // 返品入荷
    if (path.startsWith('/pc/stocktake')) { primary = '/api/inventory-adjustments'; primaryDateField = 'updated_at'; }
    if (path.startsWith('/pc/workforce')) { primary = '/api/employees'; primaryDateField = 'updated_at'; }

    let rows;
    try {
      const res = await fetch(primary);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows = await res.json();
    } catch (e) {
      console.log(`[inout-stats] TODO: API 取得失敗 (${primary}: ${e.message}). 右パネルはモック維持。`);
      return;
    }
    if (!Array.isArray(rows)) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const dateOf = r => String(r[primaryDateField] || r.updated_at || r.created_at || '').slice(0, 10);

    // ① 本日サマリ
    const todayCard = findCardByHeader('本日サマリ');
    if (todayCard) {
      const todayRows = rows.filter(r => dateOf(r) === todayStr);
      const total = todayRows.length;
      const completed = todayRows.filter(r => /completed|done|approved|shipped/.test(r.status || '')).length;
      const inProgress = todayRows.filter(r => /inspecting|picking|loading|in_progress|pending/.test(r.status || '')).length;
      const planned = todayRows.filter(r => /planned|new/.test(r.status || '')).length;
      setRow(todayCard, '合計', total + '件', 'accent');
      setRow(todayCard, '完了', completed + '件');
      setRow(todayCard, '進行中', inProgress + '件', inProgress > 0 ? 'accent' : 'mute');
      setRow(todayCard, '待ち', planned + '件', 'mute');
    }

    // ② 進捗 (全期間ベース)
    const progressCard = findCardByHeader('進捗');
    if (progressCard) {
      const completedAll = rows.filter(r => /completed|done|approved|shipped/.test(r.status || '')).length;
      const failedAll = rows.filter(r => /failed|rejected|cancelled/.test(r.status || '')).length;
      const total = rows.length;
      const slaRate = total > 0 ? Math.round(completedAll / total * 1000) / 10 : null;
      setRow(progressCard, 'SLA達成', slaRate == null ? '-' : (slaRate + '%'), 'accent');
      setRow(progressCard, 'SLA遅延', failedAll + '件', failedAll > 0 ? 'alert' : 'mute');
      setRow(progressCard, '平均処理時間', '-', 'mute'); // 算出困難 → mock 維持
    }

    // ③ 要対応 (失敗/遅延 TOP5)
    const alertCard = findCardByHeader('要対応');
    if (alertCard) {
      const list = alertCard.querySelector('.mini-list');
      if (list) {
        const alerts = rows.filter(r => /failed|rejected|cancelled|pending/.test(r.status || ''))
          .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
          .slice(0, 5);
        if (alerts.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = alerts.map(r => {
            const kind = /failed|rejected/.test(r.status) ? '失敗' : /cancelled/.test(r.status) ? '取消' : '保留';
            const ref = r.schedule_no || r.order_no || r.code || r.product_code || r.id || '-';
            return `<div class="row">
              <span class="code">${kind}</span>
              <span class="name">${escapeHtml(String(ref))}</span>
              <span class="when">${escapeHtml(formatDate(r.updated_at || r.scheduled_date))}</span>
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
