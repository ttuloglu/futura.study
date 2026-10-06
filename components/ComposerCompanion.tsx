import React, { useEffect, useState } from 'react';
import { CompanionCharacter, useCompanionExpressions } from './FortaleCompanion';

type Pose = 'head' | 'eyes' | 'hidden' | 'show' | 'surprise' | 'clap';

export default function ComposerCompanion({ dialog, root, busy, reaction, suspended }: {
  dialog: React.RefObject<HTMLElement | null>;
  root: React.RefObject<HTMLDivElement | null>;
  busy: boolean;
  reaction: number;
  suspended?: boolean;
}) {
  const [pose, setPose] = useState<Pose>('head');
  const [anchor, setAnchor] = useState({ left: 0, top: 0, height: 0 });
  const { wink, reducedMotion } = useCompanionExpressions(false, !suspended);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      if (!dialog.current || !root.current) return;
      const panel = dialog.current.getBoundingClientRect(), viewport = root.current.getBoundingClientRect();
      const available = Math.max(0, panel.top - Math.max(viewport.top + 8, 8));
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
  }, [dialog, root]);
  useEffect(() => {
    if (suspended || reducedMotion) { setPose('head'); return; }
    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    const poses: Pose[] = busy ? ['eyes', 'head', 'show', 'clap', 'hidden', 'eyes', 'head']
      : ['head', 'surprise', 'eyes', 'hidden', 'eyes', 'show', 'clap', 'head'];
    const play = () => {
      setPose(poses[step % poses.length]); step += 1;
      timer = setTimeout(play, poses[(step - 1) % poses.length] === 'clap' ? 2000 : 2200 + Math.random() * 1800);
    };
    play(); return () => clearTimeout(timer);
  }, [busy, suspended, reducedMotion]);
  useEffect(() => {
    if (!reaction || busy || suspended || reducedMotion) return;
    // React only to an edit event, without inspecting or transmitting its text.
    setPose(reaction % 4 === 0 ? 'surprise' : 'head');
  }, [reaction, busy, suspended, reducedMotion]);
  const mood = busy && (pose === 'head' || pose === 'show') ? 'think'
    : pose === 'surprise' ? 'surprise' : pose === 'clap' ? 'clap' : pose === 'show' ? 'happy' : 'idle';
  return <div className="fortale-composer-companion" data-pose={anchor.height <= 40 ? 'eyes' : pose} aria-hidden="true" hidden={suspended}
    style={{ left: anchor.left, top: anchor.top, height: anchor.height }}>
    <div className="fortale-composer-companion-puppet"><CompanionCharacter mood={mood} wink={wink} size={104} /></div>
  </div>;
}
