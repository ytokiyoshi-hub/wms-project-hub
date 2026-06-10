/* 生成された業種シナリオ(_new_scenarios.json)を整合補正して scenarios.js にマージする。
 * 使い方: node _merge_scenarios.cjs
 * - inbound/counts の商品名を products に揃える（同一3商品を保証）
 * - counts.theory = inbound.qty（棚卸差異0を保証）
 * - move.nm / picks.nm を products のいずれかに矯正
 * - picks.qty を inbound 在庫より小さくクランプ（出荷後在庫が正）
 * - 既存6業種はそのまま温存し、新規分を末尾の }; 直前に追記
 */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const SCEN = path.join(dir, 'scenarios.js');
const NEW = path.join(dir, '_new_scenarios.json');

const news = JSON.parse(fs.readFileSync(NEW, 'utf8'));
const list = Array.isArray(news) ? news : (news.scenarios || []);

function fix(s) {
  const names = s.products.map(p => p.name);
  // 同一3商品を保証（順序を products に合わせる）
  s.inbound = s.inbound.map((it, i) => ({ ...it, nm: names[i], code: s.products[i].code }));
  s.counts  = s.counts.map((c, i) => ({ ...c, nm: names[i], theory: s.inbound[i].qty }));
  // move.nm を有効商品に
  if (!names.includes(s.move.nm)) s.move.nm = names[0];
  const moveIdx = names.indexOf(s.move.nm);
  // move.qty は在庫以下
  if (s.move.qty > s.inbound[moveIdx].qty) s.move.qty = Math.max(1, Math.round(s.inbound[moveIdx].qty / 4));
  // picks: nm を有効商品に、qty を在庫より十分小さくクランプ
  s.outbound.picks = s.outbound.picks.map((p, i) => {
    let nm = names.includes(p.nm) ? p.nm : names[i % names.length];
    const idx = names.indexOf(nm);
    const cap = s.inbound[idx].qty;
    let qty = p.qty;
    if (qty >= cap) qty = Math.max(1, Math.round(cap / 12));
    return { ...p, nm, qty };
  });
  return s;
}

const fixed = list.map(fix);

// JS ブロック生成（キーはハイフン対応でクオート）
let block = '';
for (const s of fixed) {
  const body = JSON.stringify(s, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n');
  block += `\n  ${JSON.stringify(s.id)}: ${body},\n`;
}

let js = fs.readFileSync(SCEN, 'utf8');
const cut = js.lastIndexOf('\n};');
if (cut < 0) { console.error('FAIL: 末尾の }; が見つからない'); process.exit(1); }
js = js.slice(0, cut) + block + '\n};\n';
fs.writeFileSync(SCEN, js);

// 件数レポート
const keys = (js.match(/^\s{2}(?:'[^']+'|[a-z-]+):\s*\{/gim) || []).length;
console.log(`merged ${fixed.length} new scenarios. file now has ~${keys} top-level scenarios (incl. 6既存).`);
console.log('ids:', fixed.map(s => s.id).join(', '));
