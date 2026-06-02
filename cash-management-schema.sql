-- BC Petroleum - Cash Management Feature
-- Database Schema Migration
-- Run this script in your Supabase SQL Editor

-- ============================================
-- Daily Cash Records Table
-- ============================================
CREATE TABLE IF NOT EXISTS daily_cash_records (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  
  -- Cash denominations (quantity)
  bills_1000 INTEGER DEFAULT 0,
  bills_500 INTEGER DEFAULT 0,
  bills_100 INTEGER DEFAULT 0,
  bills_50 INTEGER DEFAULT 0,
  bills_20 INTEGER DEFAULT 0,
  coins_10 INTEGER DEFAULT 0,
  coins_5 INTEGER DEFAULT 0,
  coins_2 INTEGER DEFAULT 0,
  coins_1 INTEGER DEFAULT 0,
  
  -- Calculated values
  total_counted_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  working_change DECIMAL(10, 2) DEFAULT 1000.00,
  net_cash_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Bank transfers
  bank_transfer_amount DECIMAL(12, 2) DEFAULT 0,
  
  -- Total revenue
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Reconciliation
  expected_sales DECIMAL(12, 2) DEFAULT 0,
  credit_sales DECIMAL(12, 2) DEFAULT 0,
  personal_fuel_value DECIMAL(12, 2) DEFAULT 0,
  difference DECIMAL(12, 2) DEFAULT 0,
  
  -- Metadata
  note TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daily_cash_date ON daily_cash_records(date);

-- ============================================
-- Personal Fuel Usage Table
-- ============================================
CREATE TABLE IF NOT EXISTS personal_fuel_usage (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  fuel_type VARCHAR(10) NOT NULL CHECK (fuel_type IN ('e91', 'e95', 'b7')),
  liters DECIMAL(10, 3) NOT NULL,
  price_per_liter DECIMAL(10, 2) NOT NULL,
  total_value DECIMAL(12, 2) NOT NULL,
  note TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_personal_fuel_date ON personal_fuel_usage(date);
CREATE INDEX idx_personal_fuel_type ON personal_fuel_usage(fuel_type);

-- ============================================
-- Credit Cash Payments Table
-- ============================================
CREATE TABLE IF NOT EXISTS credit_cash_payments (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credit_cash_payments_date ON credit_cash_payments(date);
CREATE INDEX idx_credit_cash_payments_customer ON credit_cash_payments(customer_id);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE daily_cash_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_fuel_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cash_payments ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for development)
CREATE POLICY "Allow all operations on daily_cash_records" ON daily_cash_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on personal_fuel_usage" ON personal_fuel_usage
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on credit_cash_payments" ON credit_cash_payments
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE TRIGGER update_daily_cash_records_updated_at BEFORE UPDATE ON daily_cash_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_fuel_usage_updated_at BEFORE UPDATE ON personal_fuel_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Success Message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Cash Management tables created successfully!';
  RAISE NOTICE '   - daily_cash_records';
  RAISE NOTICE '   - personal_fuel_usage';
  RAISE NOTICE '   - credit_cash_payments';
END $$;
