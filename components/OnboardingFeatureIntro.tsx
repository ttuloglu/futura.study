import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';
import '../styles/onboardingFeatureIntro.css';

type IntroCard = {
  x: number;
  y: number;
  width: number;
  angle: number;
  size: number;
  surface: string;
  font: string;
  arrival?: { x: number; y: number; turn: number; duration: number };
};

const TOP_CARDS: IntroCard[] = [
  { x: 38, y: 8, width: 58, angle: -5, size: 5, surface: 'paper', font: 'serif', arrival: { x: -84, y: -100, turn: 9, duration: 0.64 } },
  { x: 67, y: 21, width: 57, angle: 8, size: 4.5, surface: 'lavender', font: 'sans', arrival: { x: 46, y: -160, turn: -14, duration: 0.72 } },
  { x: 35, y: 34, width: 58, angle: 6, size: 4.8, surface: 'coral', font: 'sans', arrival: { x: 92, y: -82, turn: -11, duration: 0.6 } },
  { x: 64, y: 47, width: 56, angle: -4, size: 4.7, surface: 'ink', font: 'mono', arrival: { x: -36, y: -120, turn: 8, duration: 0.76 } },
  { x: 36, y: 61, width: 58, angle: -7, size: 4.6, surface: 'mint', font: 'serif', arrival: { x: -70, y: -175, turn: 13, duration: 0.66 } },
  { x: 66, y: 75, width: 58, angle: 5, size: 4.7, surface: 'butter', font: 'sans', arrival: { x: 88, y: -140, turn: -10, duration: 0.7 } },
  { x: 48, y: 90, width: 68, angle: -3, size: 5.2, surface: 'silver', font: 'serif', arrival: { x: -42, y: -190, turn: 12, duration: 0.68 } },
];

const SIDE_CARDS: IntroCard[] = [
  { x: 34, y: 10, width: 58, angle: -7, size: 5.3, surface: 'paper', font: 'serif' },
  { x: 66, y: 26, width: 58, angle: 7, size: 5.2, surface: 'lavender', font: 'sans' },
  { x: 34, y: 42, width: 58, angle: -5, size: 5.4, surface: 'mint', font: 'serif' },
  { x: 66, y: 58, width: 58, angle: 6, size: 5.1, surface: 'butter', font: 'sans' },
  { x: 34, y: 74, width: 58, angle: -4, size: 5.1, surface: 'silver', font: 'mono' },
  { x: 50, y: 90, width: 78, angle: -3, size: 6.1, surface: 'coral', font: 'serif' },
];

interface OnboardingFeatureIntroProps {
  features: string[];
  direction: 'top' | 'sides';
}

export default function OnboardingFeatureIntro({ features, direction }: OnboardingFeatureIntroProps) {
  const reduceMotion = useReducedMotion();
  const [revealedCount, setRevealedCount] = useState(0);
  const cards = direction === 'top' ? TOP_CARDS : SIDE_CARDS;

  useEffect(() => {
    if (reduceMotion) {
      setRevealedCount(features.length);
      return;
    }

    setRevealedCount(0);
    let count = 0;
    let interval: number | undefined;
    const impactTimers: number[] = [];
    const reveal = () => {
      if (document.visibilityState === 'hidden') return;
      count += 1;
      setRevealedCount(count);
      impactTimers.push(window.setTimeout(triggerHaptic, direction === 'top' ? 250 : 340));
      if (count === features.length) window.clearInterval(interval);
    };
    const firstArrival = window.setTimeout(() => {
      reveal();
      if (count < features.length) interval = window.setInterval(reveal, 1000);
    }, 180);

    return () => {
      window.clearTimeout(firstArrival);
      window.clearInterval(interval);
      impactTimers.forEach(window.clearTimeout);
    };
  }, [features.length, direction, reduceMotion]);

  return (
    <section className="fortale-onboarding-intro-stage" aria-label={features.join(', ')}>
      <div className={`fortale-onboarding-intro-collage fortale-onboarding-intro-collage--${direction}`}>
        <div className="fortale-onboarding-intro-floor" aria-hidden="true" />
        <ul className="fortale-onboarding-intro-features" aria-live="polite" aria-relevant="additions">
          {cards.slice(0, revealedCount).map((card, index) => {
            const fromRight = index % 2 === 0;
            const arrival = card.arrival;
            const finalCard = direction === 'sides' && index === cards.length - 1;
            return (
              <li
                key={index}
                className={`fortale-onboarding-intro-position${finalCard ? ' fortale-onboarding-intro-position--final' : ''}`}
                style={{
                  left: `${card.x}%`,
                  top: `${card.y}%`,
                  width: `${card.width}%`,
                  zIndex: index + 1,
                  '--fortale-intro-card-font': `${card.size}cqw`,
                } as React.CSSProperties}
              >
                <motion.div
                  className={`fortale-onboarding-intro-card fortale-onboarding-intro-card--${card.surface} fortale-onboarding-intro-card--${card.font}`}
                  initial={reduceMotion
                    ? { opacity: 1, rotate: card.angle }
                    : arrival
                      ? { opacity: 0, y: arrival.y, x: arrival.x, rotate: card.angle + arrival.turn, scale: 0.94 }
                      : { opacity: 0, x: fromRight ? 640 : -640, rotate: card.angle + (fromRight ? 10 : -10), scale: 0.93 }}
                  animate={reduceMotion
                    ? { opacity: 1, rotate: card.angle }
                    : arrival
                      ? {
                          opacity: [0, 1, 1, 1, 1],
                          y: [arrival.y, 4, -8, 2, 0],
                          x: [arrival.x, -arrival.x * 0.06, arrival.x * 0.025, 0, 0],
                          rotate: [card.angle + arrival.turn, card.angle - arrival.turn * 0.12, card.angle + arrival.turn * 0.05, card.angle, card.angle],
                          scale: [0.94, 1.02, 0.99, 1.005, 1],
                        }
                      : {
                          opacity: [0, 1, 1, 1],
                          x: [fromRight ? 640 : -640, fromRight ? -16 : 16, fromRight ? 7 : -7, 0],
                          rotate: [card.angle + (fromRight ? 10 : -10), card.angle - 2, card.angle + 1, card.angle],
                          scale: [0.93, 1.02, 0.99, 1],
                        }}
                  transition={reduceMotion
                    ? { duration: 0 }
                    : arrival
                      ? { duration: arrival.duration, times: [0, 0.39, 0.66, 0.86, 1], ease: 'easeOut' }
                      : { duration: 0.7, times: [0, 0.62, 0.83, 1], ease: 'easeOut' }}
                >
                  {features[index]}
                </motion.div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
