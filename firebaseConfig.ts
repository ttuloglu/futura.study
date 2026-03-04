import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  type Auth
} from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
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

// Analytics is not available in every runtime (SSR / limited WebView contexts).
void isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch((error) => {
    console.warn("Firebase Analytics could not be initialized:", error);
  });

export { app, analytics, db, functions, auth, appCheckReady };
