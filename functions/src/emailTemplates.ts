const ACCENT = '#4F9B43';
const ACCENT_TEXT = '#ffffff';
const APP_NAME = 'Fortale';
const SPONELABS_URL = 'https://sponelabs.com';
const APP_URL = 'https://fortale.app';
const MONO = `'JetBrains Mono','Courier New',Courier,monospace`;

const LOGO_IMG_URL = 'https://firebasestorage.googleapis.com/v0/b/f-study-53ef9.firebasestorage.app/o/email-assets%2Ffortale-logo-light.png?alt=media&token=9b6525df-f041-4360-afc7-ceb0a40980c7';
const LOGO_SVG = `<img src="${LOGO_IMG_URL}" alt="Fortale" width="32" height="32" style="display:block;" />`;

export type TransactionalEmailType = 'welcome' | 'purchaseThanks' | 'subscriptionCancelled' | 'loginCode' | 'promo' | 'supportAck';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const lang = (language?: string) => String(language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';

const paragraphHtml = (paragraphs: string[]) =>
  paragraphs.map(p => `<p style="margin:0 0 14px 0;font-family:${MONO};font-size:15px;line-height:1.75;color:#44403c;">${esc(p)}</p>`).join('');

const codeBlock = (code?: string) => code
  ? `<div style="margin:8px 0 16px 0;letter-spacing:0.22em;font-weight:700;font-size:32px;color:${ACCENT};background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:14px 16px;text-align:center;font-family:${MONO};">${esc(code)}</div>`
  : '';

function buildBase(params: {
  heroTitle: string;
  salutation: string;
  paragraphs: string[];
  detailsRows?: Array<{ label: string; value: string }>;
  extraHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const year = new Date().getFullYear();
  const detailsHtml = params.detailsRows?.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden;">${params.detailsRows.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#fafaf9' : '#ffffff'};"><td style="padding:10px 16px;font-family:${MONO};font-size:12px;color:#78716c;width:40%;">${esc(row.label)}</td><td style="padding:10px 16px;font-family:${MONO};font-size:12px;font-weight:600;color:#1c1917;">${esc(row.value)}</td></tr>`).join('')}</table>`
    : '';
  const ctaHtml = params.ctaLabel && params.ctaUrl
    ? `<tr><td style="padding:0 36px 36px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${ACCENT};border-radius:8px;"><a href="${esc(params.ctaUrl)}" style="display:inline-block;padding:13px 28px;font-family:${MONO};font-size:13px;font-weight:600;color:${ACCENT_TEXT};text-decoration:none;letter-spacing:0.02em;">${esc(params.ctaLabel)} &rarr;</a></td></tr></table></td></tr>`
    : '';
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;padding:40px 16px;font-family:${MONO};">
  <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;">
    <tr><td style="background:${ACCENT};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 36px 20px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;padding-right:10px;">${LOGO_SVG}</td><td style="vertical-align:middle;font-family:${MONO};font-size:17px;font-weight:700;color:#0c0a09;letter-spacing:-0.02em;">${APP_NAME}</td></tr></table></td></tr>
    <tr><td style="padding:0 36px;"><div style="height:1px;background:#f0efee;"></div></td></tr>
    <tr><td style="padding:32px 36px 12px;"><p style="margin:0 0 6px 0;font-family:${MONO};font-size:22px;font-weight:700;color:#1c1917;letter-spacing:-0.03em;line-height:1.2;">${esc(params.heroTitle)}</p><p style="margin:0;font-family:${MONO};font-size:13px;color:#a8a29e;">${esc(params.salutation)}</p></td></tr>
    <tr><td style="padding:16px 36px 28px;">${paragraphHtml(params.paragraphs)}${detailsHtml}${params.extraHtml || ''}</td></tr>
    ${ctaHtml}
    <tr><td style="padding:0 36px 32px;"><div style="height:1px;background:#f0efee;margin-bottom:20px;"></div><p style="margin:0;font-size:11px;font-family:${MONO};color:#a8a29e;line-height:1.6;">${APP_NAME}, SponeLabs tarafından geliştirilen bir uygulamadır.<br><a href="${SPONELABS_URL}" style="color:${ACCENT};text-decoration:none;">sponelabs.com</a> &nbsp;&middot;&nbsp; &copy; ${year} SponeLabs</p></td></tr>
  </table></td></tr>
</table>`;
}

export function buildTransactionalEmail(params: {
  type: TransactionalEmailType;
  language?: string;
  recipientName?: string;
  displayName?: string;
  code?: string;
  ttlMinutes?: number;
  planLabel?: string;
  packLabel?: string;
  promoCode?: string;
  subject?: string;
  heroTitle?: string;
  paragraphs?: string[];
  messageSubject?: string;
  ctaUrl?: string;
}): { subject: string; html: string; text: string } {
  const language = lang(params.language);
  const isTr = language === 'tr';
  const name = params.recipientName || params.displayName || '';
  const salutation = name ? (isTr ? `Merhaba ${name},` : `Hello ${name},`) : (isTr ? 'Merhaba,' : 'Hello,');
  const productLabel = params.planLabel || params.packLabel || (isTr ? 'Kredi Paketi' : 'Credit Pack');
  let subject = '';
  let heroTitle = '';
  let paragraphs: string[] = [];
  let detailsRows: Array<{ label: string; value: string }> = [];
  let extraHtml = '';
  let ctaLabel: string | undefined = isTr ? 'Uygulamayı Aç' : 'Open App';

  if (params.type === 'welcome') {
    subject = isTr ? 'Fortale\'ye hoş geldin' : 'Welcome to Fortale';
    heroTitle = isTr ? 'Fortale\'ye hoş geldin' : 'Welcome to Fortale';
    paragraphs = isTr ? ['Hesabın hazır. Hikaye, roman ve senaryo üretimine başlayabilirsin.'] : ['Your account is ready. You can start writing stories, novels, and scenarios.'];
  } else if (params.type === 'purchaseThanks') {
    subject = isTr ? `${productLabel} hesabına eklendi` : `${productLabel} added to your account`;
    heroTitle = isTr ? 'Satın alma tamamlandı' : 'Purchase completed';
    paragraphs = isTr ? [`${productLabel} satın alma işlemin başarıyla tamamlandı.`] : [`Your ${productLabel} purchase was completed successfully.`];
    detailsRows = [{ label: isTr ? 'Paket' : 'Pack', value: productLabel }, { label: isTr ? 'Durum' : 'Status', value: isTr ? 'Eklendi' : 'Added' }];
  } else if (params.type === 'subscriptionCancelled') {
    subject = isTr ? 'Fortale üyeliğiniz iptal edildi' : 'Your Fortale subscription has been cancelled';
    heroTitle = isTr ? 'Üyelik iptal edildi' : 'Subscription cancelled';
    paragraphs = isTr ? ['Üyeliğiniz iptal talebiniz doğrultusunda sonlandırılmıştır.'] : ['Your subscription has been cancelled as requested.'];
  } else if (params.type === 'loginCode') {
    subject = isTr ? 'Fortale giriş kodunuz' : 'Your Fortale login code';
    heroTitle = isTr ? 'Giriş kodunuz' : 'Your login code';
    paragraphs = isTr ? ['Fortale hesabınıza giriş için tek kullanımlık kodunuz aşağıdadır.', `Kod ${params.ttlMinutes || 10} dakika geçerlidir.`] : ['Use this one-time code to sign in to Fortale.', `This code is valid for ${params.ttlMinutes || 10} minutes.`];
    extraHtml = codeBlock(params.code);
    ctaLabel = undefined;
  } else if (params.type === 'promo') {
    subject = params.subject || (isTr ? 'Fortale promosyonunuz hazır' : 'Your Fortale promotion is ready');
    heroTitle = params.heroTitle || (isTr ? 'Promosyon hazır' : 'Promotion ready');
    paragraphs = params.paragraphs || (isTr ? ['Fortale promosyon detaylarınız aşağıdadır.', params.promoCode ? `Kod: ${params.promoCode}` : 'Promosyonu uygulamada görebilirsiniz.'] : ['Your Fortale promotion details are below.', params.promoCode ? `Code: ${params.promoCode}` : 'You can view the promotion in the app.']);
  } else {
    subject = isTr ? 'Mesajınızı aldık' : 'We received your message';
    heroTitle = subject;
    paragraphs = isTr ? ['Fortale destek ekibine ulaştığınız için teşekkür ederiz.', 'Mesajınız bize ulaştı. En kısa sürede dönüş yapacağız.'] : ['Thank you for contacting Fortale support.', 'Your message is with us now. We will get back to you as soon as possible.'];
    if (params.messageSubject) detailsRows.push({ label: isTr ? 'Konu' : 'Subject', value: params.messageSubject });
    ctaLabel = undefined;
  }

  const html = buildBase({ heroTitle, salutation, paragraphs, detailsRows, extraHtml, ctaLabel, ctaUrl: params.ctaUrl || APP_URL });
  const text = [subject, '', salutation, ...paragraphs, params.code ? `\n${params.code}` : '', ctaLabel ? `\n${ctaLabel}: ${params.ctaUrl || APP_URL}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

export function buildAdminActionEmail(params: { action: TransactionalEmailType; userEmail?: string; userName?: string; occurredAt?: string; details?: Record<string, unknown> }): { subject: string; html: string; text: string } {
  const labels: Record<TransactionalEmailType, string> = {
    welcome: 'yeni üye oldu',
    purchaseThanks: 'satın alma yaptı',
    subscriptionCancelled: 'üyeliğini iptal etti',
    loginCode: 'giriş kodu aldı',
    promo: 'promosyon maili aldı',
    supportAck: 'destek mesajı gönderdi'
  };
  const user = params.userName || params.userEmail || 'İsimsiz kullanıcı';
  const at = params.occurredAt || new Date().toISOString();
  const details = Object.entries(params.details || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const text = [`${user} isimli kullanıcı ${at} tarihinde Fortale için ${labels[params.action]}.`, `Email: ${params.userEmail || 'Bilinmiyor'}`, ...details.map(([key, value]) => `${key}: ${value}`)].join('\n');
  const html = buildBase({ heroTitle: 'Admin bildirimi', salutation: APP_NAME, paragraphs: [`${user} isimli kullanıcı ${at} tarihinde ${labels[params.action]}.`], detailsRows: [{ label: 'Email', value: params.userEmail || 'Bilinmiyor' }, ...details.map(([key, value]) => ({ label: key, value: String(value) }))] });
  return { subject: `[Fortale] ${labels[params.action]}`, text, html };
}

export function buildWelcomeEmail(params: { displayName: string; body: string; isTr: boolean }): string {
  return buildTransactionalEmail({ type: 'welcome', language: params.isTr ? 'tr' : 'en', recipientName: params.displayName }).html;
}

export function buildPackPurchaseEmail(params: { salutation: string; subject: string; body: string; packLabel: string; isTr: boolean }): string {
  return buildTransactionalEmail({ type: 'purchaseThanks', language: params.isTr ? 'tr' : 'en', packLabel: params.packLabel }).html;
}
