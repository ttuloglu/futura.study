import { Capacitor } from '@capacitor/core';
import {
  PURCHASES_ERROR_CODE,
  Purchases,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage
} from '@revenuecat/purchases-capacitor';

export type RevenueCatCreditPackId = 'pack-5' | 'pack-15' | 'pack-30';

const RC_OPERATION_TIMEOUT_MS = 35_000;

const DEFAULT_PACK_HINTS: Record<RevenueCatCreditPackId, string[]> = {
  'pack-5': ['pack-5', '5', 'credit5', 'credits_5', 'five_credits'],
  'pack-15': ['pack-15', '15', 'credit15', 'credits_15', 'fifteen_credits'],
  'pack-30': ['pack-30', '30', 'credit30', 'credits_30', 'thirty_credits']
};

const PACK_HINT_ENV_VALUES: Record<RevenueCatCreditPackId, Array<string | undefined>> = {
  'pack-5': [import.meta.env.VITE_REVENUECAT_PACK_5_IDS, import.meta.env.VITE_REVENUECAT_PACK_5_ID],
  'pack-15': [import.meta.env.VITE_REVENUECAT_PACK_15_IDS, import.meta.env.VITE_REVENUECAT_PACK_15_ID],
  'pack-30': [import.meta.env.VITE_REVENUECAT_PACK_30_IDS, import.meta.env.VITE_REVENUECAT_PACK_30_ID]
};

function isSupportedNativePlatform(): boolean {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}

export function isRevenueCatEnabled(): boolean {
  if (!isSupportedNativePlatform()) return false;
  return String(import.meta.env.VITE_REVENUECAT_ENABLED || 'false').trim().toLowerCase() === 'true';
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function getRevenueCatApiKey(): string | null {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    return String(import.meta.env.VITE_REVENUECAT_API_KEY_IOS || import.meta.env.VITE_REVENUECAT_API_KEY || '').trim() || null;
  }
  if (platform === 'android') {
    return String(import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID || import.meta.env.VITE_REVENUECAT_API_KEY || '').trim() || null;
  }
  return null;
}

function getOfferingIdCandidates(): string[] {
  const raw = String(
    import.meta.env.VITE_REVENUECAT_OFFERING_IDS
    || import.meta.env.VITE_REVENUECAT_OFFERING_ID
    || ''
  ).trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getPackHints(packId: RevenueCatCreditPackId): string[] {
  const configured = PACK_HINT_ENV_VALUES[packId]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => normalizeIdentifier(value))
    .filter(Boolean);
  const merged = [...configured, ...DEFAULT_PACK_HINTS[packId].map((value) => normalizeIdentifier(value))];
  return merged.filter((value, index, arr) => arr.indexOf(value) === index);
}

let configured = false;
let configuredApiKey: string | null = null;
let currentAppUserId: string | null = null;
let configurePromise: Promise<void> | null = null;

