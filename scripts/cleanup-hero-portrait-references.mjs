#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');

const CONFIRM_FLAG = '--confirm-delete-hero-portraits';
const shouldDelete = process.argv.includes(CONFIRM_FLAG);
const bucketArg = process.argv.find((arg) => arg.startsWith('--bucket='));
const bucketName = bucketArg?.replace('--bucket=', '').trim() || process.env.FIREBASE_STORAGE_BUCKET || '';

if (!bucketName) {
  console.error('Missing bucket. Pass --bucket=<firebase-storage-bucket> or set FIREBASE_STORAGE_BUCKET.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: bucketName
  });
}

const bucket = admin.storage().bucket(bucketName);
const [files] = await bucket.getFiles({ prefix: 'smartbooks/' });
const portraitFiles = files.filter((file) => /\/references\/hero-portrait\.[a-z0-9]+$/i.test(file.name));

console.log(JSON.stringify({
  bucket: bucketName,
  mode: shouldDelete ? 'delete' : 'dry-run',
  count: portraitFiles.length,
  sample: portraitFiles.slice(0, 20).map((file) => file.name)
}, null, 2));

if (!shouldDelete) {
  console.log(`Dry run only. Re-run with ${CONFIRM_FLAG} to delete these objects.`);
  process.exit(0);
}

for (const file of portraitFiles) {
  await file.delete().catch((error) => {
    if (Number(error?.code) === 404) return undefined;
    throw error;
  });
  console.log(`deleted ${file.name}`);
}
