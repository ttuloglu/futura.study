const admin = require('firebase-admin');

// Initialize Firebase Admin (adjust path as needed)
try {
    admin.initializeApp();
} catch (e) { }

const bucket = admin.storage().bucket();
const path = 'smartbooks/NLks437ZrFdzpgeMXGkAykoi8ZL2/b2eda634-e8d8-4905-a56a-b4f2335cb1f3/package.json';

async function main() {
    try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (!exists) {
            console.log(`File does not exist: ${path}`);
            return;
        }
        const [content] = await file.download();
        const data = JSON.parse(content.toString('utf8'));
        console.log('--- PACKAGE.JSON DUMP ---');
        console.log(`nodes length: ${Array.isArray(data.nodes) ? data.nodes.length : 'not an array'}`);
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
