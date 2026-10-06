import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import ComposerCompanion from './ComposerCompanion';
import { getCompanionActivity, setCompanionActivity, subscribeCompanionActivity } from '../utils/companionActivity';

// One companion follows the frontmost app dialog, including nested sheets.
// Only element geometry and edit events are read; form contents are never read.
const surfaces = '[role="dialog"][aria-modal="true"], .fortale-floatisland-sheet-panel, .fortale-cosmos-lightbox, .fortale-settings-menu, .fortale-cosmos-menu, [data-companion-dialog]';

export default function ModalCompanion() {
  const activity = useSyncExternalStore(subscribeCompanionActivity, getCompanionActivity, getCompanionActivity);
  const [surface, setSurface] = useState<{ element: HTMLElement; layer: number; key: number } | null>(null);
  const [reaction, setReaction] = useState(0);
  const panel = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const nextKey = useRef(0);
  panel.current = surface?.element ?? null;

  useEffect(() => {
    let frame = 0;
    const findSurface = () => {
      frame = 0;
      let front: HTMLElement | null = null, layer = -1;
      const statisticsOpen = Boolean(document.querySelector('.reading-stats-overlay'));
      document.querySelectorAll<HTMLElement>(surfaces).forEach(element => {
        if (element.closest('[hidden], [inert], [aria-hidden="true"], [data-companion-exclude]')) return;
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return;
        let current: HTMLElement | null = element, z = 0;
        while (current) {
          z = Math.max(z, Number(getComputedStyle(current).zIndex) || 0);
          current = current.parentElement;
        }
        if (z >= layer) { front = element; layer = z; }
      });
      setSurface(current => current?.element === front && current?.layer === layer ? current
        : front ? { element: front, layer, key: ++nextKey.current } : null);
      setCompanionActivity('modalOpen', Boolean(front) || statisticsOpen);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(findSurface); };
    const observer = new MutationObserver(records => {
      if (records.some(record => !root.current?.contains(record.target))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['aria-hidden', 'inert', 'hidden', 'class', 'style'] });
    const reactToEdit = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) setReaction(value => value + 1);
    };
    document.addEventListener('input', reactToEdit, true);
    document.addEventListener('focusin', reactToEdit, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener('input', reactToEdit, true);
      document.removeEventListener('focusin', reactToEdit, true);
      window.removeEventListener('resize', schedule);
      setCompanionActivity('modalOpen', false);
    };
  }, []);

  if (!surface) return null;
  return createPortal(<div ref={root} className="fortale-modal-companion-root" style={{ zIndex: surface.layer + 1 }} aria-hidden="true">
    <ComposerCompanion key={surface.key} dialog={panel} root={root}
      busy={surface.element.classList.contains('fortale-production-composer') && activity.planning} reaction={reaction} />
  </div>, document.body);
}
