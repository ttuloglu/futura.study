import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import FloatIslandSheet from './FloatIslandSheet';
import { NativeFloatIsland, supportsNativeFloatIsland } from '../utils/nativeFloatIsland';
import { lockSheetBackground } from '../utils/sheetBackground';
import { useUiI18n } from '../i18n/uiI18n';

export default function LibrarySearchDialog({ query, onSearch, onClose }: {
  query: string; onSearch: (query: string) => void; onClose: () => void;
}) {
  const { t } = useUiI18n();
  const native = supportsNativeFloatIsland();
  const [draft, setDraft] = useState(query);
  const input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onSearch, onClose });
  callbacks.current = { onSearch, onClose };
  useEffect(() => {
    if (!native) return;
    const release = lockSheetBackground();
    const requestId = crypto.randomUUID();
    let active = true;
    // StrictMode can release the effect before a native presentation has started.
    void Promise.resolve().then(() => active ? NativeFloatIsland.showLibrarySearch({ requestId, query,
      labels: { title: t('Kitap ara'), search: t('Ara'), cancel: t('Kapat') },
    }) : null).then(result => {
      if (!active || !result) return;
      if (result.submitted) callbacks.current.onSearch(result.query.trim());
      else callbacks.current.onClose();
    }).catch(() => { if (active) callbacks.current.onClose(); });
    return () => {
      active = false;
      void NativeFloatIsland.dismissLibrarySearch({ requestId }).catch(() => {});
      release();
    };
  }, [native]);
  if (native) return null;
  const close = () => { input.current?.blur(); onClose(); };
  const search = () => { input.current?.blur(); onSearch(draft.trim()); };
  return <FloatIslandSheet isOpen onClose={close} title={t('Kitap ara')} layer={1000}
    keyboardAware initialFocusRef={input} panelClassName="fortale-library-search-sheet"
    footer={<button type="button" onClick={search} className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[13px] font-bold text-[#202428]">{t('Ara')}</button>}>
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white"/>
      <input ref={input} type="search" value={draft} onChange={event => setDraft(event.target.value)}
        placeholder={t('Kitap ara')} aria-label={t('Kitap ara')} enterKeyHint="search"
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search(); } }}
        className="fortale-library-search-input h-12 w-full rounded-2xl border pl-10 pr-4 outline-none"/>
    </div>
  </FloatIslandSheet>;
}
