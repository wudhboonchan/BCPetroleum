-- Loans (Temporary Borrowing) Schema
-- Created: 2026-02-19
-- Description: Table for tracking temporary loans (เงินกู้ยืมชั่วคราว)
-- These are recorded as receivables and can be paid through the debt payment system

-- ============================================================================
-- Table: loans
-- Purpose: Tracks temporary borrowing and repayment status
-- ============================================================================
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT NOT NULL,               -- รายละเอียดเงินกู้ยืม
    amount DECIMAL(12, 2) NOT NULL,          -- จำนวนเงินที่กู้ยืม
    account_type VARCHAR(20) NOT NULL,       -- 'cash' or 'bank' - บัญชีที่เงินเข้า
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'paid', 'unpaid', 'partial'
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    remaining_amount DECIMAL(12, 2),
    note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loans_date ON loans(date);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(payment_status);

-- Comments
COMMENT ON TABLE loans IS 'Tracks temporary borrowing (เงินกู้ยืมชั่วคราว) and payment status for receivables calculation';

-- Enable Row Level Security (RLS)
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for authenticated users" ON loans
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON loans
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON loans
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON loans
    FOR DELETE USING (auth.role() = 'authenticated');
