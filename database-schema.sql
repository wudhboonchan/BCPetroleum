-- BC Petroleum Database Schema for Supabase
-- Run this script in your Supabase SQL Editor

-- Enable Row Level Security (RLS) for all tables
-- We'll set up policies after creating tables

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Customers Table
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  contact_person VARCHAR(200),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Daily Records Table (Raw meter readings)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_records (
  date DATE PRIMARY KEY,
  -- Fuel prices
  e91_cost_price DECIMAL(10, 2) NOT NULL,
  e91_sell_price DECIMAL(10, 2) NOT NULL,
  e95_cost_price DECIMAL(10, 2) NOT NULL,
  e95_sell_price DECIMAL(10, 2) NOT NULL,
  b7_cost_price DECIMAL(10, 2) NOT NULL,
  b7_sell_price DECIMAL(10, 2) NOT NULL,
  -- Nozzle readings - Today
  nozzle_1_today DECIMAL(12, 3) NOT NULL,
  nozzle_2_today DECIMAL(12, 3) NOT NULL,
  nozzle_3_today DECIMAL(12, 3) NOT NULL,
  nozzle_4_today DECIMAL(12, 3) NOT NULL,
  nozzle_5_today DECIMAL(12, 3) NOT NULL,
  nozzle_6_today DECIMAL(12, 3) NOT NULL,
  nozzle_7_today DECIMAL(12, 3) NOT NULL,
  nozzle_8_today DECIMAL(12, 3) NOT NULL,
  -- Nozzle readings - Yesterday
  nozzle_1_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_2_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_3_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_4_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_5_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_6_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_7_yesterday DECIMAL(12, 3) NOT NULL,
  nozzle_8_yesterday DECIMAL(12, 3) NOT NULL,
  -- Metadata
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Daily Metrics Table (Calculated values)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_metrics (
  date DATE PRIMARY KEY,
  -- Overall metrics
  total_sales DECIMAL(12, 2) NOT NULL,
  total_profit DECIMAL(12, 2) NOT NULL,
  total_liters DECIMAL(12, 3) NOT NULL,
  -- E91 metrics
  e91_sales DECIMAL(12, 2) NOT NULL,
  e91_profit DECIMAL(12, 2) NOT NULL,
  e91_liters DECIMAL(12, 3) NOT NULL,
  -- E95 metrics
  e95_sales DECIMAL(12, 2) NOT NULL,
  e95_profit DECIMAL(12, 2) NOT NULL,
  e95_liters DECIMAL(12, 3) NOT NULL,
  -- B7 metrics
  b7_sales DECIMAL(12, 2) NOT NULL,
  b7_profit DECIMAL(12, 2) NOT NULL,
  b7_liters DECIMAL(12, 3) NOT NULL,
  -- Individual nozzle liters
  nozzle_1_liters DECIMAL(12, 3) NOT NULL,
  nozzle_2_liters DECIMAL(12, 3) NOT NULL,
  nozzle_3_liters DECIMAL(12, 3) NOT NULL,
  nozzle_4_liters DECIMAL(12, 3) NOT NULL,
  nozzle_5_liters DECIMAL(12, 3) NOT NULL,
  nozzle_6_liters DECIMAL(12, 3) NOT NULL,
  nozzle_7_liters DECIMAL(12, 3) NOT NULL,
  nozzle_8_liters DECIMAL(12, 3) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Credit Sales Table
-- ============================================
CREATE TABLE IF NOT EXISTS credit_sales (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  bill_book VARCHAR(50) NOT NULL,
  bill_number VARCHAR(50) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  vehicle_number VARCHAR(50),
  note TEXT,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_credit_sales_date ON credit_sales(date);
CREATE INDEX idx_credit_sales_customer ON credit_sales(customer_id);
CREATE INDEX idx_credit_sales_paid ON credit_sales(paid);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);

-- ============================================
-- Insert Default Users
-- ============================================
-- Password for all users: 'password123' (hashed with bcrypt)
-- In production, you should change these passwords!
-- The hash below is for 'password123'

INSERT INTO users (username, password, name, role) VALUES
('Wudh', '$2b$10$YbhBP1Dr5G/8AarjNSi8V.zJ84gTBcEB9EZLHO7J0jXqy3vguhljS', 'Wudh', 'admin'),
('Keeratika', '$2b$10$xoUe/3hp64rcp0iV3I6M8eitj0lkNVpu2NW4YAg2svok/FeUPnSvi', 'Keeratika', 'user'),
('Kanokkotchakorn', '$2b$10$kpzH.OB0FKxk9LceqhwQWO97WqV6l/TpPDqYIGL.v96gxZuNhIupO', 'Kanokkotchakorn', 'user')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- Insert Sample Customers
-- ============================================
INSERT INTO customers (code, name, phone, contact_person) VALUES
('C001', 'ลูกค้ารายย่อย', NULL, NULL),
('C002', 'บริษัท ABC จำกัด', '02-123-4567', 'คุณสมชาย'),
('C003', 'บริษัท XYZ จำกัด', '02-234-5678', 'คุณสมหญิง')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_sales ENABLE ROW LEVEL SECURITY;

-- For development, allow all operations
-- In production, you should create more restrictive policies

-- Users table policies
CREATE POLICY "Allow all operations on users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- Customers table policies
CREATE POLICY "Allow all operations on customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

-- Daily records table policies
CREATE POLICY "Allow all operations on daily_records" ON daily_records
  FOR ALL USING (true) WITH CHECK (true);

-- Daily metrics table policies
CREATE POLICY "Allow all operations on daily_metrics" ON daily_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- Credit sales table policies
CREATE POLICY "Allow all operations on credit_sales" ON credit_sales
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_records_updated_at BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_sales_updated_at BEFORE UPDATE ON credit_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data (Optional)
-- ============================================

-- Insert sample daily record for testing
INSERT INTO daily_records (
  date,
  e91_cost_price, e91_sell_price,
  e95_cost_price, e95_sell_price,
  b7_cost_price, b7_sell_price,
  nozzle_1_today, nozzle_2_today, nozzle_3_today, nozzle_4_today,
  nozzle_5_today, nozzle_6_today, nozzle_7_today, nozzle_8_today,
  nozzle_1_yesterday, nozzle_2_yesterday, nozzle_3_yesterday, nozzle_4_yesterday,
  nozzle_5_yesterday, nozzle_6_yesterday, nozzle_7_yesterday, nozzle_8_yesterday
) VALUES (
  CURRENT_DATE - INTERVAL '1 day',
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  10500.500, 11200.750, 9800.250, 10900.500,
  8700.250, 9500.750, 8200.500, 9100.250,
  10000.000, 10500.000, 9200.000, 10200.000,
  8100.000, 8800.000, 7600.000, 8400.000
) ON CONFLICT (date) DO NOTHING;

-- Note: Don't forget to:
-- 1. Replace the placeholder password hashes with actual bcrypt hashes
-- 2. Update Supabase URL and KEY in your .env file
-- 3. Adjust RLS policies for production security
