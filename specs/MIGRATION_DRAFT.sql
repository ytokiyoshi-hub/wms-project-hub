-- =============================================
-- Phase 9 致命傷ライン本実装：migration 雛形
-- =============================================
-- 起票：2026-05-08 / Phase 9-A まーちゃん
-- 前提：致命傷ライン15項目すべてまーちゃん推奨案を採用した場合の DDL
-- 注意：時吉さん・今井先生のレビュー後に微調整・確定すること
-- 適用：Supabase の apply_migration MCP ツール経由（さーちゃん主担当）
-- =============================================

-- =============================================
-- Stage 1: 基盤（DB-4 + AU-1 + AU-2）
-- =============================================

-- DB-4: 荷主マスタ（全業務テーブルの owner_id 起点）
CREATE TABLE owners (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                -- 例: TKY, AAA
  name TEXT NOT NULL,
  theme_color TEXT,                         -- 差別化4点：荷主別テーマカラー

  -- 荷主切替フラグ群（多くの致命傷ライン項目で使用）
  allocation_strategy TEXT NOT NULL DEFAULT 'fifo'
    CHECK (allocation_strategy IN ('fifo', 'lifo', 'lpa', 'custom')),     -- BF-2
  picking_strategy TEXT NOT NULL DEFAULT 'single'
    CHECK (picking_strategy IN ('single', 'batch', 'wave', 'auto')),      -- BF-3
  lot_strategy TEXT NOT NULL DEFAULT 'inbound_batch'
    CHECK (lot_strategy IN ('inbound_batch', 'manufacturer', 'none')),    -- DB-2
  inspection_strategy TEXT NOT NULL DEFAULT 'full'
    CHECK (inspection_strategy IN ('full', 'sampling', 'sign')),          -- BF-1
  discrepancy_strategy TEXT NOT NULL DEFAULT 'hold'
    CHECK (discrepancy_strategy IN ('hold', 'post')),                     -- 工程2-Q3
  putaway_strategy TEXT NOT NULL DEFAULT 'free'
    CHECK (putaway_strategy IN ('fixed', 'free', 'abc')),                 -- 工程2-Q4
  return_strategy TEXT NOT NULL DEFAULT 'wms_separate'
    CHECK (return_strategy IN ('not_managed', 'wms_separate')),           -- 工程2-Q5
  barcode_required_fields TEXT NOT NULL DEFAULT 'jan',                    -- LK-2: jan,serial,lot,owner_sku
  cost_management_enabled BOOLEAN NOT NULL DEFAULT false,                 -- CA-2
  billing_period_type TEXT NOT NULL DEFAULT '3-period'
    CHECK (billing_period_type IN ('3-period', '2-period', 'daily', 'monthly', 'tsubo')), -- CA-1

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_owners_code ON owners(code);

-- AU-2: 商品マスタ
CREATE TABLE skus (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  sku_code TEXT NOT NULL,
  jan TEXT,
  name TEXT NOT NULL,
  serial_required BOOLEAN NOT NULL DEFAULT false,    -- DB-3
  lot_required BOOLEAN NOT NULL DEFAULT false,       -- DB-2
  abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, sku_code)
);
CREATE UNIQUE INDEX idx_skus_owner_jan ON skus(owner_id, jan) WHERE jan IS NOT NULL;
CREATE INDEX idx_skus_owner_id ON skus(owner_id);

-- AU-1: ユーザー × 荷主アクセス
CREATE TABLE user_owners (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,                              -- Supabase auth.users.id を参照
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  role TEXT NOT NULL
    CHECK (role IN ('admin', 'operator', 'viewer', 'shipper')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID,
  UNIQUE (user_id, owner_id)
);
CREATE INDEX idx_user_owners_user ON user_owners(user_id);
CREATE INDEX idx_user_owners_owner ON user_owners(owner_id);

-- =============================================
-- Stage 2: 在庫モデル（DB-1 + DB-2 + DB-3 + DB-5）
-- =============================================

-- DB-5: ロケーション
CREATE TABLE locations (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT REFERENCES owners(id) ON DELETE RESTRICT,    -- NULL = 共有ロケ
  code TEXT NOT NULL,                                          -- WH-A1-01-3
  area TEXT,
  aisle TEXT,
  rack TEXT,
  level TEXT,
  location_type TEXT NOT NULL DEFAULT 'storage'
    CHECK (location_type IN ('storage', 'picking', 'staging', 'damage', 'returns', 'inspection')),
  abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C')),
  picking_priority INT NOT NULL DEFAULT 100,
  capacity NUMERIC,                                            -- 容量上限
  current_volume NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'frozen', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (COALESCE(owner_id, 0), code)                        -- owner=NULL は共有・他は荷主単位 UNIQUE
);
CREATE INDEX idx_locations_type ON locations(owner_id, location_type, abc_class, picking_priority);

-- DB-2: ロット
CREATE TABLE lots (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  lot_number TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'inbound_batch'
    CHECK (source_type IN ('inbound_batch', 'manufacturer')),
  mfg_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, sku_id, lot_number)
);
CREATE INDEX idx_lots_expiry ON lots(owner_id, sku_id, expiry_date NULLS LAST, mfg_date ASC);

