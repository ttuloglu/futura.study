import React from 'react';
import { defaultTermsPolicy } from '../data/policies';
import PolicyContent from '../components/PolicyContent';
import { useUiI18n } from '../i18n/uiI18n';

export default function TermsView() {
  const { t } = useUiI18n();
  const {
    title,
    lastUpdatedLabel,
    lastUpdatedDate,
    sections
  } = defaultTermsPolicy;

  return (
    <div className="view-container animate-enter">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-left text-3xl font-semibold text-white tracking-tight">{t(title)}</h1>
          <p className="text-sm text-text-secondary">
            {t(lastUpdatedLabel)}
            {lastUpdatedDate}
          </p>
        </header>

        <div className="space-y-8 pb-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-white">{t(section.title)}</h2>
              <PolicyContent content={section.content} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
