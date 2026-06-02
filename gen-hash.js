// Simple Password Hash Generator
const bcrypt = require('bcryptjs');

// รับ password จาก command line argument
const password = process.argv[2];

if (!password) {
    console.log('\n❌ กรุณาใส่รหัสผ่านที่ต้องการ!\n');
    console.log('วิธีใช้:');
    console.log('  node gen-hash.js รหัสผ่านใหม่\n');
    console.log('ตัวอย่าง:');
    console.log('  node gen-hash.js mypassword123\n');
    process.exit(1);
}

if (password.length < 6) {
    console.log('\n❌ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!\n');
    process.exit(1);
}

console.log('\n🔐 กำลัง generate password hash...\n');

const hash = bcrypt.hashSync(password, 10);

console.log('✅ สำเร็จ!\n');
console.log('Password:', password);
console.log('Hash:', hash);
console.log('\n========================================');
console.log('คัดลอก SQL ด้านล่างนี้ไปรันใน Supabase:');
console.log('========================================\n');
console.log(`-- เปลี่ยนรหัสผ่าน Wudh (admin)`);
console.log(`UPDATE users SET password = '${hash}' WHERE username = 'Wudh';\n`);
console.log(`-- เปลี่ยนรหัสผ่าน Keeratika`);
console.log(`UPDATE users SET password = '${hash}' WHERE username = 'Keeratika';\n`);
console.log(`-- เปลี่ยนรหัสผ่าน Kanokkotchakorn`);
console.log(`UPDATE users SET password = '${hash}' WHERE username = 'Kanokkotchakorn';\n`);
console.log(`-- หรือเปลี่ยนทุกคน`);
console.log(`UPDATE users SET password = '${hash}';\n`);
console.log('========================================\n');
