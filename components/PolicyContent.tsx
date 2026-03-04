import React from 'react';
import { useUiI18n } from '../i18n/uiI18n';

const POLICY_LINK_RE = /(https?:\/\/[^\s]+|mailto:[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function normalizeHref(rawValue: string): string {
  const value = String(rawValue || '').trim();
  if (!value) return '#';
  if (/^mailto:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) return `mailto:${value}`;
  return value;
}

function renderInlineLinkedText(line: string): React.ReactNode {
  const matches = Array.from(line.matchAll(POLICY_LINK_RE));
  if (matches.length === 0) return line;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const matchText = match[0] || '';
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      parts.push(line.slice(lastIndex, matchIndex));
    }
    parts.push(
      <a
        key={`${matchText}-${matchIndex}-${index}`}
        href={normalizeHref(matchText)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#f97316] underline decoration-[#f97316]/60 underline-offset-4 transition hover:text-[#fb923c]"
      >
        {matchText}
      </a>
    );
    lastIndex = matchIndex + matchText.length;
  });

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

export default function PolicyContent({ content }: { content: string }) {
  const { t } = useUiI18n();
  const lines = String(t(content) || '').split('\n');

  return (
    <div className="space-y-3 text-sm leading-7 text-text-secondary">
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <div key={`spacer-${index}`} className="h-2" aria-hidden="true" />;
        }
        return (
          <p key={`line-${index}`} className="whitespace-pre-wrap">
            {renderInlineLinkedText(line)}
          </p>
        );
      })}
    </div>
  );
}
