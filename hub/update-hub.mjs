// Hub 自動更新ジェネレータ（launchd/cron から定期実行）。
// 実信号（wms-test2 の git コミット・gate レポートの PASS 数）を読み、
// index.html の <!--AUTO:xxx--> マーカー区間だけを差し替える。デザインには一切触れない。
// 実行: node hub/update-hub.mjs   （通常の node。Date等OK）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const HOME = os.homedir();
const HUB = path.join(HOME, 'github/wms-project-hub/wms-project-hub');
const WORK = path.join(HOME, 'github/wms-test2');           // アプリ本体repo（実信号源）
const INDEX = path.join(HUB, 'index.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sh = (cmd, cwd) => { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

// 1) 最近のコミット（全ブランチ・最新6件）= 「最近の動き」
const raw = sh("git log --all --no-merges -6 --date=format-local:'%m/%d %H:%M' --format='%cd%x09%s'", WORK);
const lines = raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
const items = lines.length
  ? lines.map(l => {
      const tab = l.indexOf('\t');
      const when = tab >= 0 ? l.slice(0, tab) : '';
      let subj = (tab >= 0 ? l.slice(tab + 1) : l).replace(/^['"]|['"]$/g, '');
      if (subj.length > 76) subj = subj.slice(0, 75) + '…';
      return `      <li><span class="al-when">${esc(when)}</span><span class="al-what">${esc(subj)}</span></li>`;
    }).join('\n')
  : '      <li><span class="al-when">—</span><span class="al-what">最近の更新はありません</span></li>';

// 2) gate レポートの PASS 数 = 「本番シナリオ X/Y 緑」
let pass = 0, total = 0;
try {
  const dir = path.join(WORK, 'test-runner/reports');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('-report.md'))) {
    total++;
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/(✅\s*PASS|\bPASS\b)/.test(t) && !/(❌|\bFAIL\b)/.test(t)) pass++;
  }
} catch {}
const gate = total ? `テストシナリオ ${pass}/${total} 緑` : 'テストシナリオ 集計待ち';

// 3) 最終更新（JST）
const stamp = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

// マーカー区間だけ置換
const repl = (html, key, content) =>
  html.replace(new RegExp(`<!--AUTO:${key}-->[\\s\\S]*?<!--/AUTO:${key}-->`),
    `<!--AUTO:${key}-->${content}<!--/AUTO:${key}-->`);

let html = fs.readFileSync(INDEX, 'utf8');
const before = html;
html = repl(html, 'updated', stamp);
html = repl(html, 'activity', '\n' + items + '\n');
html = repl(html, 'gate', esc(gate));
if (html !== before) {
  fs.writeFileSync(INDEX, html);
  console.log(`[update-hub] updated ${stamp} | commits=${lines.length} | ${gate}`);
} else {
  console.log(`[update-hub] no change ${stamp}`);
}
