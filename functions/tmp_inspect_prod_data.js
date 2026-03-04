const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const PROJECT_ID = 'f-study-53ef9';
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.firebasestorage.app` });
}
const db = getFirestore();
const auth = getAuth();
(async () => {
  console.log('PROJECT', PROJECT_ID);
  try {
    const user = await auth.getUserByEmail('ttuloglu@gmail.com');
    console.log('AUTH USER', { uid: user.uid, email: user.email, providers: user.providerData.map(p => p.providerId) });
  } catch (e) {
    console.log('AUTH LOOKUP FAILED', e.message);
  }
  const topSnap = await db.collection('courses').limit(20).get();
  console.log('TOP-LEVEL COURSES SAMPLE', topSnap.size);
  console.log(topSnap.docs.slice(0,10).map(d => ({id:d.id, userId:d.get('userId'), topic:d.get('topic')||d.get('bookTitle')||d.get('title'), keys:Object.keys(d.data()).slice(0,12)})));
  const userDoc = await db.collection('users').doc('4uJ9uUi2zuWVmbih8jlBi6LagEE2').get();
  console.log('CURRENT USER DOC EXISTS', userDoc.exists, userDoc.data()?.email);
  const currentCourses = await db.collection('users').doc('4uJ9uUi2zuWVmbih8jlBi6LagEE2').collection('courses').get();
  console.log('CURRENT USER SUBCOURSES', currentCourses.size);
  const groupSnap = await db.collectionGroup('courses').limit(20).get();
  console.log('COLLECTION GROUP SAMPLE', groupSnap.size);
  console.log(groupSnap.docs.slice(0,20).map(d => ({path:d.ref.path, userId:d.get('userId'), sharedCourseId:d.get('sharedCourseId'), topic:d.get('topic')||d.get('bookTitle')||d.get('title'), keys:Object.keys(d.data()).slice(0,10)})));
})();
