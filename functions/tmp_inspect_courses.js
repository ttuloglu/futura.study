const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
try { initializeApp({ credential: applicationDefault() }); } catch {}
const db = getFirestore();
const auth = getAuth();
(async () => {
  const uids = ['NLks437ZrFdzpgeMXGkAykoi8ZL2','4uJ9uUi2zuWVmbih8jlBi6LagEE2'];
  for (const uid of uids) {
    console.log(`UID ${uid}`);
    try {
      const user = await auth.getUser(uid);
      console.log(' auth exists', user.email || user.uid, 'anon=', user.providerData.length === 0);
    } catch (e) {
      console.log(' auth missing');
    }
    const snap = await db.collection('users').doc(uid).collection('courses').get();
    console.log(' course docs', snap.size);
    const rows = [];
    snap.forEach(doc => {
      const data = doc.data();
      const json = JSON.stringify(data);
      const nodes = Array.isArray(data.nodes) ? data.nodes.length : 0;
      const contentNodes = Array.isArray(data.contentNodes) ? data.contentNodes.length : 0;
      rows.push({
        id: doc.id,
        topic: data.topic || data.bookTitle || data.title || '',
        bytes: Buffer.byteLength(json, 'utf8'),
        nodes,
        contentNodes,
        cover: typeof data.coverImageUrl === 'string' ? data.coverImageUrl.slice(0,30) : null,
      });
    });
    rows.sort((a,b)=>b.bytes-a.bytes);
    console.log(rows.slice(0,10));
  }
})();
