import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { Capacitor } from "@capacitor/core";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  type Auth
} from "firebase/auth";

const DEFAULT_IOS_FIREBASE_API_KEY = "AIzaSyBdEkWrSvC5-zwzqM-cgMnkcU_HmnTlb5Y";
const DEFAULT_IOS_BUNDLE_ID = "com.company.fstudy";
const FIREBASE_AUTH_HOSTS = new Set([
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "www.googleapis.com"
]);
const FETCH_PATCH_MARKER = "__fortaleFirebaseAuthFetchPatched__";
const isNativeRuntime = Capacitor.isNativePlatform();
const nativePlatform = isNativeRuntime ? Capacitor.getPlatform() : "web";
const isNativeIosRuntime = nativePlatform === "ios";
const nativeIosApiKey = String(
  import.meta.env.VITE_FIREBASE_API_KEY_IOS || DEFAULT_IOS_FIREBASE_API_KEY
).trim();
const nativeIosBundleId = String(
  import.meta.env.VITE_FIREBASE_IOS_BUNDLE_ID || DEFAULT_IOS_BUNDLE_ID
).trim();

function isFirebaseAuthRequestUrl(url: URL): boolean {
  if (!FIREBASE_AUTH_HOSTS.has(url.hostname)) return false;
  if (url.hostname === "www.googleapis.com") {
    return url.pathname.includes("/identitytoolkit/");
  }
  return true;
}

function installNativeIosFirebaseAuthFetchPatch(): void {
  if (!isNativeIosRuntime || !nativeIosApiKey || !nativeIosBundleId) return;
  if (typeof globalThis.fetch !== "function") return;

  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  if (globalState[FETCH_PATCH_MARKER]) return;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return originalFetch(input, init);
    }

    if (!isFirebaseAuthRequestUrl(parsedUrl)) {
      return originalFetch(input, init);
    }

    const rewrittenUrl = new URL(parsedUrl.toString());
    rewrittenUrl.searchParams.set("key", nativeIosApiKey);

    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    headers.set("X-Ios-Bundle-Identifier", nativeIosBundleId);

    if (input instanceof Request) {
      const nextRequest = new Request(rewrittenUrl.toString(), {
        method: input.method,
        headers,
        body: /^(GET|HEAD)$/i.test(input.method) ? undefined : input.clone().body ?? undefined,
        cache: input.cache,
        credentials: input.credentials,
        integrity: input.integrity,
        keepalive: input.keepalive,
        mode: input.mode,
        redirect: input.redirect,
        referrer: input.referrer,
        referrerPolicy: input.referrerPolicy,
        signal: input.signal
      });
      return originalFetch(nextRequest);
    }

    return originalFetch(rewrittenUrl.toString(), {
      ...(init || {}),
      headers
    });
  };

  globalState[FETCH_PATCH_MARKER] = true;
}

installNativeIosFirebaseAuthFetchPatch();

const firebaseConfig: FirebaseOptions = {
  apiKey: isNativeIosRuntime ? nativeIosApiKey : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
] as const;

const missingConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);
const envKeyMap: Record<(typeof requiredConfigKeys)[number], string> = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID"
};
if (missingConfigKeys.length > 0) {
  throw new Error(
    `[Firebase] Missing env keys: ${missingConfigKeys
      .map((key) => envKeyMap[key])
      .join(", ")}`
  );
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence
  });
} catch {
  auth = getAuth(app);
}
let analytics: Analytics | null = null;

const useFunctionsEmulatorFlag = String(import.meta.env.VITE_USE_FUNCTIONS_EMULATOR || "").toLowerCase();
const shouldUseFunctionsEmulator =
  (useFunctionsEmulatorFlag === "1" || useFunctionsEmulatorFlag === "true") &&
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

if (shouldUseFunctionsEmulator) {
  const emulatorHost = String(import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || "127.0.0.1").trim();
  const emulatorPort = Number.parseInt(String(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || "5001"), 10);

  if (Number.isFinite(emulatorPort) && emulatorPort > 0) {
    try {
      connectFunctionsEmulator(functions, emulatorHost, emulatorPort);
    } catch (error) {
      console.warn("Functions emulator bağlantısı atlandı:", error);
    }
  }
}

const appCheckReady = Promise.resolve(null);
const isSupportedAnalyticsOrigin =
  typeof window !== "undefined" &&
  /^(http|https):$/i.test(window.location.protocol);

// Capacitor WebView origins such as capacitor://localhost are blocked by Firebase web analytics.
if (!isNativeRuntime && isSupportedAnalyticsOrigin) {
  void isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn("Firebase Analytics could not be initialized:", error);
    });
}

export { app, analytics, db, functions, auth, appCheckReady };
