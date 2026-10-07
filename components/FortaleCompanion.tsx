import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { showReadingStats } from '../utils/readingStatsDialog';
import { getCompanionActivity, setCompanionHidden, subscribeCompanionActivity } from '../utils/companionActivity';
import { useUiI18n } from '../i18n/uiI18n';

import { randomCompanionMood, resolveCompanionMood, type CompanionMood as Mood } from '../utils/companionBehavior';
import CompanionMenu, { useCompanionMenu } from './CompanionMenu';
import { supportsNativeFloatIsland } from '../utils/nativeFloatIsland';
import { getCompanionAvatar, subscribeCompanionAvatar } from '../utils/companionAvatar';
import { NOVA_STAR_BOOKS, type CompanionAvatarId } from '../data/companionAvatars';
type Play = 'none' | 'flee' | 'hide' | 'peek' | 'found' | 'fall';

export function CompanionCharacter({ mood, wink = '', affection = '', size = 88, avatarId, animated = true }: {
  mood: Mood; wink?: string; affection?: string; size?: number; avatarId?: CompanionAvatarId; animated?: boolean;
}) {
  const selection = useSyncExternalStore(subscribeCompanionAvatar, getCompanionAvatar, getCompanionAvatar);
  const avatar = avatarId || selection.selected;
  return <span className="fortale-companion-art" data-avatar={avatar} data-animated={animated}
    data-legendary={avatar === 'nova' && selection.completed >= NOVA_STAR_BOOKS}
    data-mood={mood} data-wink={wink} data-affection={affection}
    style={{ width: size, height: size * 190 / 180 }} aria-hidden="true">
    <span className="friend-canvas" style={{ transform: `scale(${size / 180})` }}>
      <span className="friend-shadow" />
      <span className="friend-pet">
        <span className="friend-avatar-sprite" />
        <span className="friend-spark s1">✦</span><span className="friend-spark s2">✦</span><span className="friend-spark s3">✧</span>
        <span className="friend-thought"><b /><b /><b /></span>
        <span className="friend-hearts"><i>♥</i><i>♥</i><i>♥</i></span>
        <span className="friend-body">
          <span className="friend-tuft" />
          <span className="friend-arm arm-left" /><span className="friend-arm arm-right" />
          <span className="friend-face">
            <span className="friend-brow brow-left" /><span className="friend-brow brow-right" />
            <span className="friend-eye eye-left"><span /></span><span className="friend-eye eye-right"><span /></span>
            <span className="friend-cheek cheek-left" /><span className="friend-cheek cheek-right" />
            <span className="friend-mouth" />
          </span>
        </span>
        <span className="friend-foot foot-left" /><span className="friend-foot foot-right" />
        <span className="friend-book"><span /><span /></span>
      </span>
    </span>
  </span>;
}

// Shared expressions also run in the modal; all reactions stay on this device.
export function useCompanionExpressions(reading: boolean, enabled = true, joyful = false) {
  const [wink, setWink] = useState('');
  const [affection, setAffection] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setWink(''); setAffection('');
    if (!enabled || reducedMotion) return;
    let winkTimer: ReturnType<typeof setTimeout>, openTimer: ReturnType<typeof setTimeout>;
    let affectionTimer: ReturnType<typeof setTimeout>, resetTimer: ReturnType<typeof setTimeout>;
    const blink = () => {
      setWink(Math.random() > .5 ? 'left' : 'right');
      openTimer = setTimeout(() => setWink(''), 520);
      winkTimer = setTimeout(blink, 9500 + Math.random() * 7000);
    };
    const enjoy = () => {
      setAffection(joyful || Math.random() < .65 ? 'hearts' : 'delighted');
      resetTimer = setTimeout(() => setAffection(''), 2800);
      affectionTimer = setTimeout(enjoy, joyful ? 5000 + Math.random() * 4000 : 12000 + Math.random() * 10000);
    };
    winkTimer = setTimeout(blink, 4500);
    if (reading || joyful) affectionTimer = setTimeout(enjoy, joyful ? 300 : 7000);
    return () => { [winkTimer, openTimer, affectionTimer, resetTimer].forEach(clearTimeout); };
  }, [reading, enabled, reducedMotion, joyful]);
  return { wink, affection, reducedMotion };
}

