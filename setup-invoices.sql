-- Create Invoices Table
-- NOTE: We use UUID for created_by because the users table uses UUID primary keys.

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    items_count INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Optional)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Allow all access
CREATE POLICY "Allow all access" ON invoices FOR ALL USING (true);
