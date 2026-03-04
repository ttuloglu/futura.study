import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type UserCredential
} from 'firebase/auth';
import { auth } from '../firebaseConfig';

type SocialProvider = 'google' | 'apple';
type NativePlatform = 'ios' | 'android' | 'web';

let initializePromise: Promise<void> | null = null;

function getNativePlatform(): NativePlatform {
  try {
    const platform = typeof Capacitor.getPlatform === 'function'
      ? String(Capacitor.getPlatform() || '').toLowerCase()
      : '';
    if (platform === 'ios' || platform === 'android') return platform;
  } catch {
    // Ignore platform detection failures and fall through to web.
  }
  return 'web';
}

export function isNativeSocialRuntime(): boolean {
  return getNativePlatform() !== 'web';
}

function getGoogleConfig() {
  return {
    webClientId: String(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '').trim(),
    iOSClientId: String(import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || '').trim(),
    iOSServerClientId: String(import.meta.env.VITE_GOOGLE_IOS_SERVER_CLIENT_ID || '').trim()
  };
}

function getAppleConfig() {
  return {
    clientId: String(import.meta.env.VITE_APPLE_CLIENT_ID || 'com.company.fstudy').trim(),
    redirectUrl: String(import.meta.env.VITE_APPLE_REDIRECT_URL || '').trim()
  };
}

export function canUseNativeSocialSignIn(provider: SocialProvider): boolean {
  const platform = getNativePlatform();
  const googleConfig = getGoogleConfig();
  const appleConfig = getAppleConfig();

  if (platform === 'ios') {
    if (provider === 'google') return Boolean(googleConfig.iOSClientId);
    return Boolean(appleConfig.clientId);
  }

  if (platform === 'android') {
    if (provider === 'google') return Boolean(googleConfig.webClientId);
    return Boolean(appleConfig.clientId && appleConfig.redirectUrl);
  }

  return false;
}

async function ensureNativeSocialInitialized(): Promise<void> {
  if (!isNativeSocialRuntime()) return;
  if (initializePromise) return initializePromise;

  const platform = getNativePlatform();
  const googleConfig = getGoogleConfig();
  const appleConfig = getAppleConfig();
  const initializeOptions: Record<string, unknown> = {};

  if (platform === 'ios') {
    if (googleConfig.iOSClientId) {
      initializeOptions.google = {
        iOSClientId: googleConfig.iOSClientId,
        ...(googleConfig.iOSServerClientId ? { iOSServerClientId: googleConfig.iOSServerClientId } : {}),
        mode: 'online'
      };
    }
    if (appleConfig.clientId) {
      initializeOptions.apple = {
        clientId: appleConfig.clientId
      };
    }
  } else if (platform === 'android') {
    if (googleConfig.webClientId) {
      initializeOptions.google = {
        webClientId: googleConfig.webClientId,
        mode: 'online'
      };
    }
    if (appleConfig.clientId && appleConfig.redirectUrl) {
      initializeOptions.apple = {
        clientId: appleConfig.clientId,
        redirectUrl: appleConfig.redirectUrl,
        useBroadcastChannel: true
      };
    }
  }

  initializePromise = SocialLogin.initialize(initializeOptions).catch((error) => {
    initializePromise = null;
    throw error;
  });

  return initializePromise;
}

function createNonce(byteLength = 16): string {
  if (!window.crypto?.getRandomValues) {
    throw new Error('Bu cihazda güvenli nonce üretilemiyor.');
  }
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error('Bu cihazda SHA-256 desteği bulunamadı.');
  }
  const encoded = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function signInWithNativeGoogle(): Promise<UserCredential> {
  if (!canUseNativeSocialSignIn('google')) {
    throw new Error('Google native giriş bu platformda yapılandırılmadı.');
  }

  await ensureNativeSocialInitialized();
  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile', 'openid'],
      forcePrompt: true
    }
  });

  if (response.result.responseType !== 'online' || !response.result.idToken) {
    throw new Error('Google kimlik doğrulaması alınamadı.');
  }

  const credential = GoogleAuthProvider.credential(
    response.result.idToken,
    response.result.accessToken?.token || undefined
  );
  return signInWithCredential(auth, credential);
}

async function signInWithNativeApple(): Promise<UserCredential> {
  if (!canUseNativeSocialSignIn('apple')) {
    throw new Error('Apple native giriş bu platformda yapılandırılmadı.');
  }

  await ensureNativeSocialInitialized();

  // Apple kimlik belirtecindeki nonce doğrulamasını Firebase ile eşleştiriyoruz.
  const rawNonce = createNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  const response = await SocialLogin.login({
    provider: 'apple',
    options: {
      scopes: ['email', 'name'],
      nonce: hashedNonce
    }
  });

  if (!response.result.idToken) {
    throw new Error('Apple kimlik doğrulaması alınamadı.');
  }

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: response.result.idToken,
    rawNonce
  });
  return signInWithCredential(auth, credential);
}

export async function signInWithNativeSocial(provider: SocialProvider): Promise<UserCredential> {
  if (provider === 'google') return signInWithNativeGoogle();
  return signInWithNativeApple();
}
