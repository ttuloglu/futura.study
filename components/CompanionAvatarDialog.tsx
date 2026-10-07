import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { COMPANION_AVATARS, nextCompanionAvatar, NOVA_STAR_BOOKS } from '../data/companionAvatars';
import { getCompanionAvatar, selectCompanionAvatar, subscribeCompanionAvatar } from '../utils/companionAvatar';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';
import { CompanionCharacter } from './FortaleCompanion';
import '../styles/companionAvatars.css';

export default function CompanionAvatarDialog() {
  const { t } = useUiI18n();
  const selection = useSyncExternalStore(subscribeCompanionAvatar, getCompanionAvatar, getCompanionAvatar);
  const [open, setOpen] = useState(false);
  const finish = useRef<(() => void) | undefined>(undefined);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); finish.current?.(); finish.current = undefined; }, []);
  useEffect(() => {
    const show = (event: Event) => {
      finish.current = (event as CustomEvent<{ close: () => void }>).detail.close;
      setOpen(true);
    };
    window.addEventListener('fortale:companion-avatar-picker', show);
    return () => { window.removeEventListener('fortale:companion-avatar-picker', show); finish.current?.(); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () => Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
    buttons()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const available = buttons();
      const current = available.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      available[(current + (event.shiftKey ? -1 : 1) + available.length) % available.length]?.focus();
    };
    window.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', trap); previous?.focus(); };
  }, [open]);
  const next = nextCompanionAvatar(selection.completed)
    || (selection.completed < NOVA_STAR_BOOKS ? { name: t('Yıldızlı Nova'), books: NOVA_STAR_BOOKS } : undefined);
  return <FloatIslandSheet isOpen={open} onClose={close} title={t('Avatarı değiştir')} showLogo={false}
    layer={12000} maxWidth={480} panelRef={panel} panelClassName="companion-avatar-dialog" bodyClassName="companion-avatar-content">
    <div className="companion-avatar-progress">
      <div><span>{t('Bitirilen kitap')}</span><strong>{selection.completed}</strong></div>
      {next ? <>
        <p>{t('{avatar} için {count} kitap kaldı').replace('{avatar}', next.name).replace('{count}', String(next.books - selection.completed))}</p>
        <div role="progressbar" aria-label={next.name} aria-valuenow={selection.completed} aria-valuemin={0} aria-valuemax={next.books}
          className="companion-avatar-track"><i style={{ width: `${Math.min(100, selection.completed / next.books * 100)}%` }}/></div>
      </> : <p>{t('Tüm avatarların açık!')}</p>}
    </div>
    <div className="companion-avatar-grid" role="group" aria-label={t('Okuma dostları')}>
      {COMPANION_AVATARS.map(avatar => {
        const locked = selection.completed < avatar.books;
        const selected = selection.selected === avatar.id;
        const status = locked ? t('Kilitli') : selected ? t('Seçili') : t('Açık');
        const milestone = avatar.books ? t('{count} kitapta açılır').replace('{count}', String(avatar.books)) : t('Başlangıçta açık');
        return <button key={avatar.id} type="button" disabled={locked} aria-pressed={selected}
          aria-label={`${avatar.name} · ${status} · ${milestone}`} title={milestone}
          className="companion-avatar-card" data-locked={locked} data-selected={selected}
          onClick={() => { if (selectCompanionAvatar(avatar.id)) close(); }}>
          <span className="companion-avatar-mark" aria-hidden="true">{locked ? <LockKeyhole size={12}/> : selected ? <Check size={13}/> : null}</span>
          <CompanionCharacter avatarId={avatar.id} mood="idle" size={74} animated={false}/>
          <strong>{avatar.name}</strong>
          <span className="companion-avatar-milestone">{avatar.books ? `${avatar.books} ${t('kitap')}` : t('Başlangıç')}</span>
          <span className="companion-avatar-status">{status}</span>
        </button>;
      })}
    </div>
    <div className="companion-avatar-star-reward"><span aria-hidden="true">✦</span><p><strong>{t('Yıldızlı Nova')}</strong><span>{selection.completed >= NOVA_STAR_BOOKS ? t('Açık') : t('{count} kitapta açılır').replace('{count}', String(NOVA_STAR_BOOKS))}</span></p></div>
    <p className="companion-avatar-note">{t('Her bitirilen kitap bir kez sayılır. Yeniden okumak sayıyı artırmaz.')}</p>
  </FloatIslandSheet>;
}
