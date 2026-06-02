# 📋 คำแนะนำสำหรับรัน SQL ใน Supabase

## ขั้นตอนที่ 1: เปิด Supabase SQL Editor

1. เข้าสู่ Supabase Dashboard: https://supabase.com/dashboard
2. เลือกโปรเจค: `bc-petroleum` (หรือชื่อที่คุณตั้ง)
3. คลิกเมนู **"SQL Editor"** ทางด้านซ้าย
4. คลิกปุ่ม **"+ New query"**

## ขั้นตอนที่ 2: คัดลอก SQL Schema

1. เปิดไฟล์ `database-schema.sql` ในโปรเจค
2. คัดลอกเนื้อหา **ทั้งหมด** (243 บรรทัด)
3. วางใน SQL Editor ของ Supabase

## ขั้นตอนที่ 3: รัน SQL

1. คลิกปุ่ม **"Run"** (หรือกด Ctrl/Cmd + Enter)
2. รอไม่กี่วินาที
3. ถ้าสำเร็จจะเห็นข้อความ "Success"

## ขั้นตอนที่ 4: ตรวจสอบตาราง

1. ไปที่เมนู **"Table Editor"** ทางด้านซ้าย
2. คุณควรเห็นตารางทั้งหมด 5 ตาราง:
   - ✅ users (ผู้ใช้ 3 คน)
   - ✅ customers (ลูกค้า 3 ราย)
   - ✅ daily_records (ข้อมูลตัวอย่าง 1 วัน)
   - ✅ daily_metrics (ว่างเปล่า)
   - ✅ credit_sales (ว่างเปล่า)

3. คลิกที่ตาราง `users` เพื่อดูผู้ใช้ที่สร้างไว้

## ✅ เสร็จแล้ว!

หลังจากรัน SQL เรียบร้อย:
- ฐานข้อมูลพร้อมใช้งาน
- มีผู้ใช้ 3 คน: Wudh (admin), Keeratika, Kanokkotchakorn
- Password ทั้งหมด: `password123`
- มีข้อมูลตัวอย่างเพื่อทดสอบ

---

## 🔍 หากเกิดข้อผิดพลาด

### Error: relation "users" already exists
แปลว่า: ตารางถูกสร้างไปแล้ว ไม่ต้องกังวล SQL จะข้ามไปโดยอัตโนมัติ

### Error: duplicate key value
แปลว่า: ข้อมูลซ้ำ (เช่น username ซ้ำ) ไม่ต้องกังวล มี `ON CONFLICT DO NOTHING`

### Error อื่น ๆ
ให้คัดลอกข้อความ error มาเช็คครับ
