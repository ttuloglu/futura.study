import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { CompanionCharacter, useCompanionExpressions } from './FortaleCompanion';
import { getCompanionActivity, subscribeCompanionActivity } from '../utils/companionActivity';
import { resolveCompanionMood } from '../utils/companionBehavior';
import CompanionMenu, { useCompanionMenu } from './CompanionMenu';
import { useUiI18n } from '../i18n/uiI18n';

type Pose = 'head' | 'eyes' | 'hidden' | 'show' | 'surprise' | 'clap';

export default function ComposerCompanion({ dialog, root, busy, reaction, suspended, production = false }: {
  dialog: React.RefObject<HTMLElement | null>;
  root: React.RefObject<HTMLDivElement | null>;
  busy: boolean;
  reaction: number;
  suspended?: boolean;
  production?: boolean;
}) {
  const activity = useSyncExternalStore(subscribeCompanionActivity, getCompanionActivity, getCompanionActivity);
  const menu = useCompanionMenu();
  const { t } = useUiI18n();
  const [pose, setPose] = useState<Pose>('head');
  const [anchor, setAnchor] = useState({ left: 0, top: 0, height: 0 });
  const { wink, affection, reducedMotion } = useCompanionExpressions(false, !suspended && !activity.hidden, activity.generating);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      if (!dialog.current || !root.current) return;
      const panel = dialog.current.getBoundingClientRect(), viewport = root.current.getBoundingClientRect();
      let available = Math.max(0, panel.top - Math.max(viewport.top + 8, 8));
      const inspirations = production ? dialog.current.parentElement?.querySelector('.fortale-book-inspirations') : null;
      if (inspirations) {
        available = Math.min(available, Math.max(0, panel.top - inspirations.getBoundingClientRect().bottom - 4));
        if (available < 24) {
          setAnchor(current => current.height === 0 ? current : { ...current, height: 0 });
          return;
        }
      }
      const height = Math.min(120, Math.max(24, available));
      const slot = available < 24 ? panel.left + panel.width / 2 - 60 : panel.right - 132;
      const left = Math.max(8, Math.min(viewport.width - 128, slot - viewport.left));
      const top = available >= 24 ? panel.top - viewport.top - height + 1 : Math.max(8, panel.top - viewport.top + 4);
      setAnchor(current => current.left === left && current.top === top && current.height === height ? current : { left, top, height });
    };
    const observer = new ResizeObserver(measure);
    if (dialog.current) observer.observe(dialog.current);
    if (root.current) observer.observe(root.current);
    measure();
    // Follow the sheet's opening transform as well as its final dimensions.
    const until = performance.now() + 700;
    const followOpening = () => { measure(); if (performance.now() < until) frame = requestAnimationFrame(followOpening); };
    frame = requestAnimationFrame(followOpening);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    document.addEventListener('animationend', measure, true);
    document.addEventListener('transitionend', measure, true);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true);
      document.removeEventListener('animationend', measure, true); document.removeEventListener('transitionend', measure, true);
      window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [dialog, root, production]);
  useEffect(() => {
    if (suspended || reducedMotion || menu.anchor) { setPose('head'); return; }
    if (activity.generating || (!production && (activity.command !== 'auto' || activity.excited))) { setPose('show'); return; }
    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    const poses: Pose[] = production ? ['head', 'eyes', 'hidden', 'eyes', 'head']
      : busy ? ['eyes', 'head', 'show', 'clap', 'hidden', 'eyes', 'head']
      : ['head', 'surprise', 'eyes', 'hidden', 'eyes', 'show', 'clap', 'head'];
    const play = () => {
      setPose(poses[step % poses.length]); step += 1;
      timer = setTimeout(play, poses[(step - 1) % poses.length] === 'clap' ? 2000 : 2200 + Math.random() * 1800);
    };
    play(); return () => clearTimeout(timer);
  }, [busy, suspended, reducedMotion, activity.excited, activity.generating, activity.command, menu.anchor, production]);
  useEffect(() => {
    if (!reaction || busy || suspended || reducedMotion) return;
    // React only to an edit event, without inspecting or transmitting its text.
    setPose(!production && reaction % 4 === 0 ? 'surprise' : 'head');
  }, [reaction, busy, suspended, reducedMotion, production]);
  const mood = resolveCompanionMood({ reading: false, generating: activity.generating, planning: busy,
    excited: activity.excited, command: activity.command, behindSheet: production,
    spontaneous: pose === 'surprise' ? 'surprise' : pose === 'clap' ? 'clap' : pose === 'show' ? 'happy' : 'idle' });
  return <><CompanionMenu anchor={menu.anchor} onClose={menu.close} /><div className="fortale-composer-companion" data-inspiration-peek={production && anchor.height < 64 || undefined} data-pose={anchor.height <= 40 ? 'eyes' : pose} hidden={suspended || activity.hidden || anchor.height === 0}
    style={{ left: anchor.left, top: anchor.top, height: anchor.height }}>
    <button type="button" className="fortale-composer-companion-puppet" aria-label={t('Fortale’nin küçük dostu')} aria-haspopup="menu" aria-expanded={Boolean(menu.anchor)}
      onPointerDown={event => menu.startPress(event)} onPointerMove={event => menu.movePress(event)}
      onPointerUp={() => menu.endPress()} onPointerCancel={() => menu.endPress()}
      onClick={event => menu.open(event.currentTarget)}
      onContextMenu={event => { event.preventDefault(); menu.open(event.currentTarget); }}>
      <CompanionCharacter mood={mood} wink={wink} affection={affection} size={104} />
    </button>
  </div></>;
}