-- DB-3: シリアル
CREATE TABLE serials (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  serial_number TEXT NOT NULL,
  current_inventory_id BIGINT,                                 -- inventory(id) FK は循環参照のため後で ALTER
  status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (status IN ('in_stock', 'reserved', 'shipped', 'damaged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, sku_id, serial_number)
);

-- DB-1: 在庫（4軸: owner × sku × lot × location）
CREATE TABLE inventory (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  lot_id BIGINT REFERENCES lots(id) ON DELETE RESTRICT,                 -- NULL = ロット管理しない SKU
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'damaged', 'quarantine')),
  unit_cost NUMERIC NOT NULL DEFAULT 0,                                 -- CA-2: 移動平均
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, sku_id, lot_id, location_id, status)
);
CREATE INDEX idx_inventory_owner_sku ON inventory(owner_id, sku_id);
CREATE INDEX idx_inventory_owner_loc ON inventory(owner_id, location_id);
CREATE INDEX idx_inventory_status ON inventory(owner_id, status);

-- 循環参照解消：serials.current_inventory_id FK 追加
ALTER TABLE serials
  ADD CONSTRAINT fk_serials_inventory
  FOREIGN KEY (current_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL;

-- =============================================
-- Stage 4: 計算（CA-1）
-- =============================================

CREATE TABLE billing_rules (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,                                  -- 保管料・入庫料・出庫料・期間外料・その他
  period_type TEXT NOT NULL
    CHECK (period_type IN ('3-period', '2-period', 'daily', 'monthly', 'tsubo')),
  unit TEXT NOT NULL CHECK (unit IN ('case', 'piece', 'tsubo', 'sqm')),
  unit_price NUMERIC NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_rules_owner ON billing_rules(owner_id, rule_type, valid_from DESC);

-- =============================================
-- RLS（DB-4 + AU-1 の中核実装）
-- =============================================

-- 全業務テーブルで RLS 有効化
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_owners ENABLE ROW LEVEL SECURITY;

-- 共通ポリシー：自分が所属する荷主のみアクセス可（admin / operator / viewer）
CREATE POLICY inventory_owner_access ON inventory
  FOR ALL
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator', 'viewer')
    )
  );

CREATE POLICY skus_owner_access ON skus
  FOR ALL
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator', 'viewer')
    )
  );

CREATE POLICY lots_owner_access ON lots
  FOR ALL
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator', 'viewer')
    )
  );

CREATE POLICY locations_owner_access ON locations
  FOR ALL
  USING (
    owner_id IS NULL OR
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator', 'viewer')
    )
  );

CREATE POLICY serials_owner_access ON serials
  FOR ALL
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator', 'viewer')
    )
  );

CREATE POLICY billing_rules_owner_access ON billing_rules
  FOR ALL
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'operator')
    )
  );

-- shipper（荷主自身）は閲覧のみ
CREATE POLICY inventory_shipper_read ON inventory
  FOR SELECT
  USING (
    owner_id IN (
      SELECT owner_id FROM user_owners
      WHERE user_id = auth.uid() AND role = 'shipper'
    )
  );

-- user_owners 自体：自分の行のみ閲覧可
CREATE POLICY user_owners_self_read ON user_owners
  FOR SELECT
  USING (user_id = auth.uid());

-- owners テーブル：所属する荷主のみ閲覧
CREATE POLICY owners_assigned_read ON owners
  FOR SELECT
  USING (
    id IN (SELECT owner_id FROM user_owners WHERE user_id = auth.uid())
  );

-- =============================================
-- 注意事項
-- =============================================
-- 1. 本 SQL は推奨案ベース。時吉さん・今井先生の判断で大きく変わる項目あり：
--    - DB-4 が A/C/D（物理分離・スキーマ分離・ハイブリッド）になると owner_id 設計から再考
--    - DB-3 が C（全 SKU シリアル管理）になると serials テーブルが激重
--
-- 2. 既存テーブル（todos, kurokun_memo, kurokun_outbox, schedules, heartbeats, members）は
--    Phase 9 では変更しない（運用基盤として継続）
--
-- 3. apply 順序：
--    Step 1：本 SQL の Stage 1 部分（owners → skus → user_owners）
--    Step 2：Stage 2（locations → lots → serials → inventory → 循環参照解消）
--    Step 3：Stage 4（billing_rules）
--    Step 4：RLS 一括有効化
--
-- 4. apply は Supabase MCP の apply_migration を使う（さーちゃん主担当）
-- 5. apply 前に Supabase の dev branch でテスト推奨
