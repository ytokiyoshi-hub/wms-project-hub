/* 新規デモ画面の共通ランタイム：シナリオ(SC)を解決して返す。
 * 優先順：親フレームのSC（実演中）→ ?s= から scenarios.js → 既定(beverage)。
 * 各画面は <script src="../scenarios.js"></script> の後にこれを読む。 */
window.resolveSC = function(){
  const sid = new URLSearchParams(location.search).get('s');
  let SC = null;
  try { if (window.parent && window.parent !== window && window.parent.SC) SC = window.parent.SC; } catch(e){}
  if (!SC) SC = (window.SCENARIOS && sid && window.SCENARIOS[sid]) || (window.SCENARIOS && window.SCENARIOS.beverage) || {};
  return SC;
};
/* 'YYYY-MM-DD' と基準日(2026-06-03)から残日数 */
window.daysTo = function(ymd){
  if(!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const base = new Date('2026-06-03T00:00:00');
  const d = new Date(ymd + 'T00:00:00');
  return Math.round((d - base) / 86400000);
};
window.yen = n => '¥' + Math.round(n).toLocaleString();