async function withRevenueCatTimeout<T>(
  operation: Promise<T>,
  operationName: string,
  timeoutMs = RC_OPERATION_TIMEOUT_MS
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`RevenueCat ${operationName} timed out.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function ensureRevenueCatConfigured(options: {
  appUserId: string | null;
  email?: string | null;
  displayName?: string | null;
}): Promise<void> {
  if (!isRevenueCatEnabled()) return;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error('RevenueCat API key missing.');
  }

  if (configurePromise) {
    await configurePromise;
  }

  configurePromise = (async () => {
    if (!configured || configuredApiKey !== apiKey) {
      if (options.appUserId) {
        await Purchases.configure({ apiKey, appUserID: options.appUserId });
      } else {
        await Purchases.configure({ apiKey });
      }
      configured = true;
      configuredApiKey = apiKey;
      currentAppUserId = options.appUserId || null;
    }

    if (options.appUserId && currentAppUserId !== options.appUserId) {
      await Purchases.logIn({ appUserID: options.appUserId });
      currentAppUserId = options.appUserId;
    } else if (!options.appUserId && currentAppUserId) {
      await Purchases.logOut();
      currentAppUserId = null;
    }

    try {
      if (typeof options.email !== 'undefined') {
        await Purchases.setEmail({ email: options.email || '' });
      }
      if (typeof options.displayName !== 'undefined') {
        await Purchases.setDisplayName({ displayName: options.displayName || '' });
      }
    } catch {
      // Subscriber attributes are best effort only.
    }
  })();

  try {
    await configurePromise;
  } finally {
    configurePromise = null;
  }
}

function packageMatchesHints(pkg: PurchasesPackage, hints: string[]): boolean {
  if (!hints.length) return false;
  const ids = [pkg.identifier, pkg.product?.identifier]
    .filter(Boolean)
    .map((value) => normalizeIdentifier(String(value)));
  return ids.some((id) => hints.some((hint) => id === hint || id.includes(hint)));
}

function collectOfferingCandidates(offerings: { current: PurchasesOffering | null; all: Record<string, PurchasesOffering> }): PurchasesOffering[] {
  const candidates: PurchasesOffering[] = [];
  const seen = new Set<string>();

  const push = (offering: PurchasesOffering | null | undefined) => {
    if (!offering) return;
    const id = normalizeIdentifier(String(offering.identifier || ''));
    if (!id || seen.has(id)) return;
    seen.add(id);
    candidates.push(offering);
  };

  const configuredOfferingIds = getOfferingIdCandidates();
  for (const id of configuredOfferingIds) {
    push(offerings.all?.[id]);
  }
  push(offerings.current);
  Object.values(offerings.all || {}).forEach((offering) => push(offering));

  return candidates;
}

function getPackagePrice(pkg: PurchasesPackage): number {
  const raw = Number(pkg.product?.price);
  return Number.isFinite(raw) ? raw : Number.NaN;
}

function selectPackageByPrice(packages: PurchasesPackage[], targetPrice?: number): PurchasesPackage | null {
  if (!packages.length) return null;
  if (!Number.isFinite(targetPrice)) return packages[0];

  let selected: PurchasesPackage | null = null;
  let minDistance = Number.POSITIVE_INFINITY;
  for (const pkg of packages) {
    const price = getPackagePrice(pkg);
    if (!Number.isFinite(price)) continue;
    const distance = Math.abs(price - Number(targetPrice));
    if (distance < minDistance) {
      minDistance = distance;
      selected = pkg;
    }
  }
  return selected || packages[0];
}

export function isRevenueCatPurchaseCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as PurchasesError & { userCancelled?: boolean };
  return candidate.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || candidate.userCancelled === true;
}

export async function purchaseRevenueCatCreditPack(options: {
  packId: RevenueCatCreditPackId;
  targetPrice?: number;
}): Promise<Awaited<ReturnType<typeof Purchases.purchasePackage>>> {
  if (!isRevenueCatEnabled()) {
    throw new Error('RevenueCat is not enabled on this platform.');
  }

  const offerings = await withRevenueCatTimeout(Purchases.getOfferings(), 'getOfferings');
  const candidateOfferings = collectOfferingCandidates(offerings);
  if (!candidateOfferings.length) {
    throw new Error('RevenueCat offering not found.');
  }

  const allPackages = candidateOfferings.flatMap((offering) => offering.availablePackages || []);
  if (!allPackages.length) {
    throw new Error('RevenueCat packages not found.');
  }

  const hints = getPackHints(options.packId);
  const matchedByHint = allPackages.find((pkg) => packageMatchesHints(pkg, hints)) || null;
  const selectedPackage = matchedByHint || selectPackageByPrice(allPackages, options.targetPrice);
  if (!selectedPackage) {
    throw new Error('RevenueCat package could not be selected.');
  }

  return withRevenueCatTimeout(
    Purchases.purchasePackage({ aPackage: selectedPackage }),
    'purchasePackage'
  );
}
