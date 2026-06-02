# 🚀 คำแนะนำการรันโปรเจค BC Petroleum

## วิธีที่ 1: รันแบบง่าย (ดู UI อย่างเดียว) ✅ ทำแล้ว

เปิดไฟล์ HTML ตรง ๆ ใน browser:
- Login: `file:///Users/wudhboonchan/.gemini/antigravity/scratch/bc-petroleum/public/login.html`
- Dashboard: `file:///Users/wudhboonchan/.gemini/antigravity/scratch/bc-petroleum/public/index.html`
- Daily: `file:///Users/wudhboonchan/.gemini/antigravity/scratch/bc-petroleum/public/daily.html`

**ข้อจำกัด**: ดู UI ได้อย่างเดียว, ปุ่มกดไม่ได้, ไม่มีข้อมูลจริง

---

## วิธีที่ 2: รันแบบเต็มรูปแบบ (มี Backend + Database)

### ขั้นตอนที่ 1: Setup Supabase (ใช้เวลา 5-10 นาที)

1. **สมัครบัญชี Supabase**
   - ไปที่: https://supabase.com
   - สมัครฟรี (ใช้ Gmail หรือ GitHub)

2. **สร้าง Project**
   - คลิก "New Project"
   - ตั้งชื่อ: `bc-petroleum`
   - เลือก Region: `Southeast Asia (Singapore)`
   - ตั้ง Database Password (บันทึกไว้!)
   - คลิก Create

3. **รัน Database Schema**
   ```bash
   # ก่อนอื่นสร้าง password hashes
   cd /Users/wudhboonchan/.gemini/antigravity/scratch/bc-petroleum
   node hash-passwords.js
   ```
   
   - คัดลอกค่า hash ที่ได้
   - เปิดไฟล์ `database-schema.sql`
   - แทนที่ placeholder hashes ด้วย hash จริง
   - ไปที่ Supabase → SQL Editor
   - วาง SQL ทั้งหมด แล้วกด Run

4. **คัดลอก API Keys**
   - ไปที่ Project Settings → API
   - คัดลอก:
     - Project URL
     - anon public key

### ขั้นตอนที่ 2: ตั้งค่า Environment

```bash
# สร้างไฟล์ .env
cp .env.example .env

# แก้ไข .env ใส่ค่าจาก Supabase
nano .env
```

ใส่ค่าดังนี้:
```env
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_KEY=[your-anon-key]
PORT=3000
NODE_ENV=development
JWT_SECRET=bc-petroleum-secret-change-this
SESSION_SECRET=session-secret-change-this
```

### ขั้นตอนที่ 3: รัน Server

```bash
npm start
```

จะเห็น:
```
🚀 BC Petroleum Server running on http://localhost:3000
```

### ขั้นตอนที่ 4: เปิด Browser

```
http://localhost:3000
```

**Login ด้วย**:
- Username: `Wudh`
- Password: `password123`

---

## วิธีที่ 3: รันแบบ Demo (ไม่ต้อง Setup Supabase) 🎯

ถ้าไม่อยากยุ่งยากกับ Supabase ตอนนี้ ให้ใช้ค่า dummy:

```bash
# 1. สร้างไฟล์ .env
cd /Users/wudhboonchan/.gemini/antigravity/scratch/bc-petroleum
cp .env.example .env

# 2. แก้ไข .env ใส่ค่า dummy
cat > .env << 'EOF'
SUPABASE_URL=https://dummy.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy
PORT=3000
NODE_ENV=development
JWT_SECRET=bc-petroleum-demo-secret
SESSION_SECRET=session-demo-secret
EOF

# 3. รัน server
npm start
```

**หมายเหตุ**: วิธีนี้ server จะรันได้ แต่จะ error เวลาเชื่อมต่อ database

---

## 🎯 แนะนำ

- **ถ้าแค่อยากดู UI**: ใช้วิธีที่ 1 (เปิดไฟล์ HTML ตรง ๆ)
- **ถ้าอยากใช้งานจริง**: ใช้วิธีที่ 2 (Setup Supabase เต็มรูปแบบ)
- **ถ้าอยากทดสอบ Server**: ใช้วิธีที่ 3 (ใช้ค่า dummy)

---

## 📚 เอกสารเพิ่มเติม

- **README.md** - คู่มือโปรเจคหลัก
- **SUPABASE_SETUP.md** - วิธีตั้งค่า Supabase แบบละเอียด
- **PROJECT_SUMMARY.md** - สรุปความคืบหน้าโปรเจค

---

## ❓ คำถามที่พบบ่อย

**Q: ทำไม Login ไม่ได้?**
A: ต้อง setup Supabase และรัน database schema ก่อน

**Q: กราฟไม่แสดง?**
A: ต้องมีข้อมูลในฐานข้อมูลก่อน (กรอกข้อมูลรายวัน)

**Q: ราคา Supabase เท่าไหร่?**
A: ฟรี! Free tier ใช้ได้ 500MB database (เพียงพอหลายปี)

**Q: Server error?**
A: ตรวจสอบว่ารัน `npm install` แล้ว และ `.env` ถูกต้อง
