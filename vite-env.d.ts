/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string;
  readonly VITE_GOOGLE_IOS_SERVER_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URL?: string;
  readonly VITE_REVENUECAT_ENABLED?: string;
  readonly VITE_REVENUECAT_API_KEY?: string;
  readonly VITE_REVENUECAT_API_KEY_IOS?: string;
  readonly VITE_REVENUECAT_API_KEY_ANDROID?: string;
  readonly VITE_REVENUECAT_OFFERING_ID?: string;
  readonly VITE_REVENUECAT_OFFERING_IDS?: string;
  readonly VITE_REVENUECAT_REST_APP_ID?: string;
  readonly VITE_REVENUECAT_PACK_5_ID?: string;
  readonly VITE_REVENUECAT_PACK_5_IDS?: string;
  readonly VITE_REVENUECAT_PACK_15_ID?: string;
  readonly VITE_REVENUECAT_PACK_15_IDS?: string;
  readonly VITE_REVENUECAT_PACK_30_ID?: string;
  readonly VITE_REVENUECAT_PACK_30_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
