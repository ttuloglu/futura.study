const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'f-study-53ef9',
    storageBucket: 'f-study-53ef9.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const uid = 'NLks437ZrFdzpgeMXGkAykoi8ZL2';
const courseId = 'b2eda634-e8d8-4905-a56a-b4f2335cb1f3';

async function main() {
    console.log('=== Checking Firestore ===');

    // 1. Top-level courses/{courseId}
    const topLevel = await db.collection('courses').doc(courseId).get();
    console.log('\n[1] courses/' + courseId + ' exists:', topLevel.exists);
    if (topLevel.exists) {
        const data = topLevel.data();
        console.log('  topic:', data.topic);
        console.log('  nodes:', Array.isArray(data.nodes) ? data.nodes.length : 'not array (' + typeof data.nodes + ')');
        console.log('  contentPackagePath:', data.contentPackagePath);
        console.log('  keys:', Object.keys(data).join(', '));
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
            const first = data.nodes[0];
            console.log('  first node keys:', Object.keys(first).join(', '));
            console.log('  first node has content:', typeof first.content === 'string' ? 'yes (' + first.content.length + ' chars)' : 'NO');
        }
    }

    // 2. Private users/{uid}/courses/{courseId}
    const privateDoc = await db.collection('users').doc(uid).collection('courses').doc(courseId).get();
    console.log('\n[2] users/' + uid + '/courses/' + courseId + ' exists:', privateDoc.exists);
    if (privateDoc.exists) {
        const data = privateDoc.data();
        console.log('  topic:', data.topic);
        console.log('  nodes:', Array.isArray(data.nodes) ? data.nodes.length : 'not array (' + typeof data.nodes + ')');
        console.log('  sharedCourseId:', data.sharedCourseId);
        console.log('  contentPackagePath:', data.contentPackagePath);
        console.log('  keys:', Object.keys(data).join(', '));
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
            const first = data.nodes[0];
            console.log('  first node keys:', Object.keys(first).join(', '));
            console.log('  first node has content:', typeof first.content === 'string' ? 'yes (' + first.content.length + ' chars)' : 'NO');
        }
    }

    // 3. Check Storage
    const packagePath = 'smartbooks/' + uid + '/' + courseId + '/package.json';
    console.log('\n[3] Storage:', packagePath);
    try {
        const [exists] = await bucket.file(packagePath).exists();
        console.log('  exists:', exists);
        if (exists) {
            const [buffer] = await bucket.file(packagePath).download();
            const parsed = JSON.parse(buffer.toString('utf8'));
            console.log('  nodes:', Array.isArray(parsed.nodes) ? parsed.nodes.length : 'not array');
            console.log('  keys:', Object.keys(parsed).join(', '));
        }
    } catch (e) {
        console.log('  error:', e.message);
    }

    // 4. CollectionGroup query
    console.log('\n[4] CollectionGroup for sharedCourseId=' + courseId);
    const groupSnap = await db.collectionGroup('courses').where('sharedCourseId', '==', courseId).limit(3).get();
    console.log('  found:', groupSnap.size, 'docs');
    groupSnap.forEach(doc => {
        const data = doc.data();
        console.log('  doc:', doc.ref.path, 'nodes:', Array.isArray(data.nodes) ? data.nodes.length : 'none');
    });

    // 5. List user's top-level AND private courses
    console.log('\n[5] All courses for user', uid);
    const allTopLevel = await db.collection('courses').where('userId', '==', uid).limit(10).get();
    console.log('  top-level:', allTopLevel.size);
    allTopLevel.forEach(doc => {
        const d = doc.data();
        console.log('  -', doc.id, d.topic, 'nodes:', Array.isArray(d.nodes) ? d.nodes.length : 'none');
    });

    const allPrivate = await db.collection('users').doc(uid).collection('courses').limit(10).get();
    console.log('  private:', allPrivate.size);
    allPrivate.forEach(doc => {
        const d = doc.data();
        console.log('  -', doc.id, d.topic, 'nodes:', Array.isArray(d.nodes) ? d.nodes.length : 'none', 'shared:', d.sharedCourseId);
    });

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
