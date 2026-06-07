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

  "fresh-food": {
    "id": "fresh-food",
    "emoji": "🥗",
    "industry": "生鮮食品（惣菜・日配）",
    "title": "生鮮惣菜・日配 冷蔵物流倉庫 ─ 1日の流れ",
    "tagline": "賞味期限短い／冷蔵・冷凍中心／3PL複数荷主・店舗向け大口＋一部EC・高回転",
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "multi",
      "ship": "btob",
      "turn": "fast"
    },
    "products": [
      {
        "code": "FF-POSA-500",
        "name": "ポテトサラダ 500g",
        "jan": "4907000060019",
        "exp": "5"
      },
      {
        "code": "FF-TOFU-300",
        "name": "絹豆腐 300g",
        "jan": "4907000060026",
        "exp": "7"
      },
      {
        "code": "FF-KARA-1K",
        "name": "冷凍唐揚げ 1kg",
        "jan": "4907000060033",
        "exp": "180"
      }
    ],
    "inbound": [
      {
        "nm": "ポテトサラダ 500g",
        "code": "FF-POSA-500",
        "jan": "4907000060019",
        "lot": "FF260608A",
        "exp": "2026-06-13",
        "qty": 360
      },
      {
        "nm": "絹豆腐 300g",
        "code": "FF-TOFU-300",
        "jan": "4907000060026",
        "lot": "FF260608B",
        "exp": "2026-06-15",
        "qty": 480
      },
      {
        "nm": "冷凍唐揚げ 1kg",
        "code": "FF-KARA-1K",
        "jan": "4907000060033",
        "lot": "FF260608C",
        "exp": "2026-12-05",
        "qty": 240
      }
    ],
    "counts": [
      {
        "nm": "ポテトサラダ 500g",
        "loc": "R-01-01",
        "theory": 360
      },
      {
        "nm": "絹豆腐 300g",
        "loc": "R-01-02",
        "theory": 480
      },
      {
        "nm": "冷凍唐揚げ 1kg",
        "loc": "F-02-01",
        "theory": 240
      }
    ],
    "move": {
      "nm": "ポテトサラダ 500g",
      "fromLoc": "R-01-01",
      "toLoc": "P-30",
      "qty": 360,
      "area": "冷蔵R"
    },
    "outbound": {
      "orderLabel": "スーパーマルエツ中央店向け（ポテトサラダ40・絹豆腐30ケース）",
      "soId": "SO-2026-0603-30",
      "picks": [
        {
          "nm": "ポテトサラダ 500g",
          "loc": "P-30",
          "qty": 40
        },
        {
          "nm": "絹豆腐 300g",
          "loc": "P-31",
          "qty": 30
        }
      ]
    }
  },

  "frozen": {
    "id": "frozen",
    "emoji": "🧊",
    "industry": "冷凍食品",
    "title": "冷凍食品物流倉庫 ─ 1日の流れ",
    "tagline": "使用期限あり／冷凍温度帯／店舗向け大口・定番大量出荷",
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "products": [
      {
        "code": "FZ-KARA",
        "name": "冷凍唐揚げ 1kg",
        "jan": "4901000100013",
        "exp": "365"
      },
      {
        "code": "FZ-GYOZA",
        "name": "冷凍餃子 50個入",
        "jan": "4901000100020",
        "exp": "540"
      },
      {
        "code": "FZ-FRIES",
        "name": "冷凍フライドポテト 2kg",
        "jan": "4901000100037",
        "exp": "450"
      }
    ],
    "inbound": [
      {
        "nm": "冷凍唐揚げ 1kg",
        "code": "FZ-KARA",
        "jan": "4901000100013",
        "lot": "F260603A",
        "exp": "2027-06-03",
        "qty": 600
      },
      {
        "nm": "冷凍餃子 50個入",
        "code": "FZ-GYOZA",
        "jan": "4901000100020",
        "lot": "F260603B",
        "exp": "2027-12-03",
        "qty": 360
      },
      {
        "nm": "冷凍フライドポテト 2kg",
        "code": "FZ-FRIES",
        "jan": "4901000100037",
        "lot": "F260603C",
        "exp": "2027-09-03",
        "qty": 480
      }
    ],
    "counts": [
      {
        "nm": "冷凍唐揚げ 1kg",
        "loc": "C-02-01",
        "theory": 600
      },
      {
        "nm": "冷凍餃子 50個入",
        "loc": "C-02-02",
        "theory": 360
      },
      {
        "nm": "冷凍フライドポテト 2kg",
        "loc": "C-02-03",
        "theory": 480
      }
    ],
    "move": {
      "nm": "冷凍唐揚げ 1kg",
      "fromLoc": "C-02-01",
      "toLoc": "P-31",
      "qty": 600,
      "area": "冷凍C"
    },
    "outbound": {
      "orderLabel": "イオン東雲店向け（唐揚げ40・餃子20ケース）",
      "soId": "SO-2026-0603-31",
      "picks": [
        {
          "nm": "冷凍唐揚げ 1kg",
          "loc": "P-31",
          "qty": 40
        },
        {
          "nm": "冷凍餃子 50個入",
          "loc": "P-32",
          "qty": 20
        }
      ]
    }
  },

  "books": {
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "multi",
      "ship": "ec",
      "turn": "fast"
    },
    "id": "books",
    "emoji": "📚",
    "industry": "書籍・出版",
    "title": "書籍・出版物流倉庫 ─ 1日の流れ",
    "tagline": "期限なし／常温／多品種・小ロット高回転・返品多めのEC＋書店BtoB 3PL",
    "products": [
      {
        "code": "BK-NOV-A",
        "name": "文庫小説 上巻",
        "jan": "4907000060019",
        "exp": ""
      },
      {
        "code": "BK-CMC-12",
        "name": "コミック 第12巻",
        "jan": "4907000060026",
        "exp": ""
      },
      {
        "code": "BK-MAG-07",
        "name": "月刊誌 7月号",
        "jan": "4907000060033",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "文庫小説 上巻",
        "code": "BK-NOV-A",
        "jan": "4907000060019",
        "lot": "BK2606A",
        "exp": "—",
        "qty": 360
      },
      {
        "nm": "コミック 第12巻",
        "code": "BK-CMC-12",
        "jan": "4907000060026",
        "lot": "BK2606B",
        "exp": "—",
        "qty": 480
      },
      {
        "nm": "月刊誌 7月号",
        "code": "BK-MAG-07",
        "jan": "4907000060033",
        "lot": "BK2606C",
        "exp": "—",
        "qty": 240
      }
    ],
    "counts": [
      {
        "nm": "文庫小説 上巻",
        "loc": "G-04-01",
        "theory": 360
      },
      {
        "nm": "コミック 第12巻",
        "loc": "G-04-02",
        "theory": 480
      },
      {
        "nm": "月刊誌 7月号",
        "loc": "G-04-03",
        "theory": 240
      }
    ],
    "move": {
      "nm": "コミック 第12巻",
      "fromLoc": "G-04-02",
      "toLoc": "P-61",
      "qty": 150,
      "area": "常温G"
    },
    "outbound": {
      "orderLabel": "全国書店チェーン本店向け（コミック40・文庫25冊）",
      "soId": "SO-2026-0603-32",
      "picks": [
        {
          "nm": "コミック 第12巻",
          "loc": "P-61",
          "qty": 40
        },
        {
          "nm": "文庫小説 上巻",
          "loc": "P-62",
          "qty": 25
        }
      ]
    }
  },

  "electronics": {
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "id": "electronics",
    "emoji": "📺",
    "industry": "家電",
    "title": "家電物流倉庫 ─ 1日の流れ",
    "tagline": "期限なし／常温／シリアル管理・大型定番・量販店BtoB＋EC",
    "products": [
      {
        "code": "EL-TV-43",
        "name": "4K液晶テレビ 43型",
        "jan": "4907000060019",
        "exp": ""
      },
      {
        "code": "EL-WSH-7K",
        "name": "全自動洗濯機 7kg",
        "jan": "4907000060026",
        "exp": ""
      },
      {
        "code": "EL-RFG-2D",
        "name": "冷蔵庫 2ドア168L",
        "jan": "4907000060033",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "4K液晶テレビ 43型",
        "code": "EL-TV-43",
        "jan": "4907000060019",
        "lot": "SN2606TV0001",
        "exp": "—",
        "qty": 120
      },
      {
        "nm": "全自動洗濯機 7kg",
        "code": "EL-WSH-7K",
        "jan": "4907000060026",
        "lot": "SN2606WS0001",
        "exp": "—",
        "qty": 80
      },
      {
        "nm": "冷蔵庫 2ドア168L",
        "code": "EL-RFG-2D",
        "jan": "4907000060033",
        "lot": "SN2606RF0001",
        "exp": "—",
        "qty": 60
      }
    ],
    "counts": [
      {
        "nm": "4K液晶テレビ 43型",
        "loc": "G-01-01",
        "theory": 120
      },
      {
        "nm": "全自動洗濯機 7kg",
        "loc": "G-01-02",
        "theory": 80
      },
      {
        "nm": "冷蔵庫 2ドア168L",
        "loc": "G-01-03",
        "theory": 60
      }
    ],
    "move": {
      "nm": "4K液晶テレビ 43型",
      "fromLoc": "G-01-01",
      "toLoc": "P-61",
      "qty": 120,
      "area": "常温G"
    },
    "outbound": {
      "orderLabel": "家電量販店 中央店向け（テレビ20・洗濯機10台）",
      "soId": "SO-2026-0603-33",
      "picks": [
        {
          "nm": "4K液晶テレビ 43型",
          "loc": "P-61",
          "qty": 20
        },
        {
          "nm": "全自動洗濯機 7kg",
          "loc": "P-62",
          "qty": 10
        }
      ]
    }
  },

  "office": {
    "id": "office",
    "emoji": "✏️",
    "industry": "文具・事務用品",
    "title": "文具事務用品センター ─ 1日の流れ",
    "tagline": "期限なし／常温／多品種定番・通販BtoB＋EC小口高回転",
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "btob",
      "turn": "fast"
    },
    "products": [
      {
        "code": "OF-CP-BK05",
        "name": "油性ボールペン 0.5mm黒",
        "jan": "4903000020011",
        "exp": ""
      },
      {
        "code": "OF-CB-A4N",
        "name": "コピー用紙 A4・500枚",
        "jan": "4903000020028",
        "exp": ""
      },
      {
        "code": "OF-FN-A4G",
        "name": "クリアファイル A4緑",
        "jan": "4903000020035",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "油性ボールペン 0.5mm黒",
        "code": "OF-CP-BK05",
        "jan": "4903000020011",
        "lot": "LT26A001",
        "exp": "—",
        "qty": 720
      },
      {
        "nm": "コピー用紙 A4・500枚",
        "code": "OF-CB-A4N",
        "jan": "4903000020028",
        "lot": "LT26A002",
        "exp": "—",
        "qty": 400
      },
      {
        "nm": "クリアファイル A4緑",
        "code": "OF-FN-A4G",
        "jan": "4903000020035",
        "lot": "LT26A003",
        "exp": "—",
        "qty": 300
      }
    ],
    "counts": [
      {
        "nm": "油性ボールペン 0.5mm黒",
        "loc": "T-03-01",
        "theory": 720
      },
      {
        "nm": "コピー用紙 A4・500枚",
        "loc": "T-03-02",
        "theory": 400
      },
      {
        "nm": "クリアファイル A4緑",
        "loc": "T-03-03",
        "theory": 300
      }
    ],
    "move": {
      "nm": "油性ボールペン 0.5mm黒",
      "fromLoc": "T-03-01",
      "toLoc": "P-21",
      "qty": 200,
      "area": "常温T"
    },
    "outbound": {
      "orderLabel": "アスクル文具部向け（ボールペン60・コピー用紙25箱）",
      "soId": "SO-2026-0603-34",
      "picks": [
        {
          "nm": "油性ボールペン 0.5mm黒",
          "loc": "P-21",
          "qty": 60
        },
        {
          "nm": "コピー用紙 A4・500枚",
          "loc": "P-22",
          "qty": 25
        }
      ]
    }
  },

  "building": {
    "id": "building",
    "emoji": "🧱",
    "industry": "建材",
    "title": "建材パレット倉庫 ─ 1日の流れ",
    "tagline": "期限なし／常温／重量・大型パレット／工務店向けBtoB大口・定番大量",
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "products": [
      {
        "code": "BD-GYPSUM",
        "name": "石膏ボード 12.5mm",
        "jan": "4902000000013",
        "exp": ""
      },
      {
        "code": "BD-PLYWOOD",
        "name": "構造用合板 12mm",
        "jan": "4902000000020",
        "exp": ""
      },
      {
        "code": "BD-INSUL",
        "name": "グラスウール断熱材 50mm",
        "jan": "4902000000037",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "石膏ボード 12.5mm",
        "code": "BD-GYPSUM",
        "jan": "4902000000013",
        "lot": "L260603G",
        "exp": "—",
        "qty": 600
      },
      {
        "nm": "構造用合板 12mm",
        "code": "BD-PLYWOOD",
        "jan": "4902000000020",
        "lot": "L260603P",
        "exp": "—",
        "qty": 400
      },
      {
        "nm": "グラスウール断熱材 50mm",
        "code": "BD-INSUL",
        "jan": "4902000000037",
        "lot": "L260603I",
        "exp": "—",
        "qty": 320
      }
    ],
    "counts": [
      {
        "nm": "石膏ボード 12.5mm",
        "loc": "C-02-01",
        "theory": 600
      },
      {
        "nm": "構造用合板 12mm",
        "loc": "C-02-02",
        "theory": 400
      },
      {
        "nm": "グラスウール断熱材 50mm",
        "loc": "C-02-03",
        "theory": 320
      }
    ],
    "move": {
      "nm": "石膏ボード 12.5mm",
      "fromLoc": "C-02-01",
      "toLoc": "P-35",
      "qty": 600,
      "area": "重量A"
    },
    "outbound": {
      "orderLabel": "山田工務店向け（石膏ボード40・合板20束）",
      "soId": "SO-2026-0603-35",
      "picks": [
        {
          "nm": "石膏ボード 12.5mm",
          "loc": "P-35",
          "qty": 40
        },
        {
          "nm": "構造用合板 12mm",
          "loc": "C-02-02",
          "qty": 20
        }
      ]
    }
  },

  "auto-parts": {
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "btob",
      "turn": "fast"
    },
    "id": "auto-parts",
    "emoji": "🚗",
    "industry": "自動車部品",
    "title": "自動車部品JIT倉庫 ─ 1日の流れ",
    "tagline": "期限なし／常温／品番・シリアル管理の多品種をJITでライン直納するBtoB高回転",
    "products": [
      {
        "code": "AP-BRAKEPAD",
        "name": "ブレーキパッド フロント用",
        "jan": "4902000000018",
        "exp": ""
      },
      {
        "code": "AP-OILFILTER",
        "name": "オイルフィルター 標準型",
        "jan": "4902000000025",
        "exp": ""
      },
      {
        "code": "AP-SPARKPLUG",
        "name": "スパークプラグ イリジウム",
        "jan": "4902000000032",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "ブレーキパッド フロント用",
        "code": "AP-BRAKEPAD",
        "jan": "4902000000018",
        "lot": "LT260603FP",
        "exp": "—",
        "qty": 600
      },
      {
        "nm": "オイルフィルター 標準型",
        "code": "AP-OILFILTER",
        "jan": "4902000000025",
        "lot": "LT260603OF",
        "exp": "—",
        "qty": 900
      },
      {
        "nm": "スパークプラグ イリジウム",
        "code": "AP-SPARKPLUG",
        "jan": "4902000000032",
        "lot": "LT260603SP",
        "exp": "—",
        "qty": 1200
      }
    ],
    "counts": [
      {
        "nm": "ブレーキパッド フロント用",
        "loc": "C-02-01",
        "theory": 600
      },
      {
        "nm": "オイルフィルター 標準型",
        "loc": "C-02-02",
        "theory": 900
      },
      {
        "nm": "スパークプラグ イリジウム",
        "loc": "C-02-03",
        "theory": 1200
      }
    ],
    "move": {
      "nm": "ブレーキパッド フロント用",
      "fromLoc": "C-02-01",
      "toLoc": "P-36",
      "qty": 600,
      "area": "常温C"
    },
    "outbound": {
      "orderLabel": "自動車組立第2ライン向け（ブレーキパッド80・スパークプラグ120）",
      "soId": "SO-2026-0603-36",
      "picks": [
        {
          "nm": "ブレーキパッド フロント用",
          "loc": "P-36",
          "qty": 80
        },
        {
          "nm": "スパークプラグ イリジウム",
          "loc": "C-02-03",
          "qty": 120
        }
      ]
    }
  },

  "pet": {
    "answers": {
      "shelf": "yes",
      "temp": "normal",
      "owner": "multi",
      "ship": "ec",
      "turn": "fast"
    },
    "counts": [
      {
        "nm": "総合栄養食ドッグフード 2kg",
        "loc": "C-02-01",
        "theory": 240
      },
      {
        "nm": "猫缶まぐろ 70g×24",
        "loc": "C-02-02",
        "theory": 180
      },
      {
        "nm": "システムトイレ用猫砂 5L",
        "loc": "C-02-03",
        "theory": 120
      }
    ],
    "emoji": "🐶",
    "id": "pet",
    "inbound": [
      {
        "nm": "総合栄養食ドッグフード 2kg",
        "code": "PT-DOGDRY",
        "jan": "4901111000018",
        "lot": "L260603P1",
        "exp": "2027-11-30",
        "qty": 240
      },
      {
        "nm": "猫缶まぐろ 70g×24",
        "code": "PT-CATWET",
        "jan": "4901111000025",
        "lot": "L260603P2",
        "exp": "2029-06-03",
        "qty": 180
      },
      {
        "nm": "システムトイレ用猫砂 5L",
        "code": "PT-LITTER",
        "jan": "4901111000032",
        "lot": "L260603P3",
        "exp": "2031-06-03",
        "qty": 120
      }
    ],
    "industry": "ペット用品・ペットフード",
    "move": {
      "nm": "総合栄養食ドッグフード 2kg",
      "fromLoc": "C-02-01",
      "toLoc": "P-37",
      "qty": 240,
      "area": "常温C"
    },
    "outbound": {
      "orderLabel": "楽天ペットEC受注 田中様向け（ドッグフード2・猫缶1）",
      "soId": "SO-2026-0603-37",
      "picks": [
        {
          "nm": "総合栄養食ドッグフード 2kg",
          "loc": "P-37",
          "qty": 2
        },
        {
          "nm": "猫缶まぐろ 70g×24",
          "loc": "C-02-02",
          "qty": 1
        }
      ]
    },
    "products": [
      {
        "code": "PT-DOGDRY",
        "name": "総合栄養食ドッグフード 2kg",
        "jan": "4901111000018",
        "exp": "540"
      },
      {
        "code": "PT-CATWET",
        "name": "猫缶まぐろ 70g×24",
        "jan": "4901111000025",
        "exp": "1095"
      },
      {
        "code": "PT-LITTER",
        "name": "システムトイレ用猫砂 5L",
        "jan": "4901111000032",
        "exp": "1825"
      }
    ],
    "tagline": "賞味期限あり／常温／複数荷主3PL・EC個口＋量販店の多品種高回転",
    "title": "ペット用品EC物流倉庫 ─ 1日の流れ"
  },

  "supplement": {
    "id": "supplement",
    "emoji": "💪",
    "industry": "健康食品・サプリ",
    "title": "サプリ通販フルフィルメント倉庫 ─ 1日の流れ",
    "tagline": "賞味期限あり／常温／EC定期通販・個口・多品種高回転 3PL",
    "answers": {
      "shelf": "yes",
      "temp": "normal",
      "owner": "multi",
      "ship": "ec",
      "turn": "fast"
    },
    "products": [
      {
        "code": "SP-PRO-1KG",
        "name": "ホエイプロテイン 1kgバニラ",
        "jan": "4907000060019",
        "exp": "540"
      },
      {
        "code": "SP-MVT-90",
        "name": "マルチビタミン 90粒",
        "jan": "4907000060026",
        "exp": "730"
      },
      {
        "code": "SP-EAA-300",
        "name": "EAAパウダー 300g",
        "jan": "4907000060033",
        "exp": "365"
      }
    ],
    "inbound": [
      {
        "nm": "ホエイプロテイン 1kgバニラ",
        "code": "SP-PRO-1KG",
        "jan": "4907000060019",
        "lot": "SP2606A",
        "exp": "2027-12-03",
        "qty": 360
      },
      {
        "nm": "マルチビタミン 90粒",
        "code": "SP-MVT-90",
        "jan": "4907000060026",
        "lot": "SP2606B",
        "exp": "2028-06-03",
        "qty": 480
      },
      {
        "nm": "EAAパウダー 300g",
        "code": "SP-EAA-300",
        "jan": "4907000060033",
        "lot": "SP2606C",
        "exp": "2027-06-03",
        "qty": 600
      }
    ],
    "counts": [
      {
        "nm": "ホエイプロテイン 1kgバニラ",
        "loc": "T-04-01",
        "theory": 360
      },
      {
        "nm": "マルチビタミン 90粒",
        "loc": "T-04-02",
        "theory": 480
      },
      {
        "nm": "EAAパウダー 300g",
        "loc": "T-04-03",
        "theory": 600
      }
    ],
    "move": {
      "nm": "EAAパウダー 300g",
      "fromLoc": "T-04-03",
      "toLoc": "P-61",
      "qty": 150,
      "area": "常温T"
    },
    "outbound": {
      "orderLabel": "EC定期便（個人向け・プロテイン1・EAA2を個口出荷）",
      "soId": "SO-2026-0603-38",
      "picks": [
        {
          "nm": "ホエイプロテイン 1kgバニラ",
          "loc": "P-61",
          "qty": 24
        },
        {
          "nm": "EAAパウダー 300g",
          "loc": "P-62",
          "qty": 40
        }
      ]
    }
  },

  "liquor": {
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "counts": [
      {
        "nm": "純米吟醸 720ml×6",
        "loc": "C-01-01",
        "theory": 360
      },
      {
        "nm": "本格麦焼酎 1.8L×6",
        "loc": "C-01-02",
        "theory": 240
      },
      {
        "nm": "生ビール 500ml×24",
        "loc": "R-02-01",
        "theory": 384
      }
    ],
    "emoji": "🍶",
    "id": "liquor",
    "inbound": [
      {
        "nm": "純米吟醸 720ml×6",
        "code": "SK-JUNMAI",
        "jan": "4905000000018",
        "lot": "SK260603A",
        "exp": "2027-06-03",
        "qty": 360
      },
      {
        "nm": "本格麦焼酎 1.8L×6",
        "code": "SK-MUGI",
        "jan": "4905000000025",
        "lot": "SK260603B",
        "exp": "2028-06-03",
        "qty": 240
      },
      {
        "nm": "生ビール 500ml×24",
        "code": "SK-NAMA",
        "jan": "4905000000032",
        "lot": "SK260603C",
        "exp": "2026-12-03",
        "qty": 384
      }
    ],
    "industry": "酒類",
    "move": {
      "nm": "生ビール 500ml×24",
      "fromLoc": "R-02-01",
      "toLoc": "R-09",
      "qty": 384,
      "area": "冷蔵R"
    },
    "outbound": {
      "orderLabel": "やまや郊外店向け（純米吟醸30・生ビール15ケース）",
      "soId": "SO-2026-0603-39",
      "picks": [
        {
          "nm": "純米吟醸 720ml×6",
          "loc": "C-01-01",
          "qty": 30
        },
        {
          "nm": "生ビール 500ml×24",
          "loc": "R-09",
          "qty": 15
        }
      ]
    },
    "products": [
      {
        "code": "SK-JUNMAI",
        "name": "純米吟醸 720ml×6",
        "jan": "4905000000018",
        "exp": "365"
      },
      {
        "code": "SK-MUGI",
        "name": "本格麦焼酎 1.8L×6",
        "jan": "4905000000025",
        "exp": "730"
      },
      {
        "code": "SK-NAMA",
        "name": "生ビール 500ml×24",
        "jan": "4905000000032",
        "exp": "180"
      }
    ],
    "tagline": "賞味期限・酒税ロット管理／常温＋生ビールは冷蔵／酒販店向け大口ケース定番",
    "title": "酒類保管倉庫 ─ 1日の流れ"
  },

  "ice": {
    "id": "ice",
    "emoji": "🍦",
    "industry": "アイス・冷菓",
    "title": "冷凍アイス物流倉庫 ─ 1日の流れ",
    "tagline": "賞味期限あり／冷凍厳格(-18℃)／店舗向け大口・定番大量パレット",
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "products": [
      {
        "code": "IC-VANILLA",
        "name": "バニラカップ 120ml×24",
        "jan": "4907000060019",
        "exp": "540"
      },
      {
        "code": "IC-MONAKA",
        "name": "モナカアイス 150ml×20",
        "jan": "4907000060026",
        "exp": "450"
      },
      {
        "code": "IC-SODABAR",
        "name": "ソーダバー 65ml×30",
        "jan": "4907000060033",
        "exp": "365"
      }
    ],
    "inbound": [
      {
        "nm": "バニラカップ 120ml×24",
        "code": "IC-VANILLA",
        "jan": "4907000060019",
        "lot": "IC2606A",
        "exp": "2027-12-03",
        "qty": 600
      },
      {
        "nm": "モナカアイス 150ml×20",
        "code": "IC-MONAKA",
        "jan": "4907000060026",
        "lot": "IC2606B",
        "exp": "2027-09-03",
        "qty": 420
      },
      {
        "nm": "ソーダバー 65ml×30",
        "code": "IC-SODABAR",
        "jan": "4907000060033",
        "lot": "IC2606C",
        "exp": "2027-06-03",
        "qty": 720
      }
    ],
    "counts": [
      {
        "nm": "バニラカップ 120ml×24",
        "loc": "F-CLD-01",
        "theory": 600
      },
      {
        "nm": "モナカアイス 150ml×20",
        "loc": "F-CLD-02",
        "theory": 420
      },
      {
        "nm": "ソーダバー 65ml×30",
        "loc": "F-CLD-03",
        "theory": 720
      }
    ],
    "move": {
      "nm": "バニラカップ 120ml×24",
      "fromLoc": "F-CLD-01",
      "toLoc": "P-40",
      "qty": 600,
      "area": "冷凍F"
    },
    "outbound": {
      "orderLabel": "スーパーマルエー10店舗向け（バニラ40・ソーダバー60ケース）",
      "soId": "SO-2026-0603-40",
      "picks": [
        {
          "nm": "バニラカップ 120ml×24",
          "loc": "P-40",
          "qty": 40
        },
        {
          "nm": "ソーダバー 65ml×30",
          "loc": "P-41",
          "qty": 60
        }
      ]
    }
  },

  "luxury": {
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "ec",
      "turn": "fast"
    },
    "counts": [
      {
        "nm": "レザートートバッグ ブラック",
        "loc": "G-01-01",
        "theory": 80
      },
      {
        "nm": "腕時計 メンズ自動巻",
        "loc": "G-01-02",
        "theory": 40
      },
      {
        "nm": "シルクスカーフ 90cm",
        "loc": "G-01-03",
        "theory": 120
      }
    ],
    "emoji": "👜",
    "id": "luxury",
    "inbound": [
      {
        "nm": "レザートートバッグ ブラック",
        "code": "LX-BAG-BK",
        "jan": "4907000060019",
        "lot": "SN2606A",
        "exp": "—",
        "qty": 80
      },
      {
        "nm": "腕時計 メンズ自動巻",
        "code": "LX-WCH-MN",
        "jan": "4907000060026",
        "lot": "SN2606B",
        "exp": "—",
        "qty": 40
      },
      {
        "nm": "シルクスカーフ 90cm",
        "code": "LX-SCF-90",
        "jan": "4907000060033",
        "lot": "SN2606C",
        "exp": "—",
        "qty": 120
      }
    ],
    "industry": "高級ブランド品",
    "move": {
      "nm": "レザートートバッグ ブラック",
      "fromLoc": "G-01-01",
      "toLoc": "P-61",
      "qty": 20,
      "area": "常温G"
    },
    "outbound": {
      "orderLabel": "EC・直営ブティック向け（トート3・スカーフ5点／個品シリアル照合）",
      "soId": "SO-2026-0603-41",
      "picks": [
        {
          "nm": "レザートートバッグ ブラック",
          "loc": "P-61",
          "qty": 3
        },
        {
          "nm": "シルクスカーフ 90cm",
          "loc": "P-62",
          "qty": 5
        }
      ]
    },
    "products": [
      {
        "code": "LX-BAG-BK",
        "name": "レザートートバッグ ブラック",
        "jan": "4907000060019",
        "exp": ""
      },
      {
        "code": "LX-WCH-MN",
        "name": "腕時計 メンズ自動巻",
        "jan": "4907000060026",
        "exp": ""
      },
      {
        "code": "LX-SCF-90",
        "name": "シルクスカーフ 90cm",
        "jan": "4907000060033",
        "exp": ""
      }
    ],
    "tagline": "期限なし／常温／個品シリアル・厳格検品・少量多品種、EC＋直営ブティック高回転",
    "title": "高級ブランド品物流倉庫 ─ 1日の流れ"
  },

  "medical-device": {
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "multi",
      "ship": "btob",
      "turn": "fast"
    },
    "counts": [
      {
        "nm": "縫合糸 3-0×36本",
        "loc": "B-03-01",
        "theory": 360
      },
      {
        "nm": "採血スピッツ 5mL×100本",
        "loc": "B-03-02",
        "theory": 480
      },
      {
        "nm": "インスリン製剤 10mL×10瓶",
        "loc": "R-01-01",
        "theory": 200
      }
    ],
    "emoji": "🩺",
    "id": "medical-device",
    "inbound": [
      {
        "nm": "縫合糸 3-0×36本",
        "code": "MD-SUTURE",
        "jan": "4905000000013",
        "lot": "LMD2606A",
        "exp": "2029-06-03",
        "qty": 360
      },
      {
        "nm": "採血スピッツ 5mL×100本",
        "code": "MD-SPITZ",
        "jan": "4905000000020",
        "lot": "LMD2606B",
        "exp": "2028-12-03",
        "qty": 480
      },
      {
        "nm": "インスリン製剤 10mL×10瓶",
        "code": "MD-INSULIN",
        "jan": "4905000000037",
        "lot": "LMD2606C",
        "exp": "2027-06-03",
        "qty": 200
      }
    ],
    "industry": "医療機器・材料",
    "move": {
      "nm": "インスリン製剤 10mL×10瓶",
      "fromLoc": "R-01-01",
      "toLoc": "R-02-01",
      "qty": 200,
      "area": "冷蔵R"
    },
    "outbound": {
      "orderLabel": "中央総合病院向け（縫合糸40・採血スピッツ30箱）",
      "soId": "SO-2026-0603-42",
      "picks": [
        {
          "nm": "縫合糸 3-0×36本",
          "loc": "B-03-01",
          "qty": 40
        },
        {
          "nm": "採血スピッツ 5mL×100本",
          "loc": "B-03-02",
          "qty": 30
        }
      ]
    },
    "products": [
      {
        "code": "MD-SUTURE",
        "name": "縫合糸 3-0×36本",
        "jan": "4905000000013",
        "exp": "1095"
      },
      {
        "code": "MD-SPITZ",
        "name": "採血スピッツ 5mL×100本",
        "jan": "4905000000020",
        "exp": "910"
      },
      {
        "code": "MD-INSULIN",
        "name": "インスリン製剤 10mL×10瓶",
        "jan": "4905000000037",
        "exp": "365"
      }
    ],
    "tagline": "ロット/使用期限トレサビ必須／一部冷蔵／3PL複数荷主／病院・卸向けBtoB多品種高回転",
    "title": "医療材料3PL倉庫 ─ 1日の流れ"
  },

  "chemical": {
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "counts": [
      {
        "nm": "アクリル塗料 16kg缶",
        "loc": "C-02-01",
        "theory": 120
      },
      {
        "nm": "有機溶剤シンナー 18L缶",
        "loc": "C-02-02",
        "theory": 96
      },
      {
        "nm": "エポキシ硬化剤 4kg缶",
        "loc": "C-03-01",
        "theory": 200
      }
    ],
    "emoji": "🧪",
    "id": "chemical",
    "inbound": [
      {
        "nm": "アクリル塗料 16kg缶",
        "code": "CH-ACRYL",
        "jan": "4902000000018",
        "lot": "CL260603A",
        "exp": "2028-06-03",
        "qty": 120
      },
      {
        "nm": "有機溶剤シンナー 18L缶",
        "code": "CH-THIN",
        "jan": "4902000000025",
        "lot": "CL260603B",
        "exp": "2029-06-03",
        "qty": 96
      },
      {
        "nm": "エポキシ硬化剤 4kg缶",
        "code": "CH-EPOXY",
        "jan": "4902000000032",
        "lot": "CL260603C",
        "exp": "2027-12-03",
        "qty": 200
      }
    ],
    "industry": "化学品・塗料",
    "move": {
      "nm": "アクリル塗料 16kg缶",
      "fromLoc": "C-02-01",
      "toLoc": "P-43",
      "qty": 120,
      "area": "危険物倉庫"
    },
    "outbound": {
      "orderLabel": "中部塗装工業 名古屋工場向け（アクリル塗料30・シンナー20缶）",
      "soId": "SO-2026-0603-43",
      "picks": [
        {
          "nm": "アクリル塗料 16kg缶",
          "loc": "P-43",
          "qty": 30
        },
        {
          "nm": "有機溶剤シンナー 18L缶",
          "loc": "C-02-02",
          "qty": 20
        }
      ]
    },
    "products": [
      {
        "code": "CH-ACRYL",
        "name": "アクリル塗料 16kg缶",
        "jan": "4902000000018",
        "exp": "730"
      },
      {
        "code": "CH-THIN",
        "name": "有機溶剤シンナー 18L缶",
        "jan": "4902000000025",
        "exp": "1095"
      },
      {
        "code": "CH-EPOXY",
        "name": "エポキシ硬化剤 4kg缶",
        "jan": "4902000000032",
        "exp": "548"
      }
    ],
    "tagline": "危険物／ロット・温度管理あり／工場向けBtoB大口・定番の一斗缶／ペール缶",
    "title": "化学品危険物倉庫 ─ 1日の流れ"
  },

  "semiconductor": {
    "id": "semiconductor",
    "emoji": "🔌",
    "industry": "電子部品・半導体",
    "title": "電子部品恒湿倉庫 ─ 1日の流れ",
    "tagline": "防湿・ロット/シリアル管理／常温恒湿／3PL複数荷主・少量多品種のBtoB高回転",
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "multi",
      "ship": "btob",
      "turn": "fast"
    },
    "products": [
      {
        "code": "EP-MCU32",
        "name": "マイコン STM32F103",
        "jan": "4902000000013",
        "exp": ""
      },
      {
        "code": "EP-CAP10",
        "name": "積層セラコン 10uF",
        "jan": "4902000000020",
        "exp": ""
      },
      {
        "code": "EP-CONN20",
        "name": "基板コネクタ 20P",
        "jan": "4902000000037",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "マイコン STM32F103",
        "code": "EP-MCU32",
        "jan": "4902000000013",
        "lot": "LT2606A03",
        "exp": "—",
        "qty": 2000
      },
      {
        "nm": "積層セラコン 10uF",
        "code": "EP-CAP10",
        "jan": "4902000000020",
        "lot": "LT2606B03",
        "exp": "—",
        "qty": 5000
      },
      {
        "nm": "基板コネクタ 20P",
        "code": "EP-CONN20",
        "jan": "4902000000037",
        "lot": "LT2606C03",
        "exp": "—",
        "qty": 1200
      }
    ],
    "counts": [
      {
        "nm": "マイコン STM32F103",
        "loc": "C-02-01",
        "theory": 2000
      },
      {
        "nm": "積層セラコン 10uF",
        "loc": "C-02-02",
        "theory": 5000
      },
      {
        "nm": "基板コネクタ 20P",
        "loc": "C-02-03",
        "theory": 1200
      }
    ],
    "move": {
      "nm": "マイコン STM32F103",
      "fromLoc": "C-02-01",
      "toLoc": "P-44",
      "qty": 2000,
      "area": "恒湿C"
    },
    "outbound": {
      "orderLabel": "東光電子工業向け（マイコン200・コネクタ80個）",
      "soId": "SO-2026-0603-44",
      "picks": [
        {
          "nm": "マイコン STM32F103",
          "loc": "P-44",
          "qty": 200
        },
        {
          "nm": "基板コネクタ 20P",
          "loc": "C-02-03",
          "qty": 80
        }
      ]
    }
  },

  "furniture": {
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "ec",
      "turn": "bulk"
    },
    "counts": [
      {
        "nm": "3人掛けソファ グレー",
        "loc": "C-02-01",
        "theory": 48
      },
      {
        "nm": "ダイニングテーブル 幅140",
        "loc": "C-02-02",
        "theory": 36
      },
      {
        "nm": "木製チェスト 5段",
        "loc": "C-02-03",
        "theory": 60
      }
    ],
    "emoji": "🛋️",
    "id": "furniture",
    "inbound": [
      {
        "nm": "3人掛けソファ グレー",
        "code": "FN-SOFA3",
        "jan": "4902000000011",
        "lot": "FN260603A",
        "exp": "—",
        "qty": 48
      },
      {
        "nm": "ダイニングテーブル 幅140",
        "code": "FN-TABLE140",
        "jan": "4902000000028",
        "lot": "FN260603B",
        "exp": "—",
        "qty": 36
      },
      {
        "nm": "木製チェスト 5段",
        "code": "FN-CHEST5",
        "jan": "4902000000035",
        "lot": "FN260603C",
        "exp": "—",
        "qty": 60
      }
    ],
    "industry": "家具・インテリア",
    "move": {
      "nm": "3人掛けソファ グレー",
      "fromLoc": "C-02-01",
      "toLoc": "P-45",
      "qty": 48,
      "area": "大型常温C"
    },
    "outbound": {
      "orderLabel": "インテリア通販ベルメ様向け（ソファ4・チェスト6点）",
      "soId": "SO-2026-0603-45",
      "picks": [
        {
          "nm": "3人掛けソファ グレー",
          "loc": "P-45",
          "qty": 4
        },
        {
          "nm": "木製チェスト 5段",
          "loc": "C-02-03",
          "qty": 6
        }
      ]
    },
    "products": [
      {
        "code": "FN-SOFA3",
        "name": "3人掛けソファ グレー",
        "jan": "4902000000011",
        "exp": ""
      },
      {
        "code": "FN-TABLE140",
        "name": "ダイニングテーブル 幅140",
        "jan": "4902000000028",
        "exp": ""
      },
      {
        "code": "FN-CHEST5",
        "name": "木製チェスト 5段",
        "jan": "4902000000035",
        "exp": ""
      }
    ],
    "tagline": "期限なし／常温／大型家具をEC＋店舗へ／定番・少品種パレット保管",
    "title": "大型家具・インテリア倉庫 ─ 1日の流れ"
  },

  "food-ingredient": {
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "id": "food-ingredient",
    "emoji": "🍱",
    "industry": "業務用食材",
    "title": "業務用食材 冷蔵冷凍倉庫 ─ 1日の流れ",
    "tagline": "賞味期限あり／冷蔵・冷凍／飲食チェーン向け大ロットBtoB定番",
    "products": [
      {
        "code": "FD-KARA",
        "name": "冷凍唐揚げ 1kg",
        "jan": "4902000000011",
        "exp": "365"
      },
      {
        "code": "FD-PORK",
        "name": "豚バラスライス 2kg",
        "jan": "4902000000028",
        "exp": "180"
      },
      {
        "code": "FD-LETT",
        "name": "カットレタス 1kg",
        "jan": "4902000000035",
        "exp": "7"
      }
    ],
    "inbound": [
      {
        "nm": "冷凍唐揚げ 1kg",
        "code": "FD-KARA",
        "jan": "4902000000011",
        "lot": "L260603K",
        "exp": "2027-06-03",
        "qty": 600
      },
      {
        "nm": "豚バラスライス 2kg",
        "code": "FD-PORK",
        "jan": "4902000000028",
        "lot": "L260603P",
        "exp": "2026-12-03",
        "qty": 360
      },
      {
        "nm": "カットレタス 1kg",
        "code": "FD-LETT",
        "jan": "4902000000035",
        "lot": "L260603L",
        "exp": "2026-06-10",
        "qty": 240
      }
    ],
    "counts": [
      {
        "nm": "冷凍唐揚げ 1kg",
        "loc": "F-01-01",
        "theory": 600
      },
      {
        "nm": "豚バラスライス 2kg",
        "loc": "F-01-02",
        "theory": 360
      },
      {
        "nm": "カットレタス 1kg",
        "loc": "C-02-01",
        "theory": 240
      }
    ],
    "move": {
      "nm": "冷凍唐揚げ 1kg",
      "fromLoc": "F-01-01",
      "toLoc": "P-46",
      "qty": 600,
      "area": "冷凍F"
    },
    "outbound": {
      "orderLabel": "がってん食堂チェーン 中央セントラルキッチン向け（冷凍唐揚げ40・豚バラスライス20ケース）",
      "soId": "SO-2026-0603-46",
      "picks": [
        {
          "nm": "冷凍唐揚げ 1kg",
          "loc": "P-46",
          "qty": 40
        },
        {
          "nm": "豚バラスライス 2kg",
          "loc": "C-02-02",
          "qty": 20
        }
      ]
    }
  },

  "produce": {
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "multi",
      "ship": "btob",
      "turn": "fast"
    },
    "counts": [
      {
        "nm": "レタス Lサイズ",
        "loc": "R-01-01",
        "theory": 360
      },
      {
        "nm": "トマト 4kg箱",
        "loc": "R-01-02",
        "theory": 240
      },
      {
        "nm": "きゅうり 5kg箱",
        "loc": "R-01-03",
        "theory": 300
      }
    ],
    "emoji": "🥬",
    "id": "produce",
    "inbound": [
      {
        "nm": "レタス Lサイズ",
        "code": "PR-CABG-L",
        "jan": "4907000060011",
        "lot": "NAGANO0608A",
        "exp": "2026-06-15",
        "qty": 360
      },
      {
        "nm": "トマト 4kg箱",
        "code": "PR-TOM-4K",
        "jan": "4907000060028",
        "lot": "KUMAMOTO0608B",
        "exp": "2026-06-18",
        "qty": 240
      },
      {
        "nm": "きゅうり 5kg箱",
        "code": "PR-CUC-5K",
        "jan": "4907000060035",
        "lot": "MIYAZAKI0608C",
        "exp": "2026-06-13",
        "qty": 300
      }
    ],
    "industry": "農産物・青果",
    "move": {
      "nm": "レタス Lサイズ",
      "fromLoc": "R-01-01",
      "toLoc": "P-47",
      "qty": 120,
      "area": "冷蔵R"
    },
    "outbound": {
      "orderLabel": "量販店向け（イオン青果センター・レタス40・トマト24箱）",
      "soId": "SO-2026-0603-47",
      "picks": [
        {
          "nm": "レタス Lサイズ",
          "loc": "P-47",
          "qty": 40
        },
        {
          "nm": "トマト 4kg箱",
          "loc": "P-48",
          "qty": 24
        }
      ]
    },
    "products": [
      {
        "code": "PR-CABG-L",
        "name": "レタス Lサイズ",
        "jan": "4907000060011",
        "exp": "7"
      },
      {
        "code": "PR-TOM-4K",
        "name": "トマト 4kg箱",
        "jan": "4907000060028",
        "exp": "10"
      },
      {
        "code": "PR-CUC-5K",
        "name": "きゅうり 5kg箱",
        "jan": "4907000060035",
        "exp": "5"
      }
    ],
    "tagline": "使用期限短い／冷蔵／産地ロット・量販店向け大口・多品種高回転",
    "title": "青果センター倉庫 ─ 1日の流れ"
  },

  "seafood": {
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "multi",
      "ship": "btob",
      "turn": "bulk"
    },
    "counts": [
      {
        "nm": "冷凍銀鮭フィレ 1kg",
        "loc": "C-01-01",
        "theory": 600
      },
      {
        "nm": "冷凍真サバ切身 5kg",
        "loc": "C-01-02",
        "theory": 320
      },
      {
        "nm": "冷凍むきえび 2kg",
        "loc": "C-01-03",
        "theory": 480
      }
    ],
    "emoji": "🐟",
    "id": "seafood",
    "inbound": [
      {
        "nm": "冷凍銀鮭フィレ 1kg",
        "code": "SF-SALMON",
        "jan": "4912000000013",
        "lot": "CL260603A",
        "exp": "2027-06-03",
        "qty": 600
      },
      {
        "nm": "冷凍真サバ切身 5kg",
        "code": "SF-SABA",
        "jan": "4912000000020",
        "lot": "CL260603B",
        "exp": "2027-03-03",
        "qty": 320
      },
      {
        "nm": "冷凍むきえび 2kg",
        "code": "SF-EBI",
        "jan": "4912000000037",
        "lot": "CL260603C",
        "exp": "2027-12-03",
        "qty": 480
      }
    ],
    "industry": "水産物",
    "move": {
      "nm": "冷凍銀鮭フィレ 1kg",
      "fromLoc": "C-01-01",
      "toLoc": "P-48",
      "qty": 600,
      "area": "冷凍C"
    },
    "outbound": {
      "orderLabel": "イオン東日本DC向け（銀鮭フィレ80・むきえび40ケース）",
      "soId": "SO-2026-0603-48",
      "picks": [
        {
          "nm": "冷凍銀鮭フィレ 1kg",
          "loc": "P-48",
          "qty": 80
        },
        {
          "nm": "冷凍むきえび 2kg",
          "loc": "C-01-03",
          "qty": 40
        }
      ]
    },
    "products": [
      {
        "code": "SF-SALMON",
        "name": "冷凍銀鮭フィレ 1kg",
        "jan": "4912000000013",
        "exp": "365"
      },
      {
        "code": "SF-SABA",
        "name": "冷凍真サバ切身 5kg",
        "jan": "4912000000020",
        "exp": "270"
      },
      {
        "code": "SF-EBI",
        "name": "冷凍むきえび 2kg",
        "jan": "4912000000037",
        "exp": "540"
      }
    ],
    "tagline": "冷凍中心／産地ロット・賞味期限管理／複数荷主3PL・店舗大口出荷",
    "title": "冷凍水産物 産地直送倉庫 ─ 1日の流れ"
  },

  "dairy": {
    "id": "dairy",
    "emoji": "🥛",
    "industry": "乳製品",
    "title": "日配チルド倉庫 ─ 1日の流れ",
    "tagline": "賞味期限短／冷蔵5℃／スーパー店舗向け日配・多品種高回転",
    "answers": {
      "shelf": "yes",
      "temp": "cold",
      "owner": "single",
      "ship": "btob",
      "turn": "fast"
    },
    "products": [
      {
        "code": "DY-MILK",
        "name": "成分無調整牛乳 1L",
        "jan": "4912000000011",
        "exp": "14"
      },
      {
        "code": "DY-YOGURT",
        "name": "プレーンヨーグルト 400g",
        "jan": "4912000000028",
        "exp": "18"
      },
      {
        "code": "DY-BUTTER",
        "name": "無塩バター 200g",
        "jan": "4912000000035",
        "exp": "90"
      }
    ],
    "inbound": [
      {
        "nm": "成分無調整牛乳 1L",
        "code": "DY-MILK",
        "jan": "4912000000011",
        "lot": "M260608A",
        "exp": "2026-06-22",
        "qty": 600
      },
      {
        "nm": "プレーンヨーグルト 400g",
        "code": "DY-YOGURT",
        "jan": "4912000000028",
        "lot": "Y260608B",
        "exp": "2026-06-26",
        "qty": 480
      },
      {
        "nm": "無塩バター 200g",
        "code": "DY-BUTTER",
        "jan": "4912000000035",
        "lot": "B260608C",
        "exp": "2026-09-06",
        "qty": 300
      }
    ],
    "counts": [
      {
        "nm": "成分無調整牛乳 1L",
        "loc": "C-02-01",
        "theory": 600
      },
      {
        "nm": "プレーンヨーグルト 400g",
        "loc": "C-02-02",
        "theory": 480
      },
      {
        "nm": "無塩バター 200g",
        "loc": "C-02-03",
        "theory": 300
      }
    ],
    "move": {
      "nm": "成分無調整牛乳 1L",
      "fromLoc": "C-02-01",
      "toLoc": "P-49",
      "qty": 600,
      "area": "冷蔵C"
    },
    "outbound": {
      "orderLabel": "イオン東雲店向け（牛乳120・ヨーグルト60個）",
      "soId": "SO-2026-0603-49",
      "picks": [
        {
          "nm": "成分無調整牛乳 1L",
          "loc": "P-49",
          "qty": 120
        },
        {
          "nm": "プレーンヨーグルト 400g",
          "loc": "C-02-02",
          "qty": 60
        }
      ]
    }
  },

  "toy": {
    "id": "toy",
    "emoji": "🧸",
    "industry": "玩具・ホビー",
    "title": "玩具・ホビー物流倉庫 ─ 1日の流れ",
    "tagline": "期限なし／常温／季節変動・多品種高回転・EC＋量販店 3PL",
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "multi",
      "ship": "ec",
      "turn": "fast"
    },
    "products": [
      {
        "code": "TY-BLK-1000",
        "name": "ブロック基本セット 1000ピース",
        "jan": "4907000060019",
        "exp": ""
      },
      {
        "code": "TY-PLM-HG",
        "name": "プラモデル 1/144スケール",
        "jan": "4907000060026",
        "exp": ""
      },
      {
        "code": "TY-PLH-30",
        "name": "ぬいぐるみ クマ30cm",
        "jan": "4907000060033",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "ブロック基本セット 1000ピース",
        "code": "TY-BLK-1000",
        "jan": "4907000060019",
        "lot": "TY2606A",
        "exp": "—",
        "qty": 480
      },
      {
        "nm": "プラモデル 1/144スケール",
        "code": "TY-PLM-HG",
        "jan": "4907000060026",
        "lot": "TY2606B",
        "exp": "—",
        "qty": 360
      },
      {
        "nm": "ぬいぐるみ クマ30cm",
        "code": "TY-PLH-30",
        "jan": "4907000060033",
        "lot": "TY2606C",
        "exp": "—",
        "qty": 240
      }
    ],
    "counts": [
      {
        "nm": "ブロック基本セット 1000ピース",
        "loc": "G-01-01",
        "theory": 480
      },
      {
        "nm": "プラモデル 1/144スケール",
        "loc": "G-01-02",
        "theory": 360
      },
      {
        "nm": "ぬいぐるみ クマ30cm",
        "loc": "G-01-03",
        "theory": 240
      }
    ],
    "move": {
      "nm": "ブロック基本セット 1000ピース",
      "fromLoc": "G-01-01",
      "toLoc": "P-61",
      "qty": 120,
      "area": "常温G"
    },
    "outbound": {
      "orderLabel": "トイザらス向け＋EC個人向け（ブロック24・プラモデル18点）",
      "soId": "SO-2026-0603-50",
      "picks": [
        {
          "nm": "ブロック基本セット 1000ピース",
          "loc": "P-61",
          "qty": 24
        },
        {
          "nm": "プラモデル 1/144スケール",
          "loc": "P-62",
          "qty": 18
        }
      ]
    }
  },

  "sporting": {
    "id": "sporting",
    "emoji": "⚽",
    "industry": "スポーツ用品",
    "title": "スポーツ用品物流倉庫 ─ 1日の流れ",
    "tagline": "期限なし／常温／多品種・季節変動・EC＋店舗の高回転",
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "single",
      "ship": "ec",
      "turn": "fast"
    },
    "products": [
      {
        "code": "SP-BALL-5",
        "name": "サッカーボール 5号",
        "jan": "4907000060019",
        "exp": ""
      },
      {
        "code": "SP-SHOE-26",
        "name": "ランニングシューズ 26cm",
        "jan": "4907000060026",
        "exp": ""
      },
      {
        "code": "SP-DUMB-5K",
        "name": "ダンベル 5kg",
        "jan": "4907000060033",
        "exp": ""
      }
    ],
    "inbound": [
      {
        "nm": "サッカーボール 5号",
        "code": "SP-BALL-5",
        "jan": "4907000060019",
        "lot": "SP2606A",
        "exp": "—",
        "qty": 480
      },
      {
        "nm": "ランニングシューズ 26cm",
        "code": "SP-SHOE-26",
        "jan": "4907000060026",
        "lot": "SP2606B",
        "exp": "—",
        "qty": 360
      },
      {
        "nm": "ダンベル 5kg",
        "code": "SP-DUMB-5K",
        "jan": "4907000060033",
        "lot": "SP2606C",
        "exp": "—",
        "qty": 240
      }
    ],
    "counts": [
      {
        "nm": "サッカーボール 5号",
        "loc": "G-01-01",
        "theory": 480
      },
      {
        "nm": "ランニングシューズ 26cm",
        "loc": "G-01-02",
        "theory": 360
      },
      {
        "nm": "ダンベル 5kg",
        "loc": "G-01-03",
        "theory": 240
      }
    ],
    "move": {
      "nm": "サッカーボール 5号",
      "fromLoc": "G-01-01",
      "toLoc": "P-61",
      "qty": 120,
      "area": "常温G"
    },
    "outbound": {
      "orderLabel": "スポーツ用品店チェーン向け（ボール30・シューズ20点）",
      "soId": "SO-2026-0603-51",
      "picks": [
        {
          "nm": "サッカーボール 5号",
          "loc": "P-61",
          "qty": 30
        },
        {
          "nm": "ランニングシューズ 26cm",
          "loc": "P-62",
          "qty": 20
        }
      ]
    }
  },

  "gift": {
    "answers": {
      "shelf": "no",
      "temp": "normal",
      "owner": "multi",
      "ship": "ec",
      "turn": "fast"
    },
    "counts": [
      {
        "nm": "アロマキャンドル ローズ",
        "loc": "C-02-01",
        "theory": 600
      },
      {
        "nm": "ステンレスタンブラー 350ml",
        "loc": "C-02-02",
        "theory": 480
      },
      {
        "nm": "今治ハンドタオル ギフトBOX",
        "loc": "C-02-03",
        "theory": 360
      }
    ],
    "emoji": "🎁",
    "id": "gift",
    "inbound": [
      {
        "nm": "アロマキャンドル ローズ",
        "code": "GF-CANDLE",
        "jan": "4902000000018",
        "lot": "L260603R",
        "exp": "—",
        "qty": 600
      },
      {
        "nm": "ステンレスタンブラー 350ml",
        "code": "GF-TUMBLER",
        "jan": "4902000000025",
        "lot": "L260603T",
        "exp": "—",
        "qty": 480
      },
      {
        "nm": "今治ハンドタオル ギフトBOX",
        "code": "GF-TOWEL",
        "jan": "4902000000032",
        "lot": "L260603H",
        "exp": "—",
        "qty": 360
      }
    ],
    "industry": "雑貨・ギフト",
    "move": {
      "nm": "アロマキャンドル ローズ",
      "fromLoc": "C-02-01",
      "toLoc": "P-52",
      "qty": 120,
      "area": "常温C"
    },
    "outbound": {
      "orderLabel": "楽天市場ギフト便（キャンドル30・タンブラー20個口）",
      "soId": "SO-2026-0603-52",
      "picks": [
        {
          "nm": "アロマキャンドル ローズ",
          "loc": "P-52",
          "qty": 30
        },
        {
          "nm": "ステンレスタンブラー 350ml",
          "loc": "C-02-02",
          "qty": 20
        }
      ]
    },
    "products": [
      {
        "code": "GF-CANDLE",
        "name": "アロマキャンドル ローズ",
        "jan": "4902000000018",
        "exp": ""
      },
      {
        "code": "GF-TUMBLER",
        "name": "ステンレスタンブラー 350ml",
        "jan": "4902000000025",
        "exp": ""
      },
      {
        "code": "GF-TOWEL",
        "name": "今治ハンドタオル ギフトBOX",
        "jan": "4902000000032",
        "exp": ""
      }
    ],
    "tagline": "期限なし／常温／多品種・EC高回転のギフト個口を複数荷主3PLでさばく",
    "title": "ギフト雑貨EC倉庫 ─ 1日の流れ"
  },

  "tire": {
    "answers": {
      "shelf": "yes",
      "temp": "normal",
      "owner": "single",
      "ship": "btob",
      "turn": "bulk"
    },
    "counts": [
      {
        "nm": "スタッドレスタイヤ 195/65R15",
        "loc": "C-02-01",
        "theory": 240
      },
      {
        "nm": "エンジンオイル 4L",
        "loc": "C-02-02",
        "theory": 180
      },
      {
        "nm": "カーバッテリー 40B19L",
        "loc": "C-02-03",
        "theory": 120
      }
    ],
    "emoji": "🛞",
    "id": "tire",
    "inbound": [
      {
        "nm": "スタッドレスタイヤ 195/65R15",
        "code": "TR-STUDLESS",
        "jan": "4901000101017",
        "lot": "M2418A",
        "exp": "2029-06-03",
        "qty": 240
      },
      {
        "nm": "エンジンオイル 4L",
        "code": "TR-OIL",
        "jan": "4901000101024",
        "lot": "L260603B",
        "exp": "2029-06-03",
        "qty": 180
      },
      {
        "nm": "カーバッテリー 40B19L",
        "code": "TR-BATTERY",
        "jan": "4901000101031",
        "lot": "B2425C",
        "exp": "2028-06-03",
        "qty": 120
      }
    ],
    "industry": "タイヤ・カー用品",
    "move": {
      "nm": "スタッドレスタイヤ 195/65R15",
      "fromLoc": "C-02-01",
      "toLoc": "P-53",
      "qty": 240,
      "area": "常温C"
    },
    "outbound": {
      "orderLabel": "オートバックス北関東センター向け（スタッドレス40・エンジンオイル20本）",
      "soId": "SO-2026-0603-53",
      "picks": [
        {
          "nm": "スタッドレスタイヤ 195/65R15",
          "loc": "P-53",
          "qty": 40
        },
        {
          "nm": "エンジンオイル 4L",
          "loc": "C-02-02",
          "qty": 20
        }
      ]
    },
    "products": [
      {
        "code": "TR-STUDLESS",
        "name": "スタッドレスタイヤ 195/65R15",
        "jan": "4901000101017",
        "exp": "1825"
      },
      {
        "code": "TR-OIL",
        "name": "エンジンオイル 4L",
        "jan": "4901000101024",
        "exp": "1095"
      },
      {
        "code": "TR-BATTERY",
        "name": "カーバッテリー 40B19L",
        "jan": "4901000101031",
        "exp": "730"
      }
    ],
    "tagline": "製造年(週)管理あり／常温／重量・大型の定番品をBtoB大口＋一部EC出荷",
    "title": "カー用品定温倉庫 ─ 1日の流れ"
  },

};
