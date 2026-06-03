-- Safe (กล่องเซฟ) Records Table
CREATE TABLE IF NOT EXISTS safe_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  prev_closing_balance numeric(12,2) NOT NULL DEFAULT 0,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  closing_balance numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE safe_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users_all" ON safe_records FOR ALL USING (auth.role() = 'authenticated');
