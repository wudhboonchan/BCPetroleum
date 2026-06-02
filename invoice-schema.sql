-- Invoice System Schema
-- Created: 2026-01-04
-- Description: Tables and modifications for invoice-based credit sales management

-- ============================================================================
-- Table: invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    total_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    remaining_amount DECIMAL(12, 2) NOT NULL,
    issue_date DATE NOT NULL,
    paid_date DATE,
    payment_method VARCHAR(20),
    note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ============================================================================
-- Modify credit_sales table
-- ============================================================================
ALTER TABLE credit_sales 
ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(20) DEFAULT 'unpaired';

CREATE INDEX IF NOT EXISTS idx_credit_sales_invoice ON credit_sales(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_invoice_status ON credit_sales(invoice_status);

-- ============================================================================
-- Migration
-- ============================================================================
UPDATE credit_sales 
SET invoice_status = 'unpaired' 
WHERE invoice_status IS NULL;
