/* サイドバー折りたたみ機能（共通）
 * .sidebar nav .group をクリックで、次の .group まで（or 末尾まで）の <a> を折りたたむ
 * 状態は localStorage に保存
 */
(function () {
  function init() {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;

    const groups = Array.from(nav.querySelectorAll('.group'));
    if (groups.length === 0) return;

    // 既存の collapse 状態を読込
    let state = {};
    try { state = JSON.parse(localStorage.getItem('sidebar-collapse') || '{}'); } catch {}

    groups.forEach((group) => {
      const key = (group.textContent || '').trim();
      group.style.cursor = 'pointer';
      group.style.userSelect = 'none';

      // ▼/▶ アイコン追加
      let chevron = group.querySelector('.chev');
      if (!chevron) {
        chevron = document.createElement('span');
        chevron.className = 'chev';
        chevron.style.cssText = 'float:right; font-size:10px; opacity:0.7;';
        chevron.textContent = '▼';
        group.appendChild(chevron);
      }

      // group の直後から次の .group まで（or 末尾まで）の要素を集める
      const items = [];
      let cur = group.nextElementSibling;
      while (cur && !cur.classList.contains('group') && !cur.classList.contains('sb-footer')) {
        items.push(cur);
        cur = cur.nextElementSibling;
      }

      // 初期状態を反映
      const isCollapsed = !!state[key];
      if (isCollapsed) {
        items.forEach(el => el.style.display = 'none');
        chevron.textContent = '▶';
      }

      group.addEventListener('click', () => {
        const collapsed = items[0]?.style.display === 'none';
        items.forEach(el => el.style.display = collapsed ? '' : 'none');
        chevron.textContent = collapsed ? '▼' : '▶';
        state[key] = !collapsed;
        try { localStorage.setItem('sidebar-collapse', JSON.stringify(state)); } catch {}
      });
    });

    // 「すべて折りたたむ / 展開する」ボタンを sb-footer 上に追加
    const sbFooter = document.querySelector('.sidebar .sb-footer');
    if (sbFooter && !document.querySelector('.sb-toggle-all')) {
      const btn = document.createElement('div');
      btn.className = 'sb-toggle-all';
      btn.style.cssText = 'padding:8px 18px; font-size:11px; color:#8da2bf; cursor:pointer; border-top:1px solid var(--c-accent-dk);';
      btn.textContent = '⇅ 全部折りたたむ / 展開する';
      btn.addEventListener('click', () => {
        const allCollapsed = groups.every(g => state[(g.textContent || '').trim().replace(/▼|▶/g,'').trim()]);
        groups.forEach(g => g.click());
        // 一回 click で逆になるので、状態を揃えるためもう一度判定
      });
      sbFooter.before(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
