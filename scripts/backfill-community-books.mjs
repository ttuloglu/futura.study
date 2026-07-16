#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const JSZip = require('jszip');

const PROJECT_ID = 'f-study-53ef9';
const STORAGE_BUCKET = 'f-study-53ef9.firebasestorage.app';
const COMMUNITY_TERMS_VERSION = '2026-07-15';
const MIGRATION_SOURCE = 'legacy-user-books-2026-07-15';
const EXECUTE = process.argv.includes('--execute');
const CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.BACKFILL_CONCURRENCY || 3)));

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
const firestore = getFirestore();
const bucket = getStorage().bucket(STORAGE_BUCKET);

function text(value, maxLength = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function normalizeSearch(value) {
  return text(value, 5_000)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKeywords(...values) {
  const normalized = normalizeSearch(values.map((value) => text(value, 1_000)).join(' '));
  const keywords = new Set();
  for (const token of normalized.split(' ').filter((item) => item.length >= 2).slice(0, 80)) {
    keywords.add(token);
    for (let length = 2; length <= Math.min(token.length, 16); length += 1) keywords.add(token.slice(0, length));
  }
  return Array.from(keywords).slice(0, 400);
}

function communityBookIdFor(uid, bookId) {
  return createHash('sha256').update(`${uid}:${bookId}`).digest('hex').slice(0, 40);
}

function automaticAlias(uid) {
  return `Fortale-${createHash('sha256').update(uid).digest('hex').slice(0, 12)}`;
}

function validAlias(value) {
  const alias = text(value, 32);
  return alias.length >= 2 && alias.length <= 32 && /^[\p{L}\p{N}][\p{L}\p{N}._ -]*$/u.test(alias);
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return Buffer.from(value.bytesValue, 'base64');
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

function accessToken() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

async function listLegacyBooks() {
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'books', allDescendants: true }] } })
        }
      );
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  if (!response) throw lastError || new Error('Firestore inventory request failed.');
  if (!response.ok) throw new Error(`Firestore inventory failed (${response.status}): ${await response.text()}`);
  const rows = await response.json();
  return rows
    .map((row) => row.document)
    .filter(Boolean)
    .map((document) => {
      const match = document.name.match(/\/users\/([^/]+)\/books\/([^/]+)$/);
      if (!match) return null;
      return {
        uid: match[1],
        bookId: match[2],
        data: decodeFirestoreFields(document.fields),
        createTime: new Date(document.createTime),
        updateTime: new Date(document.updateTime)
      };
    })
    .filter(Boolean);
}

function readableNodes(manifest) {
  return (Array.isArray(manifest.nodes) ? manifest.nodes : [])
    .map((node) => ({
      id: text(node?.id, 120),
      title: text(node?.title, 200),
      content: typeof (node?.content || node?.pageText || node?.podcastScript) === 'string'
        ? (node.content || node.pageText || node.podcastScript).trim().slice(0, 18_000)
        : ''
    }))
    .filter((node) => node.content.length > 0);
}

function contentType(path) {
  const lower = path.toLowerCase();
  if (/\.jpe?g$/.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

function extension(path) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#)?$/);
  const ext = match?.[1] || 'png';
  if (ext === 'jpeg') return 'jpg';
  return ['png', 'jpg', 'webp', 'gif', 'svg'].includes(ext) ? ext : 'png';
}

function downloadUrl(storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function savePublicImage(buffer, sourcePath, storagePathBase) {
  const ext = extension(sourcePath);
  const storagePath = `${storagePathBase}.${ext}`;
  const token = randomUUID();
  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    contentType: contentType(sourcePath),
    metadata: { cacheControl: 'public,max-age=86400', metadata: { firebaseStorageDownloadTokens: token } }
  });
  return { storagePath, url: downloadUrl(storagePath, token) };
}

