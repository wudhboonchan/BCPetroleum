-- ==================================================
-- OPTIONAL: RESTORE REALISTIC SAMPLE DATA
-- ==================================================

-- Run this IF AND ONLY IF you want to see sample data on the chart immediately.
-- These numbers are realistic (e.g. 5,000 - 15,000 baht per day), NOT the high millions.

DELETE FROM daily_records WHERE date >= CURRENT_DATE - INTERVAL '7 days';

INSERT INTO daily_records (
  date,
  e91_cost_price, e91_sell_price,
  e95_cost_price, e95_sell_price,
  b7_cost_price, b7_sell_price,
  nozzle_1_today, nozzle_2_today, nozzle_3_today, nozzle_4_today,
  nozzle_5_today, nozzle_6_today, nozzle_7_today, nozzle_8_today,
  nozzle_1_yesterday, nozzle_2_yesterday, nozzle_3_yesterday, nozzle_4_yesterday,
  nozzle_5_yesterday, nozzle_6_yesterday, nozzle_7_yesterday, nozzle_8_yesterday
) VALUES 
-- Day 1 (Today)
(
  CURRENT_DATE,
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  1050.000, 1100.000, 1050.000, 1100.000,
  1050.000, 1100.000, 1050.000, 1100.000,
  1000.000, 1000.000, 1000.000, 1000.000,
  1000.000, 1000.000, 1000.000, 1000.000
),
-- Day 2
(
  CURRENT_DATE - INTERVAL '1 day',
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  1000.000, 1000.000, 1000.000, 1000.000,
  1000.000, 1000.000, 1000.000, 1000.000,
  950.000, 950.000, 950.000, 950.000,
  950.000, 950.000, 950.000, 950.000
),
-- Day 3 (A bit higher)
(
  CURRENT_DATE - INTERVAL '2 days',
  32.50, 35.00,
  35.00, 38.00,
  28.50, 31.00,
  950.000, 950.000, 950.000, 950.000,
  950.000, 950.000, 950.000, 950.000,
  880.000, 880.000, 880.000, 880.000,
  880.000, 880.000, 880.000, 880.000
)
ON CONFLICT (date) DO UPDATE SET
  nozzle_1_today = EXCLUDED.nozzle_1_today;

-- Result:
-- Each day has roughly 50-70 liters per nozzle * 8 nozzles ~= 400-500 liters total.
-- Sales approx 15,000 - 20,000 Baht per day.
