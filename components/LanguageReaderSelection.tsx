import React, { useEffect, useRef, useState } from 'react';
import { BookOpenText, LoaderCircle } from 'lucide-react';
import { explainReaderSelection } from '../ai';
import { APP_LANGUAGE_OPTIONS } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';
import type { CourseData } from '../types';
import type { ReadingExplanation } from '../functions/src/languageLearning';
import FloatIslandSheet from './FloatIslandSheet';
import { selectionContext } from '../functions/src/languageLearning';

interface Props {
  course: CourseData;
  rootRef: React.RefObject<HTMLElement | null>;
}

interface SelectionRequest {
  text: string;
  context: string;
}

function captureSelection(root: HTMLElement, range: Range, selectedText: string): string {
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(root);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const afterRange = document.createRange();
  afterRange.selectNodeContents(root);
  afterRange.setStart(range.endContainer, range.endOffset);
  const before = beforeRange.toString();
  const after = afterRange.toString();
  const fullText = `${before}${selectedText}${after}`;
  return selectionContext(fullText, selectedText, before.length);
}

export default function LanguageReaderSelection({ course, rootRef }: Props) {
  const { t } = useUiI18n();
  const profile = course.languageLearning;
  const [selection, setSelection] = useState<SelectionRequest | null>(null);
  const selectionRef = useRef<SelectionRequest | null>(null);
  const requestRef = useRef<SelectionRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<ReadingExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const update = () => {
      const root = rootRef.current;
      const browserSelection = window.getSelection();
      if (!root || !browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) {
        setSelection(null);
        selectionRef.current = null;
        return;
      }
      const range = browserSelection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      const text = browserSelection.toString().replace(/\s+/g, ' ').trim();
      if (!text || text.length > 300) {
        setSelection(null);
        selectionRef.current = null;
        return;
      }
      const next = { text, context: captureSelection(root, range, text) };
      selectionRef.current = next;
      setSelection(current => current?.text === next.text && current.context === next.context ? current : next);
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [profile, rootRef]);

  if (!profile) return null;

  const ask = async () => {
    const current = requestRef.current || selectionRef.current || selection;
    if (!current || loading) return;
    requestRef.current = current;
    setIsOpen(true);
    setLoading(true);
    setError(false);
    setExplanation(null);
    try {
      setExplanation(await explainReaderSelection({
        bookId: course.id,
        selectedText: current.text,
        sourceContext: current.context
      }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setIsOpen(false);
    setExplanation(null);
    setError(false);
    window.getSelection()?.removeAllRanges();
    selectionRef.current = null;
    requestRef.current = null;
    setSelection(null);
  };

  const targetLanguage = APP_LANGUAGE_OPTIONS.find(option => option.code === profile.targetLanguage)?.label || profile.targetLanguage;
  const explanationLanguage = APP_LANGUAGE_OPTIONS.find(option => option.code === profile.explanationLanguage)?.label || profile.explanationLanguage;

  return <>
    {selection && !isOpen && <button type="button" className="fortale-reader-explain-trigger" onPointerDown={() => { requestRef.current = selectionRef.current || selection; }} onClick={() => void ask()}>
      <BookOpenText size={16} /><span>{t('Açıkla')}</span><span className="fortale-reader-explain-selected">{selection.text}</span>
    </button>}
    <FloatIslandSheet isOpen={isOpen} onClose={close} title={t('Dil desteği')} subtitle={`${targetLanguage} · ${profile.cefrLevel}`} layer={1200}>
      {loading ? <div className="fortale-reader-explain-loading"><LoaderCircle size={23} className="animate-spin" /><span>{t('Bağlam inceleniyor')}</span></div> : error ? <div className="space-y-3">
        <p className="text-sm text-white/75">{t('Açıklama şu anda alınamadı.')}</p>
        <button type="button" className="fortale-reader-explain-retry" onClick={() => void ask()}>{t('Tekrar dene')}</button>
      </div> : explanation && <div className="fortale-reader-explanation">
        <blockquote>{explanation.selection}</blockquote>
        <section><h3>{t('Anlamı')} · {explanationLanguage}</h3><p>{explanation.translation}</p><p>{explanation.meaning}</p></section>
        {explanation.grammar && <section><h3>{t('Dil bilgisi')}</h3><p>{explanation.grammar}</p></section>}
        {explanation.usage && <section><h3>{t('Kullanımı')}</h3><p>{explanation.usage}</p></section>}
        <section className="fortale-reader-explanation-example"><h3>{t('Örnek')} · {targetLanguage}</h3><p lang={profile.targetLanguage}>{explanation.example}</p><p>{explanation.exampleTranslation}</p></section>
      </div>}
    </FloatIslandSheet>
  </>;
}