function dataUrlAsset(source) {
  const match = source.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) return null;
  const mime = match[1] || 'image/png';
  const isBase64 = source.slice(0, source.indexOf(',')).includes(';base64');
  const buffer = isBase64 ? Buffer.from(match[2], 'base64') : Buffer.from(decodeURIComponent(match[2]));
  const ext = mime.includes('jpeg') ? 'jpg' : mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
  return { buffer, sourcePath: `cover.${ext}` };
}

async function resolveCover(zip, manifest, book) {
  const candidates = [
    book?.cover?.path,
    manifest?.cover?.path,
    manifest?.coverPath,
    'assets/cover.png',
    'assets/cover.jpg',
    'assets/cover.jpeg',
    'cover.png',
    'cover.jpg'
  ].map((item) => text(item, 2_000)).filter(Boolean);
  for (const path of candidates) {
    const file = zip.file(path.replace(/^\/+/, ''));
    if (file) return { buffer: await file.async('nodebuffer'), sourcePath: path };
  }
  const dataSource = text(book?.coverImageUrl || book?.cover?.url || manifest?.cover?.url, 20_000_000);
  if (dataSource.startsWith('data:')) return dataUrlAsset(dataSource);
  return null;
}

async function extractPreviewImages(zip, manifest, communityBookId, version, coverSourcePath) {
  const candidates = [];
  const nodes = Array.isArray(manifest.nodes) ? manifest.nodes : [];
  for (const node of nodes) {
    const sourcePath = [node?.pageImageUrl, node?.imageUrl, node?.illustrationUrl, node?.imagePath, node?.assetPath]
      .map((item) => text(item, 2_000)).find(Boolean);
    if (sourcePath) candidates.push({ sourcePath, title: text(node?.title, 120) || 'İçerik görseli' });
  }
  for (const fileName of Object.keys(zip.files)) {
    if (/^assets\/images\/.+\.(png|jpe?g|webp|gif)$/i.test(fileName)) {
      const related = nodes.find((node) => typeof node?.id === 'string' && fileName.includes(node.id));
      candidates.push({ sourcePath: fileName, title: text(related?.title, 120) || 'İçerik görseli' });
    }
  }
  const coverPath = text(coverSourcePath, 2_000).replace(/^\/+/, '');
  const seen = new Set();
  const images = [];
  for (const candidate of candidates) {
    const sourcePath = candidate.sourcePath.replace(/^\/+/, '');
    if (images.length >= 2 || seen.has(sourcePath) || sourcePath === coverPath || /(?:^|\/)cover\.(png|jpe?g|webp)$/i.test(sourcePath)) continue;
    seen.add(sourcePath);
    const file = zip.file(sourcePath);
    if (!file) continue;
    const buffer = await file.async('nodebuffer');
    if (!buffer.length) continue;
    const saved = await savePublicImage(buffer, sourcePath, `communityImages/${communityBookId}/v${version}/${images.length + 1}`);
    images.push({
      id: `preview-image-${images.length + 1}`,
      title: candidate.title,
      url: saved.url,
      storagePath: saved.storagePath,
      sourcePath: candidate.sourcePath
    });
  }
  return images;
}

async function ensureProfile(uid) {
  const profileRef = firestore.collection('communityProfiles').doc(uid);
  const userRef = firestore.collection('users').doc(uid);
  const [profileSnap, userSnap] = await Promise.all([profileRef.get(), userRef.get()]);
  const existing = profileSnap.exists ? profileSnap.data() : {};
  const user = userSnap.exists ? userSnap.data() : {};
  const alias = validAlias(existing.alias) ? text(existing.alias, 32) : automaticAlias(uid);
  const aliasLower = normalizeSearch(alias);
  const now = Timestamp.now();
  const acceptedAt = user?.legalConsentAcceptedAt || existing.termsAcceptedAt || now;
  const next = {
    userId: uid,
    alias,
    aliasLower,
    bio: text(existing.bio, 160),
    ageConfirmedAt: existing.ageConfirmedAt || acceptedAt,
    termsAcceptedAt: acceptedAt,
    termsVersion: COMMUNITY_TERMS_VERSION,
    followerCount: Number(existing.followerCount) || 0,
    followingCount: Number(existing.followingCount) || 0,
    publicationCount: Number(existing.publicationCount) || 0,
    totalLikeCount: Number(existing.totalLikeCount) || 0,
    totalDownloadCount: Number(existing.totalDownloadCount) || 0,
    isSuspended: existing.isSuspended === true,
    createdAt: existing.createdAt || acceptedAt,
    updatedAt: now,
    migrationSource: MIGRATION_SOURCE
  };
  if (EXECUTE) {
    await profileRef.set(next, { merge: true });
    const aliasId = createHash('sha256').update(aliasLower).digest('hex');
    await firestore.collection('communityAliases').doc(aliasId).set({ userId: uid, alias, updatedAt: now }, { merge: true });
  }
  return next;
}

