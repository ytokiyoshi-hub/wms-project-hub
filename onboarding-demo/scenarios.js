/* ============================================================
 * オンボーディング診断デモ — 業種シナリオ定義
 * engine.html が ?s=<id> で window.SCENARIOS[id] を読み込む。
 *
 * 【スキーマ】各シナリオは以下の形：
 * {
 *   id:       一意キー（URL ?s= に使う・英小文字とハイフン）
 *   emoji:    ギャラリーカードのアイコン
 *   industry: 業種名（短い）
 *   title:    実演トップのステージカード見出し（「○○倉庫 ─ 1日の流れ」）
 *   tagline:  ギャラリー用の一言説明（商材/回転/出荷の特徴）
 *   answers:  ヒアリング自動回答 {shelf:yes|no, temp:normal|cold, owner:single|multi, ship:btob|ec, turn:bulk|fast}
 *   said:     （任意）言い当てHTML。省略時はengineが回答から自動生成
 *   products: マスター登録する商品3点 [{code,name,jan,exp}]   ※exp=賞味期限日数(なければ'')
 *   inbound:  入荷HT検品3品 [{nm,code,jan,lot,exp,qty}]        ※qty=ケース数
 *   counts:   棚卸カウント3件 [{nm,loc,theory}]
 *   move:     ロケ移動1件 {nm,fromLoc,toLoc,qty,area}
 *   outbound: 出庫 {orderLabel, soId, picks:[{nm,loc,qty}]}
 * }
 * 商品名(nm/name)は「主名称 + 半角/全角スペース + 規格」の形にすると
 * ナレーションで主名称だけを短く表示できる（例「白Tシャツ Mサイズ」→「白Tシャツ」）。
 * ============================================================ */
