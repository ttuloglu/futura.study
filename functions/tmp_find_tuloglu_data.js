const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
try { initializeApp({ credential: applicationDefault() }); } catch {}
const db = getFirestore();
const auth = getAuth();
(async () => {
  const email = 'ttuloglu@gmail.com';
  try {
    const user = await auth.getUserByEmail(email);
    console.log('AUTH USER', { uid: user.uid, email: user.email, providers: user.providerData.map(p => p.providerId) });
  } catch (e) {
    console.log('AUTH LOOKUP FAILED', e.message);
  }

  const usersSnap = await db.collection('users').limit(500).get();
  const matches = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const emailFields = [data.email, data.mail, data.userEmail, data.ownerEmail].filter(Boolean).map(String);
    if (emailFields.some(v => v.toLowerCase() === email)) {
      const coursesSnap = await doc.ref.collection('courses').get();
      matches.push({ id: doc.id, emails: emailFields, courseDocs: coursesSnap.size, keys: Object.keys(data).slice(0,20) });
    }
  }
  console.log('USER DOC EMAIL MATCHES', matches);

  const topCourses = await db.collection('courses').where('creatorName', '==', 'Turgay TÜLOĞLU').limit(20).get().catch(() => null);
  if (topCourses) {
    console.log('TOP COURSES BY CREATOR', topCourses.docs.slice(0,5).map(d => ({id:d.id, userId:d.get('userId'), topic:d.get('topic')||d.get('bookTitle')||d.get('title')})));
  }

  const allUsers = await db.collection('users').limit(500).get();
  const usersWithCourses = [];
  for (const doc of allUsers.docs) {
    const coursesSnap = await doc.ref.collection('courses').limit(1).get();
    if (!coursesSnap.empty) {
      const userData = doc.data() || {};
      usersWithCourses.push({
        uid: doc.id,
        email: userData.email || userData.mail || userData.userEmail || null,
        displayName: userData.displayName || userData.name || null,
      });
    }
  }
  console.log('USERS WITH COURSE SUBCOLLECTIONS', usersWithCourses.slice(0,50));

  const sampleUids = usersWithCourses.map(x => x.uid).slice(0,20);
  for (const uid of sampleUids) {
    const count = (await db.collection('users').doc(uid).collection('courses').get()).size;
    console.log('COURSE COUNT', uid, count);
  }
})();
