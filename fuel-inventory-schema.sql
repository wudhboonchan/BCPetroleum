-- Add uuid extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Fuel Inventory table
CREATE TABLE IF NOT EXISTS fuel_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fuel_type VARCHAR(20) UNIQUE NOT NULL, -- 'e91', 'e95', 'b7'
    display_name VARCHAR(50) NOT NULL, -- 'เบนซิล E91', 'เบนซิล E95', 'ดีเซล B7'
    initial_liters DECIMAL(10, 3) DEFAULT 0,
    alert_threshold DECIMAL(10, 3) DEFAULT 1000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Insert default fuel types
INSERT INTO fuel_inventory (fuel_type, display_name, initial_liters, alert_threshold) VALUES
('e91', 'เบนซิล E91', 0, 1000),
('e95', 'เบนซิล E95', 0, 1000),
('b7', 'ดีเซล B7', 0, 1000)
ON CONFLICT (fuel_type) DO NOTHING;

-- Add RLS Policies
ALTER TABLE fuel_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users for fuel_inventory"
ON fuel_inventory
FOR SELECT
USING (true);

CREATE POLICY "Allow update access to authenticated users for fuel_inventory"
ON fuel_inventory
FOR UPDATE
USING (true);

CREATE POLICY "Allow insert access to authenticated users for fuel_inventory"
ON fuel_inventory
FOR INSERT
WITH CHECK (true);
