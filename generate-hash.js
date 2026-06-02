// Generate Password Hash for BC Petroleum Users
// Usage: node generate-hash.js

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('===========================================');
console.log('BC Petroleum - Password Hash Generator');
console.log('===========================================\n');

rl.question('Enter new password: ', async (password) => {
    if (!password || password.length < 6) {
        console.log('❌ Password must be at least 6 characters!');
        rl.close();
        return;
    }

    try {
        const hash = await bcrypt.hash(password, 10);

        console.log('\n✅ Password hash generated successfully!\n');
        console.log('Password:', password);
        console.log('Hash:', hash);
        console.log('\n===========================================');
        console.log('Copy the SQL below and run in Supabase:');
        console.log('===========================================\n');
        console.log(`-- Update password for a user:`);
        console.log(`UPDATE users SET password = '${hash}' WHERE username = 'Wudh';`);
        console.log(`\n-- Or update all users:`);
        console.log(`UPDATE users SET password = '${hash}';`);
        console.log('\n===========================================\n');

    } catch (error) {
        console.error('❌ Error:', error);
    }

    rl.close();
});
