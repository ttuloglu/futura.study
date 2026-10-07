import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BookCreationDetails from './BookCreationDetails';
import BookInspirations from './BookInspirations';
import { getInspirationCategory, type BookInspiration } from '../utils/bookInspirations';
import { lockSheetBackground } from '../utils/sheetBackground';
import FortaleDropdown from './FortaleDropdown';
import FaviconSpinner from './FaviconSpinner';
import { setCompanionActivity } from '../utils/companionActivity';
import { ArrowRight, ArrowUp, ChevronDown, Feather, Languages, Paperclip, ScrollText, Telescope, Trash2 } from 'lucide-react';
import DialogCloseButton from './DialogCloseButton';
import { useUiI18n } from '../i18n/uiI18n';
import { APP_LANGUAGE_OPTIONS } from '../data/appLanguages';
import type { PluginListenerHandle } from '@capacitor/core';
import { NativeFloatIsland, supportsNativeFloatIsland, type NativeKeyboardState } from '../utils/nativeFloatIsland';
import { composerViewport } from '../utils/composerViewport';
import { BOOK_GUIDED_OPENING_REQUEST, getBookCreationEntryStage, type BookCreationMode, type BookCreationDraft, type BookIntakeResult, type IntakeBookType, type IntakeContext, type IntakeMessage, type BookIntakeQuestion } from '../functions/src/bookCreationIntake';
import { CEFR_LEVELS, type CefrLevel, type LanguageLearningProfile } from '../functions/src/languageLearning';

interface Props {
  isOpen: boolean;
  bookType: IntakeBookType;
  bookLanguage: string;
  initialLanguageLearning?: boolean;
  attachments: Array<{ id: string; file: File; previewUrl?: string }>;
  hasPortrait: boolean;
  sourceFileName?: string;
  notice: string | null;
  suspended?: boolean;
  onClose: () => void;
  onAttach: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (id: string) => void;
  onPlan: (context: IntakeContext) => Promise<BookIntakeResult>;
  onGenerate: (draft: BookCreationDraft) => Promise<boolean>;
}