window.SCENARIOS = {

  /* ===== #1 飲料（現行デモと完全同値・無回帰の基準） ===== */
  beverage: {
    id:'beverage', emoji:'🥤', industry:'飲料',
    title:'飲料パレット預かり倉庫 ─ 1日の流れ',
    tagline:'賞味期限あり／常温／店舗向け大口・少品種パレット定番',
    answers:{ shelf:'yes', temp:'normal', owner:'single', ship:'btob', turn:'bulk' },
    products:[
      {code:'BV-WATER', name:'天然水 2L×6',    jan:'4901000000017', exp:'365'},
      {code:'BV-OCHA',  name:'緑茶 500ml×24',  jan:'4901000000024', exp:'270'},
      {code:'BV-COLA',  name:'コーラ 500ml×24', jan:'4901000000031', exp:'180'},
    ],
    inbound:[
      {nm:'天然水 2L×6',   code:'BV-WATER', jan:'4901000000017', lot:'L260603A', exp:'2027-06-03', qty:480},
      {nm:'緑茶 500ml×24',  code:'BV-OCHA',  jan:'4901000000024', lot:'L260603B', exp:'2027-03-03', qty:240},
      {nm:'コーラ 500ml×24',code:'BV-COLA',  jan:'4901000000031', lot:'L260603C', exp:'2026-12-03', qty:384},
    ],
    counts:[
      {nm:'天然水 2L×6',   loc:'A-01-01', theory:480},
      {nm:'緑茶 500ml×24',  loc:'A-01-02', theory:240},
      {nm:'コーラ 500ml×24',loc:'A-01-03', theory:384},
    ],
    move:{ nm:'天然水 2L×6', fromLoc:'A-01-01', toLoc:'P-01', qty:480, area:'常温A' },
    outbound:{ orderLabel:'ローソン港店向け（天然水20・緑茶10ケース）', soId:'SO-2026-0603-01',
      picks:[ {nm:'天然水 2L×6',loc:'P-01',qty:20}, {nm:'緑茶 500ml×24',loc:'P-02',qty:10} ] },
  },

  /* ===== #2 アパレル ===== */
  apparel: {
    id:'apparel', emoji:'👕', industry:'アパレル',
    title:'アパレル物流倉庫 ─ 1日の流れ',
    tagline:'期限なし／常温／多品種・小ロット高回転・EC＋店舗',
    answers:{ shelf:'no', temp:'normal', owner:'multi', ship:'ec', turn:'fast' },
    products:[
      {code:'AP-TSH-WM', name:'白Tシャツ Mサイズ', jan:'4902000010014', exp:''},
      {code:'AP-DNM-32', name:'デニムパンツ 32',   jan:'4902000010021', exp:''},
      {code:'AP-NIT-FR', name:'ニット フリー',      jan:'4902000010038', exp:''},
    ],
    inbound:[
      {nm:'白Tシャツ Mサイズ', code:'AP-TSH-WM', jan:'4902000010014', lot:'SS26-01', exp:'—', qty:600},
      {nm:'デニムパンツ 32',   code:'AP-DNM-32', jan:'4902000010021', lot:'SS26-02', exp:'—', qty:320},
      {nm:'ニット フリー',      code:'AP-NIT-FR', jan:'4902000010038', lot:'AW26-01', exp:'—', qty:200},
    ],
    counts:[
      {nm:'白Tシャツ Mサイズ', loc:'B-02-01', theory:600},
      {nm:'デニムパンツ 32',   loc:'B-02-02', theory:320},
      {nm:'ニット フリー',      loc:'B-02-03', theory:200},
    ],
    move:{ nm:'白Tシャツ Mサイズ', fromLoc:'B-02-01', toLoc:'P-11', qty:120, area:'常温B' },
    outbound:{ orderLabel:'EC出荷（個人向け・白T15・デニム8点）', soId:'SO-2026-0603-11',
      picks:[ {nm:'白Tシャツ Mサイズ',loc:'P-11',qty:15}, {nm:'デニムパンツ 32',loc:'P-12',qty:8} ] },
  },

  /* ===== #3 医薬品 ===== */
  pharma: {
    id:'pharma', emoji:'💊', industry:'医薬品',
    title:'医薬品物流倉庫 ─ 1日の流れ',
    tagline:'ロット・使用期限厳格／冷蔵あり／GDP・トレサビ・3PL',
    answers:{ shelf:'yes', temp:'cold', owner:'multi', ship:'btob', turn:'fast' },
    products:[
      {code:'PH-TAB-A', name:'解熱鎮痛錠A PTP10', jan:'4903000020011', exp:'730'},
      {code:'PH-CAP-B', name:'抗生剤カプセルB 14', jan:'4903000020028', exp:'540'},
      {code:'PH-INJ-C', name:'注射液C 5ml 冷蔵',   jan:'4903000020035', exp:'365'},
    ],
    inbound:[
      {nm:'解熱鎮痛錠A PTP10',  code:'PH-TAB-A', jan:'4903000020011', lot:'LOT2606A', exp:'2028-06-03', qty:300},
      {nm:'抗生剤カプセルB 14',  code:'PH-CAP-B', jan:'4903000020028', lot:'LOT2606B', exp:'2027-12-03', qty:180},
      {nm:'注射液C 5ml 冷蔵',    code:'PH-INJ-C', jan:'4903000020035', lot:'LOT2606C', exp:'2027-06-03', qty:120},
    ],
    counts:[
      {nm:'解熱鎮痛錠A PTP10', loc:'C-01-01', theory:300},
      {nm:'抗生剤カプセルB 14', loc:'C-01-02', theory:180},
      {nm:'注射液C 5ml 冷蔵',   loc:'R-CLD-01', theory:120},
    ],
    move:{ nm:'解熱鎮痛錠A PTP10', fromLoc:'C-01-01', toLoc:'P-21', qty:90, area:'常温C' },
    outbound:{ orderLabel:'調剤薬局チェーン向け（鎮痛錠40・カプセル20）', soId:'SO-2026-0603-21',
      picks:[ {nm:'解熱鎮痛錠A PTP10',loc:'P-21',qty:40}, {nm:'抗生剤カプセルB 14',loc:'P-22',qty:20} ] },
  },

  /* ===== #4 化粧品 ===== */
  cosmetics: {
    id:'cosmetics', emoji:'💄', industry:'化粧品',
    title:'化粧品物流倉庫 ─ 1日の流れ',
    tagline:'ロット・期限あり／常温／ギフト個口・EC高回転',
    answers:{ shelf:'yes', temp:'normal', owner:'multi', ship:'ec', turn:'fast' },
    products:[
      {code:'CS-LIP-RD', name:'リップ ルージュ赤', jan:'4904000030018', exp:'1095'},
      {code:'CS-FND-02', name:'ファンデ 02ベージュ', jan:'4904000030025', exp:'1095'},
      {code:'CS-LOT-50', name:'化粧水 50mlミニ',    jan:'4904000030032', exp:'730'},
    ],
    inbound:[
      {nm:'リップ ルージュ赤',  code:'CS-LIP-RD', jan:'4904000030018', lot:'CL2606A', exp:'2029-06-03', qty:240},
      {nm:'ファンデ 02ベージュ', code:'CS-FND-02', jan:'4904000030025', lot:'CL2606B', exp:'2029-06-03', qty:180},
      {nm:'化粧水 50mlミニ',     code:'CS-LOT-50', jan:'4904000030032', lot:'CL2606C', exp:'2028-06-03', qty:360},
    ],
    counts:[
      {nm:'リップ ルージュ赤',  loc:'D-01-01', theory:240},
      {nm:'ファンデ 02ベージュ', loc:'D-01-02', theory:180},
      {nm:'化粧水 50mlミニ',     loc:'D-01-03', theory:360},
    ],
    move:{ nm:'化粧水 50mlミニ', fromLoc:'D-01-03', toLoc:'P-31', qty:120, area:'常温D' },
    outbound:{ orderLabel:'EC・ギフト出荷（リップ12・化粧水20）', soId:'SO-2026-0603-31',
      picks:[ {nm:'リップ ルージュ赤',loc:'P-31',qty:12}, {nm:'化粧水 50mlミニ',loc:'P-32',qty:20} ] },
  },

  /* ===== #5 機械部品 ===== */
  'machine-parts': {
    id:'machine-parts', emoji:'⚙️', industry:'機械部品',
    title:'機械部品物流倉庫 ─ 1日の流れ',
    tagline:'期限なし／常温／多品種・小ロット・シリアル管理・BtoB',
    answers:{ shelf:'no', temp:'normal', owner:'single', ship:'btob', turn:'fast' },
    products:[
      {code:'MP-BRG-608', name:'ベアリング 608ZZ', jan:'4905000040015', exp:''},
      {code:'MP-BLT-M8',  name:'六角ボルト M8×30', jan:'4905000040022', exp:''},
      {code:'MP-GER-20T', name:'平歯車 20T',       jan:'4905000040039', exp:''},
    ],
    inbound:[
      {nm:'ベアリング 608ZZ', code:'MP-BRG-608', jan:'4905000040015', lot:'MP2606A', exp:'—', qty:500},
      {nm:'六角ボルト M8×30', code:'MP-BLT-M8',  jan:'4905000040022', lot:'MP2606B', exp:'—', qty:800},
      {nm:'平歯車 20T',       code:'MP-GER-20T', jan:'4905000040039', lot:'MP2606C', exp:'—', qty:150},
    ],
    counts:[
      {nm:'ベアリング 608ZZ', loc:'E-03-01', theory:500},
      {nm:'六角ボルト M8×30', loc:'E-03-02', theory:800},
      {nm:'平歯車 20T',       loc:'E-03-03', theory:150},
    ],
    move:{ nm:'ベアリング 608ZZ', fromLoc:'E-03-01', toLoc:'P-41', qty:100, area:'常温E' },
    outbound:{ orderLabel:'製造業者向け（ベアリング60・ボルト120）', soId:'SO-2026-0603-41',
      picks:[ {nm:'ベアリング 608ZZ',loc:'P-41',qty:60}, {nm:'六角ボルト M8×30',loc:'P-42',qty:120} ] },
  },

  /* ===== #6 EC総合 ===== */
  'ec-general': {
    id:'ec-general', emoji:'📦', industry:'EC総合',
    title:'EC総合フルフィルメント倉庫 ─ 1日の流れ',
    tagline:'多品種・個口／常温／ギフト・送り状・超高回転 3PL',
    answers:{ shelf:'no', temp:'normal', owner:'multi', ship:'ec', turn:'fast' },
    products:[
      {code:'EC-MUG-WH', name:'マグカップ 白', jan:'4906000050012', exp:''},
      {code:'EC-TWL-GY', name:'タオル グレー', jan:'4906000050029', exp:''},
      {code:'EC-CBL-1M', name:'USBケーブル 1m', jan:'4906000050036', exp:''},
    ],
    inbound:[
      {nm:'マグカップ 白', code:'EC-MUG-WH', jan:'4906000050012', lot:'EC2606A', exp:'—', qty:420},
      {nm:'タオル グレー', code:'EC-TWL-GY', jan:'4906000050029', lot:'EC2606B', exp:'—', qty:360},
      {nm:'USBケーブル 1m', code:'EC-CBL-1M', jan:'4906000050036', lot:'EC2606C', exp:'—', qty:540},
    ],
    counts:[
      {nm:'マグカップ 白', loc:'F-02-01', theory:420},
      {nm:'タオル グレー', loc:'F-02-02', theory:360},
      {nm:'USBケーブル 1m', loc:'F-02-03', theory:540},
    ],
    move:{ nm:'USBケーブル 1m', fromLoc:'F-02-03', toLoc:'P-51', qty:150, area:'常温F' },
    outbound:{ orderLabel:'EC個人向け（マグ1・ケーブル2をギフト同梱）', soId:'SO-2026-0603-51',
      picks:[ {nm:'マグカップ 白',loc:'P-51',qty:18}, {nm:'USBケーブル 1m',loc:'P-52',qty:24} ] },
  },

};
