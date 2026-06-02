// Password Hasher Utility
// Run this script to generate bcrypt hashes for passwords
// Usage: node hash-passwords.js

const bcrypt = require('bcryptjs');

const users = [
    { username: 'Wudh', password: 'password123' },
    { username: 'Keeratika', password: 'password123' },
    { username: 'Kanokkotchakorn', password: 'password123' },
];

async function hashPasswords() {
    console.log('Generating password hashes...\n');

    for (const user of users) {
        const hash = await bcrypt.hash(user.password, 10);
        console.log(`User: ${user.username}`);
        console.log(`Password: ${user.password}`);
        console.log(`Hash: ${hash}`);
        console.log('---');
    }

    console.log('\nCopy the hashes above and update the INSERT INTO users statement in database-schema.sql');
    console.log('\n⚠️  IMPORTANT: Change these default passwords in production!');
}

hashPasswords().catch(console.error);