export default function BookCreationComposer(props: Props) {
  const { t, language } = useUiI18n();
  const titleId = useId();
  const [input, setInput] = useState('');
  const [inspirationListOpen, setInspirationListOpen] = useState(false);
  const [entryStage, setEntryStage] = useState<'choice' | 'prompt' | 'guided'>(() => getBookCreationEntryStage(props.bookType));
  const [creationMode, setCreationMode] = useState<BookCreationMode>('custom');
  const [languageLearning, setLanguageLearning] = useState(Boolean(props.initialLanguageLearning));
  const readLearningPreference = (): Partial<LanguageLearningProfile> => {
    try { return JSON.parse(localStorage.getItem('fortale-language-learning-preferences') || '{}'); }
    catch { return {}; }
  };
  const [targetLanguage, setTargetLanguage] = useState(() => String(readLearningPreference().targetLanguage || (language === 'en' ? 'es' : 'en')));
  const [explanationLanguage, setExplanationLanguage] = useState(() => String(readLearningPreference().explanationLanguage || language));
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(() => CEFR_LEVELS.includes(readLearningPreference().cefrLevel as CefrLevel) ? readLearningPreference().cefrLevel as CefrLevel : 'A1');
  const [learningAudience, setLearningAudience] = useState<NonNullable<LanguageLearningProfile['audience']>>(() =>
    props.bookType === 'fairy_tale' ? '1-6' : (readLearningPreference().audience as NonNullable<LanguageLearningProfile['audience']> || 'general'));
  const editableLearningAudience = learningAudience === '1-6' ? 'general' : learningAudience;
  useEffect(() => {
    if (props.isOpen) setLanguageLearning(Boolean(props.initialLanguageLearning));
  }, [props.initialLanguageLearning, props.isOpen]);
  const [planningHistory, setPlanningHistory] = useState<IntakeMessage[]>([]);
  const [questions, setQuestions] = useState<BookIntakeQuestion[]>([]);
  const [detailsRound, setDetailsRound] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCompanionActivity('planning', props.isOpen && busy);
    setCompanionActivity('composerOpen', props.isOpen);
    return () => {
      setCompanionActivity('planning', false);
      setCompanionActivity('composerOpen', false);
    };
  }, [props.isOpen, busy]);
  const [error, setError] = useState<string | null>(null);
  const [plannedAttachmentSignature, setPlannedAttachmentSignature] = useState('');
  const [readyDraft, setReadyDraft] = useState<BookCreationDraft | null>(null);
  const requestVersion = useRef(0);
  const locked = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const entryChoiceRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const suspendedRef = useRef(props.suspended);
  suspendedRef.current = props.suspended || inspirationListOpen;
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;
  const signature = props.attachments.map(item => `${item.id}:${item.file.name}:${item.file.lastModified}`).join('|');

  const hasNewAttachments = Boolean(signature && signature !== plannedAttachmentSignature);
  useEffect(() => { setReadyDraft(null); }, [signature]);
  useEffect(() => {
    if (!props.isOpen) return;
    locked.current = false;
    setBusy(false);
    const previousFocus = document.activeElement as HTMLElement | null;
    const releaseBackground = lockSheetBackground();
    let nativeKeyboard: NativeKeyboardState | undefined;
    let keyboardListener: PluginListenerHandle | undefined;
    let active = true;
    const resize = () => {
      const fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const viewport = window.visualViewport;
      const geometry = composerViewport(fullHeight, viewport?.height || window.innerHeight, viewport?.offsetTop || 0, nativeKeyboard);
      if (rootRef.current) rootRef.current.dataset.keyboard = String(geometry.keyboard);
      rootRef.current?.style.setProperty('--composer-viewport-height', `${geometry.height}px`);
      rootRef.current?.style.setProperty('--composer-viewport-top', `${geometry.top}px`);
    };
    const keydown = (event: KeyboardEvent) => {
      if (suspendedRef.current || Array.from(document.querySelectorAll('.fortale-floatisland-sheet-root')).some(sheet => Number(getComputedStyle(sheet).zIndex) > 1000)) return;
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),textarea:not(:disabled),input:not([type="file"]):not(:disabled),select:not(:disabled)') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const handleScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      window.scrollTo(0, 0);
      const target = event.target as HTMLElement | null;
      if (target && dialogRef.current?.contains(target)) {
        setTimeout(() => {
          window.scrollTo(0, 0);
          target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }, 60);
      }
    };
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', keydown);
    if (supportsNativeFloatIsland()) {
      void NativeFloatIsland.addListener('keyboardGeometry', state => {
        if (active) { nativeKeyboard = state; resize(); }
      }).then(async listener => {
        if (!active) { void listener.remove(); return; }
        keyboardListener = listener;
        const state = await NativeFloatIsland.getKeyboardState();
        if (active) { nativeKeyboard = state; resize(); }
      }).catch(() => { /* VisualViewport remains the fallback. */ });
    }
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      active = false;
      void keyboardListener?.remove();
      requestVersion.current += 1;
      releaseBackground();
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', keydown);
      previousFocus?.focus();
    };
  }, [props.isOpen]);
  const chooseInspiration = (inspiration: BookInspiration) => {
    if (busy || props.suspended) return;
    setInspirationListOpen(false);
    setCreationMode('custom');
    setEntryStage('prompt');
    setReadyDraft(null);
    setError(null);
    setInput(inspiration.brief);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const send = async (detailAnswers?: string, mode: BookCreationMode = creationMode) => {
    if (locked.current || props.suspended) return;
    const content = detailAnswers || (mode === 'guided' && planningHistory.length === 0 ? BOOK_GUIDED_OPENING_REQUEST : input.trim() || (hasNewAttachments ? t('Ekli dosyayı kullan.') : ''));
    if (!content && !readyDraft) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    const version = requestVersion.current;
    try {
      if (readyDraft) {
        await props.onGenerate(readyDraft);
        return;
      }
      const result = await props.onPlan({
        bookType: props.bookType, language, bookLanguage: props.bookLanguage, creationMode: mode,
        history: planningHistory, newMessage: content, hasPortrait: props.hasPortrait,
        sourceFileName: props.sourceFileName,
        ...(languageLearning ? { languageLearning: {
          version: 1, purpose: 'language_learning', targetLanguage, explanationLanguage, cefrLevel,
          audience: props.bookType === 'fairy_tale' ? '1-6' : editableLearningAudience
        } satisfies LanguageLearningProfile } : {}),
      });
      if (version !== requestVersion.current) return;
      setPlanningHistory(current => [...current, { role: 'user', content }, { role: 'assistant', content: result.status === 'question' ? JSON.stringify(result.questions.map(({ id, purpose, question }) => ({ id, purpose, question }))) : result.message }]);
      setInput('');
      setPlannedAttachmentSignature(signature);
      if (result.status === 'ready') {
        setReadyDraft(result.draft);
        await props.onGenerate(result.draft);
      } else {
        setReadyDraft(null);
        setQuestions(result.questions);
        setDetailsRound(current => current + 1);
        inputRef.current?.blur();
      }
    } catch (failure) {
      if (version === requestVersion.current) setError(failure instanceof Error ? failure.message : t('Bağlantı hatası.'));
    } finally {
      if (version === requestVersion.current) { locked.current = false; setBusy(false); }
    }
  };

  if (!props.isOpen) return null;
  const title = props.bookType === 'fairy_tale' ? t('Masal') : props.bookType === 'novel' ? (languageLearning ? t('Yabancı Dilde Hikaye') : t('Hikaye')) : t('Çalışma Kitabı');
  const isPrompt = entryStage === 'prompt' && questions.length === 0;
  const isGuidedWaiting = entryStage === 'guided' && questions.length === 0;
  const thinkingIndicator = <span className="fortale-composer-thinking" role="status">
    <FaviconSpinner size={24} />
    <span>{t('Düşünüyor')}</span>
  </span>;
  const persistLearningPreference = (patch: Partial<LanguageLearningProfile>) => {
    try { localStorage.setItem('fortale-language-learning-preferences', JSON.stringify({ ...readLearningPreference(), ...patch })); }
    catch { /* Device storage may be unavailable. */ }
  };
  const Icon = languageLearning && props.bookType === 'novel' ? Languages : props.bookType === 'fairy_tale' ? Feather : props.bookType === 'novel' ? ScrollText : Telescope;
  return createPortal(
    <div ref={rootRef} className="fortale-production-composer-root" aria-hidden={props.suspended || inspirationListOpen || undefined} inert={props.suspended || inspirationListOpen || undefined}>
      <button className="fortale-composer-backdrop" type="button" aria-label={t('Kapat')} onClick={props.onClose} tabIndex={-1} />
      <div ref={dialogRef} className="fortale-production-composer-stack" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {questions.length === 0 && entryStage !== 'guided' && <BookInspirations
          category={getInspirationCategory(props.bookType, languageLearning)} isOpen={props.isOpen}
          disabled={busy || Boolean(props.suspended)} onSelect={chooseInspiration} onBrowseChange={setInspirationListOpen}/>}
      <section className="fortale-production-composer" data-stage={questions.length ? 'details' : entryStage}>
        <span className="fortale-composer-handle" aria-hidden="true" />
        <header className="fortale-composer-header">
          <div className="fortale-composer-header-info">
            {questions.length === 0 && <Icon size={24} />}
            <div><strong id={titleId}>{title}</strong><small>{questions.length ? t('Ayrıntıları Belirle') : t('Kitap Yaz')}</small></div>
          </div>
          <DialogCloseButton className="fortale-composer-close" onClick={props.onClose}/>
        </header>
        <div className="fortale-composer-body">
          {languageLearning && <section className="fortale-learning-settings" aria-label={t('Dil öğrenme ayarları')}>
            <div className="fortale-learning-language-row">
              <label>{t('Öğrenmek istediğin dil')}
                {!supportsNativeFloatIsland() ? (
                  <FortaleDropdown
                    label={t('Öğrenmek istediğin dil')}
                    value={targetLanguage}
                    options={APP_LANGUAGE_OPTIONS.map(opt => ({ value: opt.code, label: opt.label }))}
                    onChange={code => { setTargetLanguage(code); persistLearningPreference({ targetLanguage: code }); }}
                    forceDirection="down"
                    triggerClassName="!h-[38px] !rounded-[11px] !border-white/18 !bg-white/[0.075] !text-[12px] !font-medium"
                    minMenuWidth={160}
                    wizardStyle
                  />
                ) : (
                  <span className="fortale-learning-select"><select value={targetLanguage} onChange={event => { setTargetLanguage(event.target.value); persistLearningPreference({ targetLanguage: event.target.value }); }}>
                    {APP_LANGUAGE_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
                  </select><ChevronDown className="fortale-learning-select-arrow" aria-hidden="true" size={15} /></span>
                )}
              </label>
              <label>{t('Açıklama dili')}
                {!supportsNativeFloatIsland() ? (
                  <FortaleDropdown
                    label={t('Açıklama dili')}
                    value={explanationLanguage}
                    options={APP_LANGUAGE_OPTIONS.map(opt => ({ value: opt.code, label: opt.label }))}
                    onChange={code => { setExplanationLanguage(code); persistLearningPreference({ explanationLanguage: code }); }}
                    forceDirection="down"
                    triggerClassName="!h-[38px] !rounded-[11px] !border-white/18 !bg-white/[0.075] !text-[12px] !font-medium"
                    minMenuWidth={160}
                    wizardStyle
                  />
                ) : (
                  <span className="fortale-learning-select"><select value={explanationLanguage} onChange={event => { setExplanationLanguage(event.target.value); persistLearningPreference({ explanationLanguage: event.target.value }); }}>
                    {APP_LANGUAGE_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
                  </select><ChevronDown className="fortale-learning-select-arrow" aria-hidden="true" size={15} /></span>
                )}
              </label>
            </div>
            <span className="fortale-learning-kicker">{t('Okuma seviyesi')}</span>
            <div className="fortale-learning-levels" role="group" aria-label={t('Okuma seviyesi')}>
              {CEFR_LEVELS.map((level, index) => <button type="button" key={level} aria-pressed={cefrLevel === level} onClick={() => { setCefrLevel(level); persistLearningPreference({ cefrLevel: level }); }}><strong>{level}</strong><small>{t(['Başlangıç','Temel','Orta','Orta üstü','İleri','Çok ileri'][index])}</small></button>)}
            </div>
            {props.bookType !== 'fairy_tale' ? <label className="fortale-learning-audience">{t('Okur yaşı')}
              {!supportsNativeFloatIsland() ? (
                <FortaleDropdown
                  label={t('Okur yaşı')}
                  value={editableLearningAudience}
                  options={[
                    { value: '7-11', label: t('7–11 yaş') },
                    { value: '12-18', label: t('12–18 yaş') },
                    { value: 'general', label: t('Yetişkin') },
                  ]}
                  onChange={value => { setLearningAudience(value); persistLearningPreference({ audience: value }); }}
                  forceDirection="down"
                  triggerClassName="!h-[38px] !rounded-[11px] !border-white/18 !bg-white/[0.075] !text-[12px] !font-medium"
                  minMenuWidth={180}
                  wizardStyle
                />
              ) : (
                <span className="fortale-learning-select"><select value={editableLearningAudience} onChange={event => { const value = event.target.value as NonNullable<LanguageLearningProfile['audience']>; setLearningAudience(value); persistLearningPreference({ audience: value }); }}>
                  <option value="7-11">{t('7–11 yaş')}</option><option value="12-18">{t('12–18 yaş')}</option><option value="general">{t('Yetişkin')}</option>
                </select><ChevronDown className="fortale-learning-select-arrow" aria-hidden="true" size={15} /></span>
              )}
            </label> : <small className="fortale-learning-audience-note">{t('Masal yaşı 0–6 olarak ayarlı')}</small>}
          </section>}
          {entryStage === 'choice' && <div className="fortale-creation-entry-actions">
            <button ref={entryChoiceRef} type="button" className="fortale-creation-entry-option" onClick={() => {
              setCreationMode('guided'); setEntryStage('guided'); void send(undefined, 'guided');
            }}><span>{t('Fortale’ye bırak')}</span><ArrowRight size={17} /></button>
            <button type="button" className="fortale-creation-entry-option" onClick={() => {
              setCreationMode('custom'); setEntryStage('prompt'); setError(null);
              requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
            }}><span>{t('Detay gir')}</span><ArrowRight size={17} /></button>
          </div>}
          {isGuidedWaiting && <div className="fortale-creation-guided-waiting">
            {busy ? <div className="flex flex-col items-center justify-center gap-3 py-6"><FaviconSpinner size={42} /><span className="text-sm font-bold text-white/90">{t('Düşünüyor...')}</span></div> : <button type="button" className="fortale-details-next" onClick={() => void send(undefined, 'guided')}>{t('Devam Et')}<ArrowRight size={13} /></button>}
          </div>}
          {questions.length > 0 && <BookCreationDetails key={detailsRound} questions={questions} busy={busy}
            onChange={() => { setReadyDraft(null); }} onSubmit={answers => void send(answers)} attachmentControl={(
              <button type="button" className="fortale-composer-attach" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={t('Dosya Ekle')}><Paperclip size={18} /></button>
            )} />}
          <form className={isPrompt ? 'fortale-composer-prompt' : 'fortale-composer-detail-extras'} onSubmit={event => { event.preventDefault(); void send(); }}>
            {isPrompt && <textarea ref={inputRef} rows={5} maxLength={1500} value={input} readOnly={busy}
              placeholder={t('İstediğin kitabı anlat...')} aria-label={t('İstediğin kitabı anlat...')}
              onChange={event => { setReadyDraft(null); setInput(event.target.value); }}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
              }} />}
            {props.attachments.length > 0 && <div className="fortale-composer-attachments">
              {props.attachments.map(attachment => <div key={attachment.id} className="fortale-composer-attachment">
                {attachment.previewUrl ? <img src={attachment.previewUrl} alt="" /> : <Paperclip size={20} />}
                <div><strong>{attachment.file.name}</strong><small>{new Intl.NumberFormat(language, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }).format(Math.ceil(attachment.file.size / 1024))}</small></div>
                <button type="button" disabled={busy} onClick={() => props.onRemoveAttachment(attachment.id)} aria-label={t('Sil')}><Trash2 size={15} /></button>
              </div>)}
            </div>}
            {(error || props.notice) && <p className="fortale-composer-error" role="alert">{error || props.notice}</p>}
            <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={props.onAttach} />
            {isPrompt && <div className="fortale-composer-actions">
              <button type="button" className="fortale-composer-attach" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={t('Dosya Ekle')}><Paperclip size={18} /></button>
              {busy && thinkingIndicator}
              <button className="fortale-composer-send" type="submit" disabled={busy || props.suspended || (!input.trim() && !readyDraft && !hasNewAttachments)} aria-label={t('Gönder')}><ArrowUp size={20} strokeWidth={2.5} /></button>
            </div>}
            {questions.length > 0 && busy && thinkingIndicator}
          </form>
        </div>
      </section>
      </div>
    </div>, document.body,
  );
}
