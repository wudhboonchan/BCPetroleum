-- Accounting Management System Schema
-- Created: 2026-01-04
-- Description: Tables for tracking daily transactions, investments, and account balances

-- ============================================================================
-- Table: account_transactions
-- Purpose: Records all revenue and expense transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'cash_sales', 'transfer_sales', 'customer_payment', 'deposit_to_bank', 'electricity', 'other_income', 'other_expense'
    category VARCHAR(100),
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20), -- 'cash', 'transfer', NULL
    account_type VARCHAR(20) NOT NULL, -- 'cash', 'profit', 'bank'
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'pending', 'cancelled'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON account_transactions(date);
CREATE INDEX IF NOT EXISTS idx_account_transactions_type ON account_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_account_transactions_customer ON account_transactions(customer_id);

-- ============================================================================
-- Table: fuel_investments
-- Purpose: Tracks fuel purchase investments
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_investments (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    fuel_type VARCHAR(10) NOT NULL, -- 'e91', 'e95', 'b7'
    liters DECIMAL(10, 3) NOT NULL,
    cost_per_liter DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'paid', 'unpaid', 'partial'
    payment_method VARCHAR(20), -- 'cash', 'transfer', NULL if unpaid
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    remaining_amount DECIMAL(12, 2),
    note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fuel_investments_date ON fuel_investments(date);
CREATE INDEX IF NOT EXISTS idx_fuel_investments_status ON fuel_investments(payment_status);

-- ============================================================================
-- Table: water_investments
-- Purpose: Tracks drinking water purchases
-- ============================================================================
CREATE TABLE IF NOT EXISTS water_investments (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    packs INTEGER NOT NULL,
    cost_per_pack DECIMAL(10, 2) NOT NULL DEFAULT 60.00,
    total_cost DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'paid', 'unpaid', 'partial'
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    remaining_amount DECIMAL(10, 2),
    note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_water_investments_date ON water_investments(date);
CREATE INDEX IF NOT EXISTS idx_water_investments_status ON water_investments(payment_status);

-- ============================================================================
-- Table: daily_account_balances
-- Purpose: Stores calculated balances per day (for quick retrieval)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_account_balances (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    cash_balance DECIMAL(12, 2) DEFAULT 0,
    profit_balance DECIMAL(12, 2) DEFAULT 0,
    bank_balance DECIMAL(12, 2) DEFAULT 0,
    total_receivables DECIMAL(12, 2) DEFAULT 0, -- fuel + water unpaid
    total_payables DECIMAL(12, 2) DEFAULT 0, -- credit sales pending payment
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_daily_account_balances_date ON daily_account_balances(date);

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON TABLE account_transactions IS 'Records all daily revenue and expense transactions';
COMMENT ON COLUMN account_transactions.transaction_type IS 'Type of transaction: cash_sales, transfer_sales, customer_payment, deposit_to_bank, electricity, other_income, other_expense';
COMMENT ON COLUMN account_transactions.account_type IS 'Which account is affected: cash, profit, bank';

COMMENT ON TABLE fuel_investments IS 'Tracks fuel purchases and payment status for payables calculation';
COMMENT ON TABLE water_investments IS 'Tracks water purchases and payment status for receivables calculation';
COMMENT ON TABLE daily_account_balances IS 'Cached daily balances for performance - recalculated as needed';

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_account_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth setup)
CREATE POLICY "Enable read access for authenticated users" ON account_transactions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON account_transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON account_transactions
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON account_transactions
    FOR DELETE USING (auth.role() = 'authenticated');

-- Repeat for other tables
CREATE POLICY "Enable read access for authenticated users" ON fuel_investments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON fuel_investments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON fuel_investments
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON fuel_investments
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON water_investments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON water_investments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON water_investments
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON water_investments
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON daily_account_balances
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON daily_account_balances
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON daily_account_balances
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample data
-- INSERT INTO account_transactions (date, transaction_type, category, description, amount, account_type)
-- VALUES 
--     (CURRENT_DATE, 'cash_sales', 'Sales', 'Daily cash sales', 5000.00, 'cash'),
--     (CURRENT_DATE, 'transfer_sales', 'Sales', 'Bank transfer sales', 3000.00, 'bank');
