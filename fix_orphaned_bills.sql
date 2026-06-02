-- ============================================================
-- FIX: RLS Policy สำหรับ table invoices
-- วิธีใช้: รันใน Supabase SQL Editor
-- ============================================================

-- ดู policy ปัจจุบันของ invoices ก่อน
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'invoices';

-- ============================================================
-- Fix: เพิ่ม policy ให้ invoices (แบบเดียวกับตารางอื่นในระบบ)
-- ============================================================

-- ลบ policy เก่าที่อาจขัดแย้งก่อน
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Allow all operations on invoices" ON invoices;

-- สร้าง policy ใหม่แบบ permissive (เหมือนตารางอื่นทั้งหมดในระบบ)
CREATE POLICY "Allow all operations on invoices" ON invoices
    FOR ALL USING (true) WITH CHECK (true);

-- ตรวจสอบว่า policy ถูกสร้างแล้ว
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'invoices';
