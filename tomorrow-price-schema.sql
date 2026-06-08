-- ตารางเก็บราคาน้ำมันพรุ่งนี้ + ส่วนต่าง (diff) จากการ scrape Bangchak
CREATE TABLE IF NOT EXISTS fuel_price_tomorrow (
  id              SERIAL PRIMARY KEY,
  price_date      DATE NOT NULL UNIQUE,   -- วันที่ของข้อมูล "พรุ่งนี้" (วันที่ราคาจะมีผล)
  -- ราคาวันนี้ (today snapshot จาก Bangchak)
  b7_today        NUMERIC(6,2),
  e95_today       NUMERIC(6,2),
  e91_today       NUMERIC(6,2),
  -- ราคาพรุ่งนี้
  b7_tomorrow     NUMERIC(6,2),
  e95_tomorrow    NUMERIC(6,2),
  e91_tomorrow    NUMERIC(6,2),
  -- ส่วนต่าง (+ = ขึ้น, - = ลด, 0 = คงเดิม)
  b7_diff         NUMERIC(6,2),
  e95_diff        NUMERIC(6,2),
  e91_diff        NUMERIC(6,2),
  -- metadata
  source          TEXT DEFAULT 'bangchak_scrape',  -- 'bangchak_scrape' | 'manual_override'
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index เพื่อดึงข้อมูลล่าสุดเร็ว
CREATE INDEX IF NOT EXISTS idx_fuel_price_tomorrow_date ON fuel_price_tomorrow (price_date DESC);

-- Trigger อัปเดต updated_at อัตโนมัติ
CREATE OR REPLACE FUNCTION update_fuel_price_tomorrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fuel_price_tomorrow_updated_at ON fuel_price_tomorrow;
CREATE TRIGGER trg_fuel_price_tomorrow_updated_at
  BEFORE UPDATE ON fuel_price_tomorrow
  FOR EACH ROW EXECUTE FUNCTION update_fuel_price_tomorrow_updated_at();
