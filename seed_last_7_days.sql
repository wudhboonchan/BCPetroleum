-- Seed script to populate daily_records with 7 days of sample data
-- Run this in Supabase SQL Editor to populate the last 7 days of sales data

-- Delete existing sample data if any (optional, comment out if you want to keep existing data)
-- DELETE FROM daily_records WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- Insert 7 days of sample data
-- Day 7 (oldest)
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
  CURRENT_DATE - INTERVAL '6 days',
  32.50, 35.00,  -- E91 prices
  35.00, 38.00,  -- E95 prices
  28.50, 31.00,  -- B7 prices
  10500.000, 11200.000, 9800.000, 10900.000,  -- Today's readings
  8700.000, 9500.000, 8200.000, 9100.000,
  10000.000, 10500.000, 9200.000, 10200.000,  -- Yesterday's readings
  8100.000, 8800.000, 7600.000, 8400.000
) ON CONFLICT (date) DO NOTHING;

-- Day 6
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
  CURRENT_DATE - INTERVAL '5 days',
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  11100.000, 11900.000, 10400.000, 11600.000,
  9350.000, 10200.000, 8850.000, 9850.000,
  10500.000, 11200.000, 9800.000, 10900.000,
  8700.000, 9500.000, 8200.000, 9100.000
) ON CONFLICT (date) DO NOTHING;

-- Day 5
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
  CURRENT_DATE - INTERVAL '4 days',
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  11750.000, 12650.000, 11050.000, 12350.000,
  10050.000, 10950.000, 9550.000, 10600.000,
  11100.000, 11900.000, 10400.000, 11600.000,
  9350.000, 10200.000, 8850.000, 9850.000
) ON CONFLICT (date) DO NOTHING;

-- Day 4
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
  CURRENT_DATE - INTERVAL '3 days',
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  12300.000, 13250.000, 11600.000, 12950.000,
  10650.000, 11550.000, 10100.000, 11200.000,
  11750.000, 12650.000, 11050.000, 12350.000,
  10050.000, 10950.000, 9550.000, 10600.000
) ON CONFLICT (date) DO NOTHING;

-- Day 3
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
  CURRENT_DATE - INTERVAL '2 days',
  32.75, 35.25,
  35.25, 38.25,
  28.75, 31.25,
  12950.000, 13950.000, 12250.000, 13650.000,
  11350.000, 12250.000, 10750.000, 11900.000,
  12300.000, 13250.000, 11600.000, 12950.000,
  10650.000, 11550.000, 10100.000, 11200.000
) ON CONFLICT (date) DO NOTHING;

-- Day 2 (yesterday)
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
  32.75, 35.25,
  35.25, 38.25,
  28.75, 31.25,
  13650.000, 14700.000, 12950.000, 14400.000,
  12100.000, 13000.000, 11450.000, 12650.000,
  12950.000, 13950.000, 12250.000, 13650.000,
  11350.000, 12250.000, 10750.000, 11900.000
) ON CONFLICT (date) DO NOTHING;

-- Day 1 (today)
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
  CURRENT_DATE,
  32.75, 35.25,
  35.25, 38.25,
  28.75, 31.25,
  14250.000, 15350.000, 13550.000, 15050.000,
  12750.000, 13650.000, 12050.000, 13300.000,
  13650.000, 14700.000, 12950.000, 14400.000,
  12100.000, 13000.000, 11450.000, 12650.000
) ON CONFLICT (date) DO NOTHING;

-- Verify the data was inserted
SELECT 
  date,
  e91_sell_price,
  e95_sell_price,
  b7_sell_price,
  (nozzle_1_today - nozzle_1_yesterday + nozzle_3_today - nozzle_3_yesterday) * e91_sell_price +
  (nozzle_5_today - nozzle_5_yesterday + nozzle_7_today - nozzle_7_yesterday) * e95_sell_price +
  (nozzle_2_today - nozzle_2_yesterday + nozzle_4_today - nozzle_4_yesterday + 
   nozzle_6_today - nozzle_6_yesterday + nozzle_8_today - nozzle_8_yesterday) * b7_sell_price AS total_sales
FROM daily_records 
WHERE date >= CURRENT_DATE - INTERVAL '6 days'
ORDER BY date ASC;
