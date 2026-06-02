# BC Petroleum - ระบบจัดการปั๊มน้ำมัน

เว็บแอพพลิเคชันสำหรับจัดการธุรกิจปั๊มน้ำมันขนาดเล็ก สำหรับ **บีซี ปิโตรเลียม**

## 🌟 คุณสมบัติหลัก

- **ระบบ Login/Authentication** - ระบบเข้าสู่ระบบที่ปลอดภัยด้วย JWT
- **แดชบอร์ด** - แสดงภาพรวมยอดขาย กำไร และสถิติต่างๆ พร้อมกราฟ
- **จัดการรายวัน** - บันทึกเลขมิเตอร์จากหัวจ่ายทั้ง 8 หัว และราคาน้ำมัน
- **จัดการเงินเชื่อ** - บันทึกและติดตามยอดขายเชื่อลูกค้าประจำ
- **จัดการลูกค้า** - CRUD ข้อมูลลูกค้าและดูประวัติการซื้อ
- **รายงาน** - สร้างรายงานหลากหลายประเภทพร้อม Export PDF
- **Responsive Design** - ใช้งานได้ทั้งคอมพิวเตอร์ แท็บเล็ต และมือถือ

## 🛠 เทคโนโลยีที่ใช้

### Backend
- Node.js
- Express.js
- Supabase (PostgreSQL)
- JWT Authentication
- bcrypt (Password hashing)

### Frontend
- HTML5
- CSS3 (Chakra Petch Font)
- Vanilla JavaScript
- Chart.js (สำหรับกราฟ)

## 📋 ข้อกำหนดเบื้องต้น

- Node.js (v14 ขึ้นไป)
- npm หรือ yarn
- บัญชี Supabase (ฟรี)

## 🚀 การติดตั้ง

### 1. Clone หรือ Download โปรเจค

```bash
cd bc-petroleum
```

### 2. ติดตั้ง Dependencies

```bash
npm install --cache /tmp/.npm
```

### 3. ตั้งค่า Supabase