export default function FortaleCompanion({ reading, hidden = false }: { reading: boolean; hidden?: boolean }) {
  const { t } = useUiI18n();
  const activity = useSyncExternalStore(subscribeCompanionActivity, getCompanionActivity, getCompanionActivity);
  const rail = useRef<HTMLDivElement>(null);
  const floorProbe = useRef<HTMLSpanElement>(null);
  const ceilingProbe = useRef<HTMLSpanElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const previousCompleted = useRef(activity.completedBooks);
  const playTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const side = useRef<'left' | 'right'>('right');
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const lastStatsTap = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(clickTimer.current), []);
  const suppressClick = useRef(false);
  const [position, setPosition] = useState(76);
  // Each activity remembers the height where the user put their companion.
  const context = activity.generating ? 'generation' : reading ? 'reading' : 'browse';
  const [rows, setRows] = useState<Partial<Record<typeof context, number>>>({});
  const [geometry, setGeometry] = useState({ width: 390, floor: 600, ceiling: 12, generation: 600 });
  const [held, setHeld] = useState(false);
  const [wandering, setWandering] = useState(false);
  const [play, setPlay] = useState<Play>('none');
  const [celebrating, setCelebrating] = useState(false);
  const [clapping, setClapping] = useState(false);
  const [spontaneous, setSpontaneous] = useState<Mood>('idle');
  const menu = useCompanionMenu();
  const available = !hidden && !activity.composerOpen && !activity.modalOpen;
  const visible = available && !activity.hidden;
  const { wink, affection, reducedMotion } = useCompanionExpressions(reading, visible && play === 'none' && !held, activity.generating || celebrating);
  const paused = !visible || held || (reading && rows[context] === undefined) || celebrating || clapping || play !== 'none' || activity.planning || Boolean(menu.anchor) || activity.excited;
  const mood: Mood = held || play === 'fall' || play === 'flee' ? 'surprise' : play === 'peek' ? 'idle'
    : play === 'found' || celebrating ? 'happy' : clapping ? 'clap'
    : resolveCompanionMood({ reading, generating: activity.generating, planning: activity.planning, excited: activity.excited, command: activity.command, spontaneous });
  const defaultY = activity.generating ? geometry.generation : geometry.floor;
  const y = rows[context] === undefined ? defaultY : geometry.ceiling + rows[context]! * (geometry.floor - geometry.ceiling);
  const clearPlayTimers = () => { playTimers.current.forEach(clearTimeout); playTimers.current = []; };

  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      if (!rail.current || !floorProbe.current) return;
      const rect = rail.current.getBoundingClientRect();
      const floor = Math.max(12, floorProbe.current.offsetTop);
      const marker = document.querySelector('[data-companion-generation-row]')?.getBoundingClientRect();
      setGeometry({ width: rect.width, floor, ceiling: Math.min(floor, ceilingProbe.current?.offsetTop || 12),
        generation: marker ? Math.max(12, Math.min(floor, marker.top - rect.top + (marker.height - 104) / 2)) : floor });
    };
    const observer = new ResizeObserver(measure);
    if (rail.current) observer.observe(rail.current);
    const marker = document.querySelector('[data-companion-generation-row]');
    if (marker) observer.observe(marker);
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [visible, context]);

  useEffect(() => {
    setWandering(false);
    if (paused || reducedMotion || activity.generating || (reading && activity.command === 'auto')) return;
    let timer: ReturnType<typeof setTimeout>;
    let previous: Mood = 'idle';
    const act = () => {
      const next: Mood = activity.command === 'auto' ? randomCompanionMood(previous) : activity.command;
      previous = next;
      setSpontaneous(next);
      setWandering(next === 'walk');
      if (next === 'walk') setPosition(current => current > 50 ? 18 + Math.random() * 12 : 70 + Math.random() * 12);
      timer = setTimeout(act, next === 'walk' ? 2800 : 4500 + Math.random() * 4500);
    };
    if (activity.command !== 'auto') act();
    else timer = setTimeout(act, 3000 + Math.random() * 3500);
    return () => { clearTimeout(timer); setWandering(false); };
  }, [paused, reducedMotion, activity.generating, reading, activity.command]);

  useEffect(() => {
    if (activity.completedBooks === previousCompleted.current) return;
    previousCompleted.current = activity.completedBooks;
    setCelebrating(true);
    const timer = setTimeout(() => setCelebrating(false), 4500);
    return () => clearTimeout(timer);
  }, [activity.completedBooks]);

  useEffect(() => {
    clearPlayTimers(); setPlay('none'); setHeld(false);
    const pointer = drag.current?.id;
    if (pointer !== undefined && target.current?.hasPointerCapture(pointer)) target.current.releasePointerCapture(pointer);
    drag.current = null;
  }, [visible, context]);
  useEffect(() => () => clearPlayTimers(), []);

  const escape = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    clearPlayTimers();
    if (play === 'peek' || play === 'hide') {
      setPlay('found'); setPosition(side.current === 'left' ? 18 : 82);
      playTimers.current.push(setTimeout(() => setPlay('none'), 2300)); return;
    }
    side.current = position >= 50 ? 'left' : 'right';
    setPlay('flee'); setPosition(side.current === 'left' ? -18 : 118);
    playTimers.current.push(
      setTimeout(() => setPlay('hide'), reducedMotion ? 0 : 700),
      setTimeout(() => { setPlay('peek'); setPosition(side.current === 'left' ? 3 : 97); }, 1600),
      setTimeout(() => { setPosition(side.current === 'left' ? 20 : 80); setPlay('found'); }, 3700),
      setTimeout(() => setPlay('none'), 5600));
  };
  const setHeight = (top: number) => setRows(current => ({ ...current, [context]:
    Math.max(0, Math.min(1, (top - geometry.ceiling) / Math.max(1, geometry.floor - geometry.ceiling))) }));
  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || !rail.current) return;
    clearPlayTimers();
    const rect = event.currentTarget.getBoundingClientRect(), parent = rail.current.getBoundingClientRect();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left - parent.left + 48, top: rect.top - parent.top, moved: false };
    menu.startPress(event);
    suppressClick.current = false; setWandering(false); setHeld(true);
    setPosition(drag.current.left / geometry.width * 100); setHeight(drag.current.top);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    menu.movePress(event);
    const start = drag.current;
    if (!start || start.id !== event.pointerId || menu.anchor) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 6) start.moved = true;
    if (!start.moved) return;
    setPlay('none');
    const x = Math.max(48, Math.min(geometry.width - 48, start.left + dx));
    setPosition(x / geometry.width * 100); setHeight(start.top + dy);
  };
  const pointerEnd = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const openedMenu = menu.endPress();
    drag.current = null; setHeld(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressClick.current = start.moved || cancelled || openedMenu;
    if(!start.moved && !cancelled && !openedMenu && !supportsNativeFloatIsland()) {
      const now=Date.now();
      if(lastStatsTap.current && now-lastStatsTap.current<350) {
        lastStatsTap.current=0;clearTimeout(clickTimer.current);clearPlayTimers();setPlay('none');suppressClick.current=true;void showReadingStats();
      } else lastStatsTap.current=now;
    } else lastStatsTap.current=0;
    if (!cancelled && start.moved && !reducedMotion && geometry.floor - y > 100 && Math.random() < .24) {
      playTimers.current.push(setTimeout(() => {
        setPlay('fall'); setRows(current => ({ ...current, [context]: 1 }));
        playTimers.current.push(setTimeout(() => setPlay('found'), 750), setTimeout(() => setPlay('none'), 1900));
      }, 900 + Math.random() * 1300));
    }
  };

  useEffect(() => {
    if (menu.anchor) { clearTimeout(clickTimer.current); clearPlayTimers(); setPlay('none'); setHeld(false); }
  }, [menu.anchor]);

  const offscreen = play === 'flee' || play === 'hide' || play === 'peek';
  return <>
    {available && activity.hidden && <button type="button" className="fortale-companion-restore" onClick={() => setCompanionHidden(false)}>{t('Avatarı göster')}</button>}
    <CompanionMenu anchor={menu.anchor} onClose={menu.close} />
    <div ref={rail} className="fortale-companion-rail" hidden={!visible}
    data-play={play} data-held={held} data-reading={reading} data-wandering={wandering} data-reduced-motion={reducedMotion}>
    <span ref={floorProbe} className="fortale-companion-floor" aria-hidden="true" />
    <span ref={ceilingProbe} className="fortale-companion-ceiling" aria-hidden="true" />
    <button ref={target} type="button" className="fortale-companion-target" aria-label={t('Fortale’nin küçük dostu')}
      aria-haspopup="menu" aria-expanded={Boolean(menu.anchor)}
      onContextMenu={event => { event.preventDefault(); menu.open(event.currentTarget); }}
      onClick={event => { if (menu.anchor || suppressClick.current) { suppressClick.current = false; return; } clearTimeout(clickTimer.current); menu.open(event.currentTarget); }}
      onDoubleClick={() => { clearTimeout(clickTimer.current); if (!supportsNativeFloatIsland() && !suppressClick.current) { void showReadingStats(); } }} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}
      style={{ left: offscreen ? `${position}%` : `clamp(48px, ${position}%, calc(100% - 48px))`, top: y,
        '--companion-travel': `${Math.min(2600, geometry.width * 5)}ms` } as React.CSSProperties}>
      <CompanionCharacter mood={mood} wink={wink} affection={affection} />
    </button>
  </div></>;
}