async function migrateBook(item, profile) {
  const { uid, bookId, data: book } = item;
  const communityBookId = communityBookIdFor(uid, bookId);
  const communityRef = firestore.collection('communityBooks').doc(communityBookId);
  const existingSnap = await communityRef.get();
  const existing = existingSnap.exists ? existingSnap.data() : null;
  if (existing?.status === 'published') return { status: 'skipped', uid, bookId, communityBookId };

  const bundlePath = text(book?.bundle?.path || book?.contentPackagePath, 2_000);
  if (text(book?.status, 40) !== 'ready' || !bundlePath) return { status: 'ineligible', uid, bookId, reason: 'not-ready-or-no-bundle' };
  if (!EXECUTE) return { status: 'eligible', uid, bookId, communityBookId, bundlePath };

  const [exists] = await bucket.file(bundlePath).exists();
  if (!exists) throw new Error(`Bundle not found: ${bundlePath}`);
  const [bundleBuffer] = await bucket.file(bundlePath).download();
  const zip = await JSZip.loadAsync(bundleBuffer);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error(`Invalid bundle, manifest.json missing: ${bundlePath}`);
  const manifest = JSON.parse(await manifestFile.async('string'));
  const nodes = readableNodes(manifest);
  const title = text(manifest.title || book.title || book.topic, 180) || 'Untitled';
  const description = text(manifest.description || book.description, 1_000);
  const version = Math.max(1, Number(existing?.snapshotVersion || 0) + 1);
  const snapshotPath = `communityPackages/${communityBookId}/v${version}/book.zip`;
  await bucket.file(snapshotPath).save(bundleBuffer, {
    resumable: false,
    contentType: 'application/zip',
    metadata: { cacheControl: 'private,max-age=0', metadata: { ownerId: uid, communityBookId, migrationSource: MIGRATION_SOURCE } }
  });

  let coverImageUrl = text(existing?.coverImageUrl, 20_000);
  let coverStoragePath = text(existing?.coverStoragePath, 2_000);
  const cover = await resolveCover(zip, manifest, book);
  if (cover?.buffer?.length) {
    const saved = await savePublicImage(cover.buffer, cover.sourcePath, `communityCovers/${communityBookId}/v${version}/cover`);
    coverImageUrl = saved.url;
    coverStoragePath = saved.storagePath;
  }
  const previewImages = await extractPreviewImages(zip, manifest, communityBookId, version, cover?.sourcePath || book?.cover?.path);

  const now = Timestamp.now();
  const bookType = text(manifest.bookType || book.bookType, 40) || 'story';
  const subGenre = text(manifest.subGenre || book.subGenre, 120);
  const category = text(manifest.category || book.category, 120);
  const language = text(manifest.language || book.language, 80);
  const ageGroup = text(manifest.ageGroup || book.ageGroup || book?.creativeBrief?.workbookLevel, 80);
  const rawTags = Array.isArray(manifest.searchTags) ? manifest.searchTags : (Array.isArray(book.searchTags) ? book.searchTags : []);
  const tags = rawTags.map((tag) => text(tag, 60)).filter(Boolean).slice(0, 20);
  const publishedAtDate = book.createdAt instanceof Date ? book.createdAt : item.createTime;
  const publishedAt = Timestamp.fromDate(Number.isNaN(publishedAtDate.getTime()) ? new Date() : publishedAtDate);
  const communityDoc = {
    userId: uid,
    bookId,
    title,
    description,
    publisherAlias: profile.alias,
    coverImageUrl,
    coverStoragePath,
    bookType,
    subGenre,
    category,
    ageGroup,
    language,
    searchText: normalizeSearch([title, profile.alias, category, subGenre, tags.join(' ')].join(' ')),
    searchKeywords: buildKeywords(title, profile.alias, category, subGenre, tags.join(' ')),
    tags,
    pageCount: Number(manifest.targetPageCount || book.targetPageCount) || nodes.length,
    outline: nodes.map((node) => node.title).filter(Boolean).slice(0, 40),
    preview: nodes.slice(0, 2),
    previewImages,
    snapshotPath,
    snapshotVersion: version,
    status: 'published',
    moderationStatus: 'approved',
    downloadCount: Number(existing?.downloadCount) || 0,
    likeCount: Number(existing?.likeCount) || 0,
    commentCount: Number(existing?.commentCount) || 0,
    reportCount: Number(existing?.reportCount) || 0,
    hotScore: Number(existing?.hotScore) || 0,
    isFeatured: existing?.isFeatured === true,
    publishedAt: existing?.publishedAt || publishedAt,
    updatedAt: now,
    autoPublished: true,
    migrationSource: MIGRATION_SOURCE
  };
  const bookRef = firestore.collection('users').doc(uid).collection('books').doc(bookId);
  await firestore.runTransaction(async (tx) => {
    tx.set(communityRef, communityDoc);
    tx.set(bookRef, {
      communityPublication: { id: communityBookId, status: 'published', updatedAt: now },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { status: 'published', uid, bookId, communityBookId, title };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { status: 'failed', uid: items[index].uid, bookId: items[index].bookId, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  console.log(`[community-backfill] mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} project=${PROJECT_ID}`);
  const books = await listLegacyBooks();
  const eligible = books.filter((item) => text(item.data?.status, 40) === 'ready' && text(item.data?.bundle?.path || item.data?.contentPackagePath, 2_000));
  const userIds = Array.from(new Set(eligible.map((item) => item.uid)));
  console.log(`[community-backfill] inventory books=${books.length} eligible=${eligible.length} users=${userIds.length}`);

  const profiles = new Map();
  for (const uid of userIds) profiles.set(uid, await ensureProfile(uid));

  let completed = 0;
  const results = await mapWithConcurrency(eligible, CONCURRENCY, async (item) => {
    const result = await migrateBook(item, profiles.get(item.uid));
    completed += 1;
    if (EXECUTE || completed % 20 === 0 || completed === eligible.length) {
      console.log(`[community-backfill] ${completed}/${eligible.length} ${result.status} ${item.uid}/${item.bookId}${result.title ? ` ${result.title}` : ''}`);
    }
    return result;
  });

  if (EXECUTE) {
    const publishedCounts = new Map();
    for (const result of results) {
      if (result.status === 'published' || result.status === 'skipped') {
        publishedCounts.set(result.uid, (publishedCounts.get(result.uid) || 0) + 1);
      }
    }
    for (const uid of userIds) {
      await firestore.collection('communityProfiles').doc(uid).set({
        publicationCount: publishedCounts.get(uid) || 0,
        updatedAt: Timestamp.now(),
        migrationSource: MIGRATION_SOURCE
      }, { merge: true });
    }
  }

  const summary = results.reduce((counts, result) => {
    counts[result.status] = (counts[result.status] || 0) + 1;
    return counts;
  }, {});
  console.log(`[community-backfill] summary ${JSON.stringify(summary)}`);
  for (const failure of results.filter((result) => result.status === 'failed')) {
    console.error(`[community-backfill] FAILED ${failure.uid}/${failure.bookId}: ${failure.error}`);
  }
  if ((summary.failed || 0) > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('[community-backfill] fatal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(getApps().map((app) => app.delete().catch(() => undefined)));
  });