1. สร้างโปรเจคใหม่ที่ [Supabase](https://supabase.com)
2. ในหน้า SQL Editor ให้รันไฟล์ `database-schema.sql`
3. คัดลอก URL และ anon key จาก Project Settings

### 4. สร้างไฟล์ .env

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here
```

### 5. สร้าง Password Hashes

รันสคริปต์เพื่อสร้าง password hashes:

```bash
node hash-passwords.js
```

คัดลอก hashes ที่ได้ไปแทนในไฟล์ `database-schema.sql` แล้วรันใน Supabase SQL Editor อีกครั้ง

### 6. เริ่มต้น Server

```bash
node server.js
```

หรือใช้ nodemon สำหรับ development:

```bash
npm install -g nodemon
nodemon server.js
```

Server จะทำงานที่: `http://localhost:3000`

## 👥 ผู้ใช้เริ่มต้น

| Username | Password | Role |
|----------|----------|------|
| Wudh | password123 | admin |
| Keeratika | password123 | user |
| Kanokkotchakorn | password123 | user |

⚠️ **สำคัญ**: เปลี่ยนรหัสผ่านทันทีหลังจากติดตั้งครั้งแรก!

## 📊 โครงสร้างฐานข้อมูล

### Tables
- `users` - ข้อมูลผู้ใช้งาน
- `customers` - ข้อมูลลูกค้า
- `daily_records` - บันทึกเลขมิเตอร์รายวัน (ข้อมูลดิบ)
- `daily_metrics` - ข้อมูลที่คำนวณแล้ว (ยอดขาย กำไร)
- `credit_sales` - รายการขายเชื่อ

## 🎨 การออกแบบ

- **ฟอนต์**: Chakra Petch (Google Fonts)
- **สีประจำน้ำมัน**:
  - E91: สีชมพู (#FF6B9D)
  - E95: สีเขียวน้ำทะเล (#4ECDC4)
  - B7: สีฟ้า (#45B7D1)
- **ธีมหลัก**: Modern, Clean, Gradient effects
- **Responsive**: Mobile-first design

## 📁 โครงสร้างโปรเจค

```
bc-petroleum/
├── config/
│   └── supabase.js          # Supabase configuration
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── dashboard.js         # Dashboard API
│   ├── daily.js             # Daily management API
│   ├── credit.js            # Credit sales API
│   ├── customer.js          # Customer API
│   └── report.js            # Report API
├── public/
│   ├── css/
│   │   └── style.css        # Main stylesheet
│   ├── js/
│   │   ├── utils.js         # Utility functions
│   │   └── daily.js         # Daily page script
│   ├── index.html           # Dashboard page
│   ├── login.html           # Login page
│   ├── daily.html           # Daily management page
│   ├── credit.html          # Credit sales page (to be created)
│   ├── customers.html       # Customers page (to be created)
│   └── reports.html         # Reports page (to be created)
├── server.js                # Main server file
├── database-schema.sql      # Database schema
├── hash-passwords.js        # Password hasher utility
├── .env.example             # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## 🔒 ความปลอดภัย

- รหัสผ่านถูก hash ด้วย bcrypt
- JWT สำหรับ session management
- HTTP-only cookies
- Row Level Security (RLS) ใน Supabase
- Input validation

## 📝 การใช้งาน

### หน้าจัดการรายวัน
1. กรอกราคาน้ำมัน (ระบบจะดึงข้อมูลจากเมื่อวานมาให้อัตโนมัติ)
2. กรอกเลขมิเตอร์วันนี้สำหรับหัวจ่ายทั้ง 8 หัว
3. ระบบจะแจ้งเตือนถ้าค่าผิดปกติ (น้อยกว่าหรือเท่ากับเมื่อวาน)
4. กดยืนยันส่งข้อมูล
5. ดูสรุปยอดขาย กำไร และปริมาณที่คำนวณอัตโนมัติ

### หน้าจัดการเงินเชื่อ
1. เลือกลูกค้าจาก dropdown
2. กรอกข้อมูลบิล (เล่มที่ เลขที่ ยอดเงิน)
3. กรอกทะเบียนรถ (ถ้ามี)
4. กรอกหมายเหตุ (กรณีลูกค้ารายย่อย)
5. ดูตารางสรุปเงินเชื่อวันนี้
6. กรองและดูประวัติการขายเชื่อแบบละเอียด

### หน้ารายงาน
1. เลือกประเภทรายงาน
2. ตั้งค่าฟิลเตอร์ (วันที่ ลูกค้า ประเภทน้ำมัน ฯลฯ)
3. กดสร้างรายงาน
4. Export เป็น PDF

## 🐛 การแก้ไขปัญหา

### ปัญหา npm install
```bash
# ใช้ temporary cache
npm install --cache /tmp/.npm
```

### ปัญหาการเชื่อมต่อ Supabase
- ตรวจสอบ SUPABASE_URL และ SUPABASE_KEY ใน `.env`
- ตรวจสอบว่ารัน SQL schema แล้ว
- ตรวจสอบ RLS policies

### ปัญหา Login
- ตรวจสอบว่าสร้าง password hashes แล้ว
- ตรวจสอบ JWT_SECRET ใน `.env`
- ลบ cookies และลองใหม่

## 📞 ข้อมูลติดต่อ

**บีซี ปิโตรเลียม**
- ที่อยู่: 40 ม.6 ต.เตาปูน อ.แก่งคอย จ.สระบุรี 18110
- โทร: 096-236-9153

## 📄 License

This project is proprietary software for BC Petroleum.

## 🔄 การพัฒนาต่อ

ส่วนที่ยังไม่เสร็จ (ต้องสร้างเพิ่ม):
- [ ] หน้าจัดการเงินเชื่อ (credit.html + credit.js)
- [ ] หน้าจัดการลูกค้า (customers.html + customers.js)
- [ ] หน้ารายงาน (reports.html + reports.js)
- [ ] ฟังก์ชัน Export PDF (ใช้ jsPDF หรือ PDFKit)
- [ ] Mobile menu toggle
- [ ] การแจ้งเตือนผ่าน Email/LINE
- [ ] Backup อัตโนมัติ

## 🎯 Version

- **Current**: 1.0.0
- **Last Updated**: January 2026
