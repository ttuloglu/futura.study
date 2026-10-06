import { Haptics, ImpactStyle } from '@capacitor/haptics';

const MIN_IMPACT_INTERVAL_MS = 80;
let lastImpactAt = -Infinity;

/** A shared medium impact for card arrivals and interactive controls. */
export const triggerHaptic = () => {
  if (document.visibilityState === 'hidden') return;
  const now = performance.now();
  if (now - lastImpactAt < MIN_IMPACT_INTERVAL_MS) return;
  lastImpactAt = now;
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {
    // Haptics are optional on browsers and devices without a vibration motor.
  });
};

const INTERACTIVE_SELECTOR = [
  'button', 'a[href]', 'input:not([type="hidden"])', 'select', 'textarea',
  'label', 'summary', '[role="button"]', '[role="link"]', '[role="tab"]',
  '[role="switch"]', '[role="checkbox"]', '[role="radio"]', '[role="menuitem"]',
  '[role="option"]', '[tabindex]:not([tabindex="-1"])', '[data-haptic]'
].join(',');

/** Capture activation across the app, including controls rendered in portals. */
export const installInteractionHaptics = () => {
  const handleClick = (event: MouseEvent) => {
    if (!event.isTrusted || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(':disabled, [aria-disabled="true"], [inert], [data-haptic="off"]')) return;

    let element: Element | null = target;
    while (element && element !== document.body) {
      if (element.matches(INTERACTIVE_SELECTOR) || getComputedStyle(element).cursor === 'pointer') {
        triggerHaptic();
        return;
      }
      element = element.parentElement;
    }
  };

  document.addEventListener('click', handleClick, { capture: true, passive: true });
  return () => document.removeEventListener('click', handleClick, true);
};
