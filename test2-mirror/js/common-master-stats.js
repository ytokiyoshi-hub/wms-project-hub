// 共通: pc/master/*.html の右パネル「マスタの状況 / データ品質 / 最近の追加・編集」を実データに
// 1号 MESSAGE_RIGHT_PANE_REAL_MASTER 対応 Step1。
//
// 動作:
//   URL の /pc/master/{entity}.html から entity を判定 → ENTITY_MAP のAPI を fetch
//   → 右パネル card を「ヘッダ見出し」で特定 → 各 .summary-row をラベルで特定して値を上書き
//
// 未マップ entity は console.log で TODO 通知のみ。モック値はそのまま。

(function () {
  const ENTITY_MAP = {
    // 実 API が GET /api/{name} で配列を返すもの:
    products:            { api: '/api/products',          code: 'code',  name: 'name'  },
    customers:           { api: '/api/customers',         code: 'code',  name: 'name'  },
    owners:              { api: '/api/owners',            code: 'code',  name: 'name'  },
    locations:           { api: '/api/locations',         code: 'code',  name: 'name'  },
    units:               { api: '/api/units',             code: 'code',  name: 'name'  },
    carriers:            { api: '/api/carriers',          code: 'code',  name: 'name'  },
    drivers:             { api: '/api/drivers',           code: 'code',  name: 'name'  },
    vehicles:            { api: '/api/vehicles',          code: 'code',  name: 'name'  },
    warehouses:          { api: '/api/warehouses',        code: 'code',  name: 'name'  },
    regions:             { api: '/api/regions',           code: 'code',  name: 'name'  },
    calendars:           { api: '/api/calendars',         code: 'code',  name: 'name'  },
    location_types:      { api: '/api/location-types',    code: 'char',  name: 'name'  },
    adjustment_reasons:  { api: '/api/adjustment-reasons', code: 'code', name: 'name'  },
    carrier_routes:      { api: '/api/carrier-routes',    code: 'code',  name: 'name'  },
    packing_rules:       { api: '/api/packing-rules',     code: 'owner_code', name: 'pattern_code' },
    replenishment_rules: { api: '/api/replenishment-rules', code: 'id',  name: 'product_code' },
    rates:               { api: '/api/billing-rates',     code: 'id',    name: 'owner_code' },
    users:               { api: '/api/system-users',      code: 'id',    name: 'email' },
  };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function findCardByHeader(text) {
    const cards = document.querySelectorAll('.right-pane .card, .right-pane > .card');
    for (const card of cards) {
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

  function formatDateShort(s) {
    if (!s) return '-';
    // 2026-06-01T14:35 / 2026-06-01 14:35 形式 → 06-01 14:35
    const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
    const md = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (md) return `${md[2]}-${md[3]}`;
    return String(s);
  }

  async function loadStats() {
    const m = location.pathname.match(/\/pc\/master\/([a-z_]+)\.html$/);
    if (!m) return;
    const entity = m[1];
    const conf = ENTITY_MAP[entity];
    if (!conf) {
      console.log(`[master-stats] TODO: 実API未マップ entity=${entity}. 右パネルはモック維持。`);
      return;
    }

    let rows;
    try {
      const res = await fetch(conf.api);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows = await res.json();
    } catch (e) {
      console.log(`[master-stats] TODO: API fetch 失敗 (${conf.api}): ${e.message}. 右パネルはモック維持。`);
      return;
    }
    if (!Array.isArray(rows)) return;

    // ① マスタの状況
    const summary = findCardByHeader('マスタの状況');
    if (summary) {
      const total = rows.length;
      const active = rows.filter(r => (r.status === undefined || r.status === null) ? true : r.status === 'active').length;
      const inactive = rows.filter(r => r.status === 'inactive' || r.status === 'closed' || r.status === 'suspended').length;
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayAdded = rows.filter(r => {
        const ts = r.created_at || r.updated_at;
        return ts && String(ts).startsWith(todayStr);
      }).length;
      setRow(summary, '登録件数', total + '件', 'accent');
      setRow(summary, 'アクティブ', active + '件');
      setRow(summary, '休止', inactive + '件', inactive > 0 ? '' : 'mute');
      setRow(summary, '本日追加', todayAdded + '件', todayAdded > 0 ? 'accent' : 'mute');
    }

    // ② データ品質
    const quality = findCardByHeader('データ品質');
    if (quality) {
      const codes = rows.map(r => r[conf.code]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      const names = rows.map(r => r[conf.name]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      const missingCode = rows.length - codes.length;
      const missingName = rows.length - names.length;
      const dupCode = codes.length - new Set(codes.map(String)).size;
      const missingTotal = missingCode + missingName;
      setRow(quality, '必須項目欠損', missingTotal + '件', missingTotal > 0 ? 'alert' : 'mute');
      setRow(quality, 'コード重複', dupCode + '件', dupCode > 0 ? 'alert' : 'mute');
      // 未使用: 算出困難 (関連テーブル必要) → モック維持・末尾に TODO
      setRow(quality, '未使用', '-', 'mute');
    }

    // ③ 最近の追加・編集
    const recent = findCardByHeader('最近の追加・編集');
    if (recent) {
      const list = recent.querySelector('.mini-list');
      if (list) {
        const sorted = [...rows].sort((a, b) => {
          const ta = a.updated_at || a.created_at || '';
          const tb = b.updated_at || b.created_at || '';
          return String(tb).localeCompare(String(ta));
        }).slice(0, 5);
        if (sorted.length === 0) {
          list.innerHTML = '<div class="row"><span class="name" style="color:#9ca3af;">該当なし</span></div>';
        } else {
          list.innerHTML = sorted.map(r => {
            const code = r[conf.code] || '-';
            const name = r[conf.name] || '-';
            const when = formatDateShort(r.updated_at || r.created_at);
            return `<div class="row">
              <span class="code">${escapeHtml(code)}</span>
              <span class="name">${escapeHtml(name)}</span>
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
