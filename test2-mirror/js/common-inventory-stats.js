// 共通: pc/inventory/*.html の右パネル「在庫サマリ / 要対応在庫 / 直近変動」を実データに
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
    if (!location.pathname.startsWith('/pc/inventory/')) return;

    let inv, adj;
    try {
      [inv, adj] = await Promise.all([
        fetch('/api/inventory').then(r => r.json()).catch(() => []),
        fetch('/api/inventory-adjustments').then(r => r.json()).catch(() => []),
      ]);
    } catch (e) {
      console.log(`[inventory-stats] TODO: API 取得失敗 (${e.message}). 右パネルはモック維持。`);
      return;
    }
    if (!Array.isArray(inv)) inv = [];
    if (!Array.isArray(adj)) adj = [];

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // ① 在庫サマリ
    const sumCard = findCardByHeader('在庫サマリ');
    if (sumCard) {
      const totalQty = inv.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      const skuCount = new Set(inv.map(r => r.product_code).filter(Boolean)).size;
      const locCount = new Set(inv.map(r => r.location_code).filter(Boolean)).size;
      setRow(sumCard, '総在庫', totalQty.toLocaleString(), 'accent');
      setRow(sumCard, 'フリー在庫', totalQty.toLocaleString()); // 引当 schema 無し→総=フリー
      setRow(sumCard, '引当済', '0', 'mute');
      setRow(sumCard, '使用ロケ数', locCount + 'ロケ', 'mute');
    }

    // ② 要対応在庫
    const alertCard = findCardByHeader('要対応在庫');
    if (alertCard) {
      // 期限切迫 (30日以内)
      const expiring = inv.filter(r => {
        if (!r.expiry_date) return false;
        const days = Math.floor((new Date(r.expiry_date) - new Date(todayStr)) / 86400000);
        return days >= 0 && days <= 30;
      }).length;
      // 滞留 (90日以上動きなし)
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const stale = inv.filter(r => r.updated_at && String(r.updated_at).slice(0, 10) < cutoffStr).length;
      // 欠品リスク (qty=0 のロット) — 代用
      const zeroQty = inv.filter(r => (Number(r.qty) || 0) <= 0).length;
      setRow(alertCard, '欠品リスク', zeroQty + '件', zeroQty > 0 ? 'alert' : 'mute');
      setRow(alertCard, '期限切迫 (30日)', expiring + '件', expiring > 0 ? '' : 'mute');
      setRow(alertCard, '長期滞留 (90日)', stale + '件', 'mute');
    }

    // ③ 直近の変動
    const recentCard = findCardByHeader('直近の変動');
    if (recentCard) {
      const list = recentCard.querySelector('.mini-list');
      if (list) {
        // inventory_adjustments 直近 5件
        const sorted = [...adj].sort((a, b) =>
          String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))
        ).slice(0, 5);
        if (sorted.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = sorted.map(r => {
            const kind = r.status === 'approved' ? '調整' : r.status === 'rejected' ? '却下' : '保留';
            return `<div class="row">
              <span class="code">${kind}</span>
              <span class="name">${escapeHtml(r.product_code || '-')} (${escapeHtml(r.location_code || '-')})</span>
              <span class="when">${escapeHtml(formatDate(r.updated_at || r.created_at))}</span>
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
