import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';
import { BOOK_INTAKE_OTHER_KEY, formatBookIntakeAnswers, resolveBookIntakeAnswer, type BookIntakeAnswer, type BookIntakeQuestion } from '../functions/src/bookCreationIntake';

interface Props {
  questions: BookIntakeQuestion[];
  busy: boolean;
  onSubmit: (answers: string) => void;
  onChange: () => void;
  attachmentControl: React.ReactNode;
}

// Same choice rows, recommendation badge, Other input and footer as Spone's ClarificationPanel.
export default function BookCreationDetails({ questions, busy, onSubmit, onChange, attachmentControl }: Props) {
  const { t } = useUiI18n();
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, BookIntakeAnswer>>({});
  const otherRef = useRef<HTMLInputElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const question = questions[page];
  const answer = answers[question.id];
  const other = answer?.selected === BOOK_INTAKE_OTHER_KEY;
  const hasAnswer = Boolean(resolveBookIntakeAnswer(question, answer));
  const options = question.recommended ? [question.recommended, ...question.options.filter(option => option !== question.recommended)] : question.options;
  useEffect(() => { if (other) otherRef.current?.focus(); }, [other, page]);
  useEffect(() => { questionRef.current?.focus(); }, [page]);
  const select = (selected: string) => {
    onChange();
    setAnswers(current => ({
    ...current, [question.id]: { ...current[question.id], selected: current[question.id]?.selected === selected ? '' : selected },
    }));
  };
  const next = () => {
    if (!hasAnswer || busy) return;
    if (page < questions.length - 1) setPage(current => current + 1);
    else onSubmit(formatBookIntakeAnswers(questions, answers));
  };
  return <div className="fortale-creation-details">
    <h3 ref={questionRef} tabIndex={-1} className="fortale-details-question">{question.question}</h3>
    <div className="fortale-details-options" role="group" aria-label={question.question}>
      {options.map(option => <button key={option} type="button" disabled={busy} aria-pressed={answer?.selected === option}
        className="fortale-details-option" onClick={() => select(option)}>
        <span>{option}</span><span className="fortale-details-option-marks">
          {option === question.recommended && <small>{t('Önerilen')}</small>}
          {answer?.selected === option && <Check size={14} strokeWidth={2.5} />}
        </span>
      </button>)}
      <button type="button" disabled={busy} aria-pressed={other} className="fortale-details-option" onClick={() => select(BOOK_INTAKE_OTHER_KEY)}>
        <span>{t('Diğer…')}</span>{other && <Check size={14} strokeWidth={2.5} />}
      </button>
      {other && <input ref={otherRef} className="fortale-details-other" type="text" maxLength={300} readOnly={busy}
        value={answer?.otherText || ''} placeholder={t('Belirtin…')} aria-label={t('Belirtin…')}
        style={{
          color: '#ffffff',
          WebkitTextFillColor: '#ffffff',
          caretColor: '#ffffff',
        }}
        onChange={event => { onChange(); setAnswers(current => ({ ...current, [question.id]: { selected: BOOK_INTAKE_OTHER_KEY, otherText: event.target.value } })); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); next(); } }} />}
    </div>
    <footer className="fortale-details-footer">
      {attachmentControl}
      <span className="fortale-details-page" aria-live="polite">{questions.length > 1 ? `${page + 1}/${questions.length}` : ''}</span>
      <button type="button" className="fortale-details-next" disabled={!hasAnswer || busy} onClick={next}>
        {page === questions.length - 1 ? t('Devam Et') : t('İleri')}<ArrowRight size={13} strokeWidth={2.5} />
      </button>
    </footer>
  </div>;
}
