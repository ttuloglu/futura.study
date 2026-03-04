import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import FaviconSpinner from '../components/FaviconSpinner';
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { appCheckReady, auth, functions } from '../firebaseConfig';
import { useUiI18n } from '../i18n/uiI18n';
import { ViewState } from '../types';
import {
  canUseNativeSocialSignIn,
  isNativeSocialRuntime,
  signInWithNativeSocial
} from '../utils/nativeSocialAuth';

type AuthStatus = {
  type: 'info' | 'error';
  message: string;
} | null;

type AuthStep = 'email' | 'code';

type ActiveAction = 'email' | 'code' | 'google' | 'apple' | null;

type EmailLoginCodeResponse = {
  success?: boolean;
  error?: string;
  code?: string;
};

type VerifyEmailLoginCodeResponse = {
  success?: boolean;
  customToken?: string;
  error?: string;
  code?: string;
};

const normalizeOtpCode = (raw: string): string => {
  if (!raw) return '';
  return raw
    .normalize('NFKC')
    .replace(/[^\d]/g, '')
    .slice(0, 6);
};

const resolveOtpErrorMessage = (error: unknown, fallback: string): string => {
  const errorCode = String((error as { code?: unknown } | null)?.code || '').toLowerCase();
  const message = String((error as { message?: unknown } | null)?.message || '').toLowerCase();
  const combined = `${errorCode} ${message}`;

  if (combined.includes('invalid email') || combined.includes('e-posta adresi') || combined.includes('email')) {
    return 'Geçerli bir e-posta adresi girin.';
  }

  if (combined.includes('6 haneli') || combined.includes('login code required') || combined.includes('kod gerekli')) {
    return 'Mail ile gelen 6 haneli kodu girin.';
  }

  if (combined.includes('invalid or expired') || combined.includes('geçersiz') || combined.includes('süresi')) {
    return 'Kod geçersiz veya süresi doldu.';
  }

  if (combined.includes('failed-precondition') || combined.includes('yapılandırılmadı') || combined.includes('provider is not configured')) {
    return 'E-posta servisi yapılandırılmadı.';
  }

  if (combined.includes('too-many-requests') || combined.includes('resource-exhausted')) {
    return 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.';
  }

  return fallback;
};

const resolveSocialErrorMessage = (error: unknown, fallback: string): string => {
  const code = String((error as { code?: unknown } | null)?.code || '').toLowerCase();
  const message = String((error as { message?: unknown } | null)?.message || '').toLowerCase();
  const combined = `${code} ${message}`;

  if (combined.includes('popup-closed-by-user')) return 'Giriş penceresi kapatıldı.';
  if (combined.includes('popup-blocked')) return 'Tarayıcı popup engelledi. Lütfen izin verin.';
  if (combined.includes('operation-not-supported-in-this-environment')) return 'Bu cihazda popup desteklenmiyor, yönlendirme ile tekrar deneyin.';
  if (combined.includes('provider is not configured') || combined.includes('operation-not-allowed')) {
    return 'Apple/Google giriş henüz etkin değil. Firebase Auth sağlayıcı ayarını kontrol edin.';
  }
  if (combined.includes('invalid_client')) {
    return 'Apple Sign-In yapılandırması geçersiz (invalid_client). Firebase Apple sağlayıcı ayarındaki Service ID / Team ID / Key ID değerlerini kontrol edin.';
  }
  if (combined.includes('unauthorized-domain')) {
    return 'Bu alan adı Firebase Auth Authorized Domains listesinde değil.';
  }
  if (combined.includes('invalid-credential') || combined.includes('credential')) {
    return 'Giriş kimlik bilgisi doğrulanamadı.';
  }

  return fallback;
};

const isMobileBrowserRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Mobi/i.test(ua);
};

const shouldFallbackToRedirect = (error: unknown): boolean => {
  const code = String((error as { code?: unknown } | null)?.code || '').toLowerCase();
  return [
    'auth/popup-blocked',
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment',
    'auth/web-storage-unsupported'
  ].some((item) => code.includes(item));
};

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AppleMark = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-5 w-5"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

const SocialIconFrame = ({ children }: { children: React.ReactNode }) => (
  <span className="flex h-5 w-5 items-center justify-center">{children}</span>
);

