-- Fix RLS Policies for Accounting Tables
-- Run this in Supabase SQL Editor to fix INSERT permission errors

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON account_transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON account_transactions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON account_transactions;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON account_transactions;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fuel_investments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON fuel_investments;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON fuel_investments;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON fuel_investments;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON water_investments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON water_investments;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON water_investments;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON water_investments;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON daily_account_balances;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON daily_account_balances;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON daily_account_balances;

-- Create new permissive policies (same as other tables in the system)
CREATE POLICY "Allow all operations on account_transactions" ON account_transactions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on fuel_investments" ON fuel_investments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on water_investments" ON water_investments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on daily_account_balances" ON daily_account_balances
    FOR ALL USING (true) WITH CHECK (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('account_transactions', 'fuel_investments', 'water_investments', 'daily_account_balances')
ORDER BY tablename, policyname;
