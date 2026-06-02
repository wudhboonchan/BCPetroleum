# คู่มือการตั้งค่า Supabase สำหรับ BC Petroleum

## ขั้นตอนที่ 1: สร้างบัญชี Supabase

1. ไปที่ [https://supabase.com](https://supabase.com)
2. คลิก "Start your project" หรือ "Sign Up"
3. สมัครด้วย GitHub, Google, หรือ Email

## ขั้นตอนที่ 2: สร้างโปรเจคใหม่

1. หลังจาก login แล้ว คลิก "New Project"
2. กรอกข้อมูล:
   - **Name**: bc-petroleum
   - **Database Password**: สร้างรหัสผ่านที่แข็งแรง (บันทึกไว้ให้ดี!)
   - **Region**: เลือก Southeast Asia (Singapore) สำหรับความเร็วที่ดีที่สุด
   - **Pricing Plan**: เลือก Free tier
3. คลิก "Create new project"
4. รอประมาณ 1-2 นาทีให้โปรเจคถูกสร้าง

## ขั้นตอนที่ 3: รัน Database Schema

1. ในหน้าโปรเจค ไปที่เมนูด้านซ้าย คลิก **"SQL Editor"**
2. คลิก "+ New query"
3. เปิดไฟล์ `database-schema.sql` ในโปรเจค
4. คัดลอกเนื้อหาทั้งหมด
5. วางในหน้าต่าง SQL Editor
6. **สำคัญ!** อ่านหมายเหตุด้านล่างก่อนรัน

### หมายเหตุสำคัญ: Password Hashes

ในไฟล์ `database-schema.sql` จะมีส่วนที่เป็น placeholder สำหรับ password hashes:

```sql
INSERT INTO users (username, password, name, role) VALUES
('Wudh', '$2a$10$XQNNNNNNNNNNNNNNNNNNNOabcdefghijklmnopqrstuvwxyz1234567', 'Wudh', 'admin'),
...
```

คุณต้องแทนที่ hash ปลอม ๆ ด้วย hash จริง โดย:

1. ในเทอร์มินัล ไปที่โฟลเดอร์โปรเจค:
   ```bash
   cd /Users/wudhboonchan/.gemini/antigravity/scratch/bc-petroleum
   ```

2. รันสคริปต์สร้าง hash:
   ```bash
   node hash-passwords.js
   ```

3. สคริปต์จะแสดง hash สำหรับผู้ใช้ทั้ง 3 คน
   ```
   User: Wudh
   Password: password123
   Hash: $2a$10$abc... (hash จริง)
   ---
   User: Keeratika
   Password: password123
   Hash: $2a$10$def... (hash จริง)
   ---
   User: Kanokkotchakorn
   Password: password123
   Hash: $2a$10$ghi... (hash จริง)
   ```

4. คัดลอก hash เหล่านี้ไปแทนใน SQL ไฟล์

5. จากนั้นถึงรันใน SQL Editor และคลิก **"Run"** (หรือกด Ctrl/Cmd + Enter)

## ขั้นตอนที่ 4: ตรวจสอบการสร้างตาราง

1. ไปที่เมนู **"Table Editor"**
2. คุณควรเห็นตารางทั้งหมด:
   - users
   - customers
   - daily_records
   - daily_metrics
   - credit_sales

3. คลิกที่ตาราง `users` เพื่อตรวจสอบว่ามีผู้ใช้ 3 คนถูกสร้างแล้ว

## ขั้นตอนที่ 5: คัดลอก API Keys

1. ไปที่เมนู **"Project Settings"** (ไอคอนเฟือง)
2. เลือก **"API"** จากเมนูด้านซ้าย
3. คุณจะเห็น:
   - **Project URL**: ลิงก์ที่ขึ้นต้นด้วย `https://xxx.supabase.co`
   - **anon public key**: key ที่ยาวมาก ๆ

4. คัดลอกทั้งสองค่านี้

## ขั้นตอนที่ 6: ตั้งค่าไฟล์ .env

1. ในโปรเจค สร้างไฟล์ `.env` (ถ้ายังไม่มี):
   ```bash
   cp .env.example .env
   ```

2. เปิดไฟล์ `.env` และแก้ไข:
   ```env
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=bc-petroleum-secret-2026-change-this
   SESSION_SECRET=session-secret-change-this-too
   ```

3. แทนที่:
   - `SUPABASE_URL` = Project URL จาก Supabase
   - `SUPABASE_KEY` = anon public key จาก Supabase
   - `JWT_SECRET` = สร้างสตริงแรนดอม (สำหรับ production ควรยาวและซับซ้อน)
   - `SESSION_SECRET` = สร้างสตริงแรนดอมอีกตัว

## ขั้นตอนที่ 7: ทดสอบการเชื่อมต่อ

1. รัน server:
   ```bash
   npm start
   ```

2. เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

3. ลองเข้าสู่ระบบด้วย:
   - Username: `Wudh`
   - Password: `password123`

4. ถ้าเข้าได้แสดงว่าตั้งค่าสำเร็จ! 🎉

## การตรวจสอบปัญหา

### ไม่สามารถเข้าสู่ระบบได้

1. ตรวจสอบ Console ใน Browser (F12)
2. ตรวจสอบ Terminal ที่รัน server
3. ตรวจสอบว่า password hash ถูกสร้างและใส่ใน SQL ถูกต้อง

### Connection Error

1. ตรวจสอบ SUPABASE_URL และ SUPABASE_KEY ใน `.env`
2. ตรวจสอบว่า Supabase project ยังทำงานอยู่
3. ตรวจสอบ internet connection

### Row Level Security (RLS) Error

ในไฟล์ `database-schema.sql` มีการตั้งค่า RLS policies ให้อนุญาตทุกอย่างสำหรับ development:

```sql
CREATE POLICY "Allow all operations on users" ON users
  FOR ALL USING (true) WITH CHECK (true);
```

สำหรับ production ควรเปลี่ยนเป็นแบบจำกัดสิทธิ์มากขึ้น

## ขั้นตอนที่ 8: เปลี่ยนรหัสผ่าน (สำคัญ!)

หลังจากติดตั้งและทดสอบเสร็จ ควรเปลี่ยนรหัสผ่านทันที:

1. ไปที่ Supabase SQL Editor
2. รันคำสั่ง:
   ```sql
   UPDATE users 
   SET password = '$2a$10$new_hash_here'
   WHERE username = 'Wudh';
   ```
   
   (สร้าง hash ใหม่ด้วย `hash-passwords.js` แต่ใช้รหัสผ่านใหม่)

## เคล็ดลับเพิ่มเติม

### ดูข้อมูลใน Supabase

- ใช้ **Table Editor** เพื่อดูและแก้ไขข้อมูลในตาราง
- ใช้ **SQL Editor** เพื่อรัน query แบบ custom
- ใช้ **Logs** เพื่อดู error logs

### Backup ข้อมูล

Free tier ของ Supabase มี:
- Automatic daily backups (เก็บ 7 วัน)
- Manual backups ผ่าน Supabase Dashboard

### ขีดจำกัด Free Tier

- **Database size**: 500 MB
- **Bandwidth**: 2 GB
- **API requests**: Unlimited

สำหรับปั๊มน้ำมันขนาดเล็ก ควรเพียงพอสำหรับหลายปี

## สรุป Checklist

- [ ] สร้าง Supabase account
- [ ] สร้าง project ใหม่
- [ ] สร้าง password hashes ด้วย `hash-passwords.js`
- [ ] แก้ไข `database-schema.sql` ใส่ hash จริง
- [ ] รัน SQL schema
- [ ] ตรวจสอบตารางถูกสร้าง
- [ ] คัดลอก API keys
- [ ] ตั้งค่า `.env`
- [ ] ทดสอบการเข้าสู่ระบบ
- [ ] เปลี่ยนรหัสผ่าน default

## ติดต่อ Support

- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: สำหรับ bug ของโปรเจคนี้