interface LoginViewProps {
  onContinueWithoutLogin?: () => void;
  onNavigate?: (view: ViewState) => void;
}

export default function LoginView({ onContinueWithoutLogin, onNavigate }: LoginViewProps) {
  const { t } = useUiI18n();
  const [authStep, setAuthStep] = useState<AuthStep>('email');
  const [formData, setFormData] = useState({ email: '', code: '' });
  const [isBusy, setIsBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [status, setStatus] = useState<AuthStatus>(null);

  const sendCodeInFlightRef = useRef(false);
  const verifyCodeInFlightRef = useRef(false);

  const isEmailBusy = isBusy && activeAction === 'email';
  const isCodeBusy = isBusy && activeAction === 'code';

  useEffect(() => {
    auth.languageCode = 'tr';
  }, []);

  useEffect(() => {
    if (isNativeSocialRuntime()) return () => undefined;

    let cancelled = false;

    const finalizeSocialRedirect = async () => {
      try {
        const result = await getRedirectResult(auth, browserPopupRedirectResolver);
        if (cancelled || !result) return;
        setStatus({ type: 'info', message: 'Giriş başarılı.' });
      } catch (error) {
        if (cancelled) return;
        const code = String((error as { code?: unknown } | null)?.code || '').toLowerCase();
        if (code.includes('auth/no-auth-event')) return;
        setStatus({
          type: 'error',
          message: resolveSocialErrorMessage(error, 'Sosyal giriş tamamlanamadı.')
        });
      }
    };

    void finalizeSocialRedirect();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = event.target;
    const value = name === 'code' ? normalizeOtpCode(event.target.value) : event.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setStatus(null);
  };

  const handleSendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (sendCodeInFlightRef.current || isBusy) return;

    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setStatus({ type: 'error', message: 'Geçerli bir e-posta adresi girin.' });
      return;
    }

    setStatus(null);
    setAuthStep('code');
    setFormData((prev) => ({ ...prev, email: normalizedEmail }));
    sendCodeInFlightRef.current = true;
    setActiveAction('email');
    setIsBusy(true);

    const startedAt = Date.now();

    try {
      const requestCode = httpsCallable<
        { email: string; language: string },
        EmailLoginCodeResponse
      >(functions, 'requestEmailLoginCode');

      await appCheckReady;
      const result = await requestCode({ email: normalizedEmail, language: 'tr' });
      const payload = result.data || {};

      if (payload.success === false) {
        throw new Error(payload.error || 'Giriş kodu gönderilemedi.');
      }

      setStatus({
        type: 'info',
        message: `${normalizedEmail} adresine giriş kodu gönderildi.`
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: resolveOtpErrorMessage(error, 'Giriş kodu gönderilemedi.')
      });
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 300) {
        await new Promise((resolve) => setTimeout(resolve, 300 - elapsed));
      }
      sendCodeInFlightRef.current = false;
      setIsBusy(false);
      setActiveAction(null);
    }
  };

  const handleVerifyCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (verifyCodeInFlightRef.current || isBusy) return;

    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedCode = normalizeOtpCode(formData.code);

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setStatus({ type: 'error', message: 'Geçerli bir e-posta adresi girin.' });
      setAuthStep('email');
      return;
    }

    if (normalizedCode.length !== 6) {
      setStatus({ type: 'error', message: 'Mail ile gelen 6 haneli kodu girin.' });
      return;
    }

    setStatus(null);
    verifyCodeInFlightRef.current = true;
    setActiveAction('code');
    setIsBusy(true);

    try {
      const verifyCode = httpsCallable<
        { email: string; code: string; language: string },
        VerifyEmailLoginCodeResponse
      >(functions, 'verifyEmailLoginCode');

      await appCheckReady;
      const result = await verifyCode({
        email: normalizedEmail,
        code: normalizedCode,
        language: 'tr'
      });
      const payload = result.data || {};

      if (payload.success === false || !payload.customToken) {
        throw new Error(payload.error || 'Giriş kodu doğrulanamadı.');
      }

      await signInWithCustomToken(auth, payload.customToken);
      setStatus({ type: 'info', message: 'Giriş başarılı.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: resolveOtpErrorMessage(error, 'Giriş kodu doğrulanamadı.')
      });
    } finally {
      verifyCodeInFlightRef.current = false;
      setIsBusy(false);
      setActiveAction(null);
    }
  };

  const handleSocialSignIn = async (providerName: 'google' | 'apple') => {
    const shouldUseNativeSignIn = canUseNativeSocialSignIn(providerName);

    const createProvider = () => {
      if (providerName === 'google') {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return provider;
      }

      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      provider.setCustomParameters({ locale: 'tr' });
      return provider;
    };

    setIsBusy(true);
    setStatus(null);
    setActiveAction(providerName);

    try {
      if (shouldUseNativeSignIn) {
        await signInWithNativeSocial(providerName);
        setStatus({ type: 'info', message: 'Giriş başarılı.' });
        return;
      }

      const provider = createProvider();
      const shouldUseRedirectFirst = providerName === 'apple' && isMobileBrowserRuntime();

      if (shouldUseRedirectFirst) {
        await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
        return;
      }

      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (error: any) {
      if (shouldFallbackToRedirect(error)) {
        try {
          await signInWithRedirect(auth, createProvider(), browserPopupRedirectResolver);
          return;
        } catch (redirectError) {
          setStatus({
            type: 'error',
            message: resolveSocialErrorMessage(redirectError, 'Giriş yapılamadı.')
          });
          return;
        }
      }

      setStatus({
        type: 'error',
        message: resolveSocialErrorMessage(error, 'Giriş yapılamadı.')
      });
    } finally {
      setIsBusy(false);
      setActiveAction(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderColor: 'rgba(118,170,226,0.48)',
    background: 'linear-gradient(180deg, rgba(21,35,54,0.92) 0%, rgba(17,27,40,0.95) 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(88,123,163,0.24)'
  };

  const secondaryStyle: React.CSSProperties = {
    background: 'linear-gradient(160deg, rgba(19,33,50,0.76) 0%, rgba(16,24,35,0.86) 100%)',
    borderColor: 'rgba(104,152,205,0.3)',
    boxShadow: 'inset 0 0 0 1px rgba(86,130,181,0.16)'
  };

  return (
    <div
      className="fixed inset-0 text-white"
      style={{
        background:
          'radial-gradient(circle at 12% 7%, rgba(154, 172, 191, 0.11), transparent 44%), radial-gradient(circle at 88% 11%, rgba(118, 132, 148, 0.1), transparent 42%), linear-gradient(180deg, #2d353d 0%, #232a31 100%)'
      }}
    >
      <div className="app-content-width flex h-full flex-col px-6 md:px-8">
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="relative z-10 w-full max-w-[440px] mx-auto space-y-5">
            <div className="grid grid-cols-[44px_1fr] items-center gap-3 rounded-2xl border border-dashed px-3 py-2.5" style={secondaryStyle}>
              <div className="h-11 w-11 rounded-2xl p-2 flex items-center justify-center" style={inputStyle}>
                <img src="/favicon-red.svg" alt="Fortale logo" className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-white">Fortale</h1>
                <p className="text-[11px] text-[#c6dbf3]/90">{t('Build Your Epic')}</p>
              </div>
            </div>

            <form onSubmit={authStep === 'email' ? handleSendCode : handleVerifyCode} className="relative space-y-4">
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold tracking-wide text-[#cfe2f7] ml-1">{t('E-posta')}</label>
                <div className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 transition-all" style={inputStyle}>
                  <Mail size={15} className="text-[#93b7dd]" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="ornek@mail.com"
                    readOnly={authStep === 'code'}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    enterKeyHint={authStep === 'code' ? 'done' : 'next'}
                    className="login-flat-input w-full !border-0 !bg-transparent text-[14px] font-medium text-white !shadow-none outline-none ring-0 placeholder:text-[#8ca7c6] focus:outline-none focus:ring-0"
                    required
                  />
                </div>
              </div>

              {authStep === 'code' && (
                <div className="space-y-2">
                  <label className="block text-[12px] font-semibold tracking-wide text-[#cfe2f7] ml-1">{t('Giriş kodu')}</label>
                  <div className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 transition-all" style={inputStyle}>
                    <KeyRound size={15} className="text-[#93b7dd]" />
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      placeholder={t('Mail ile gelen 6 haneli kod')}
                      className="login-flat-input w-full !border-0 !bg-transparent text-[14px] tracking-[0.24em] text-white !shadow-none placeholder:text-[#8ca7c6] focus:outline-none font-medium"
                      inputMode="numeric"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      maxLength={6}
                    />
                  </div>
                  <p className="text-[11px] text-[#93b2d3] px-1">{t('E-posta kutunu kontrol et ve gelen kodu gir.')}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy || (authStep === 'code' && formData.code.trim().length < 6)}
                className="w-full rounded-xl border border-dashed flex items-center justify-center gap-2 px-3 py-2.5 text-center transition-all disabled:opacity-55 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(146,194,246,0.42)',
                  background: 'linear-gradient(135deg, rgba(35,67,103,0.95) 0%, rgba(24,44,70,0.92) 100%)',
                  boxShadow: 'inset 0 0 0 1px rgba(165,207,255,0.3), 0 0 14px rgba(94,141,198,0.22)'
                }}
              >
                {isEmailBusy || isCodeBusy ? (
                  <FaviconSpinner size={16} />
                ) : authStep === 'email' ? (
                  <>
                    <span className="text-[14px] font-semibold">{t('Kodu gönder')}</span>
                    <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    <span className="text-[14px] font-semibold">{t('Kodu doğrula')}</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              {authStep === 'code' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('email');
                      setFormData((prev) => ({ ...prev, code: '' }));
                      setStatus(null);
                    }}
                    disabled={isBusy}
                    className="rounded-xl border border-dashed px-2 py-2 text-[11px] font-semibold text-[#c7dcf2] transition-all hover:text-white disabled:opacity-60"
                    style={secondaryStyle}
                  >
                    {t('E-postayı değiştir')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendCode()}
                    disabled={isBusy}
                    className="rounded-xl border border-dashed px-2 py-2 text-[11px] font-semibold text-[#c7dcf2] transition-all hover:text-white disabled:opacity-60"
                    style={secondaryStyle}
                  >
                    {t('Kodu tekrar gönder')}
                  </button>
                </div>
              )}
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[rgba(130,170,212,0.26)]" />
              <span className="text-[11px] font-semibold tracking-wide text-[#bad2ec]">{t('Veya')}</span>
              <div className="flex-1 h-px bg-[rgba(130,170,212,0.26)]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSocialSignIn('google')}
                disabled={isBusy}
                className="rounded-xl border border-dashed py-2.5 px-3 transition-all disabled:opacity-55 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={inputStyle}
              >
                {isBusy && activeAction === 'google' ? (
                  <FaviconSpinner size={16} />
                ) : (
                  <SocialIconFrame>
                    <GoogleMark />
                  </SocialIconFrame>
                )}
                <span className="text-[13px] font-semibold">Google</span>
              </button>
              <button
                onClick={() => handleSocialSignIn('apple')}
                disabled={isBusy}
                className="rounded-xl border border-dashed py-2.5 px-3 transition-all disabled:opacity-55 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={inputStyle}
              >
                {isBusy && activeAction === 'apple' ? (
                  <FaviconSpinner size={16} />
                ) : (
                  <SocialIconFrame>
                    <AppleMark />
                  </SocialIconFrame>
                )}
                <span className="text-[13px] font-semibold">Apple</span>
              </button>
            </div>

            {onContinueWithoutLogin && (
              <button
                type="button"
                onClick={onContinueWithoutLogin}
                disabled={isBusy}
                className="w-full rounded-xl border border-dashed py-2.5 mt-3 text-[13px] font-semibold text-[#c7dcf2] transition-all hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={secondaryStyle}
              >
                {t('Giriş yapmadan devam et')}
              </button>
            )}

            {status && (
              <p
                className={`text-center text-[13px] font-semibold mt-2 ${status.type === 'error' ? 'text-accent-red' : 'text-accent-green opacity-80'
                  }`}
              >
                {status.message}
              </p>
            )}
          </div>
        </div>

        {onNavigate && (
          <footer className="pb-[calc(env(safe-area-inset-bottom,0px)+14px)] flex items-center justify-center gap-2 text-sm text-text-secondary">
            <button
              type="button"
              onClick={() => onNavigate('TERMS')}
              className="hover:text-white transition-colors"
            >
              {t('Kullanım Şartları')}
            </button>
            <span className="opacity-60">.</span>
            <button
              type="button"
              onClick={() => onNavigate('PRIVACY')}
              className="hover:text-white transition-colors"
            >
              {t('Gizlilik Politikası')}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
