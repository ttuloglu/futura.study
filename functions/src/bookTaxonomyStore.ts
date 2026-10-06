import { createHash } from 'node:crypto';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { mergeBookTaxonomy, taxonomyKey, type BookClassification } from './bookTaxonomy';

export async function loadBookTaxonomy(db: Firestore = getFirestore()): Promise<BookClassification[]> {
  const snapshot = await db.collection('bookTaxonomy').get();
  return mergeBookTaxonomy(snapshot.docs.map(doc => doc.data() as BookClassification));
}
export async function rememberBookClassification(classification: BookClassification, db: Firestore = getFirestore()): Promise<void> {
  const key = JSON.stringify([classification.bookType, taxonomyKey(classification.genre), taxonomyKey(classification.subGenre)]);
  const id = createHash('sha256').update(key).digest('hex');
  const ref = db.collection('bookTaxonomy').doc(id);
  await db.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    // Never overwrite canonical spelling established by an earlier plan.
    if (!previous.exists) transaction.create(ref, { ...classification, createdAt: FieldValue.serverTimestamp() });
  });
}
