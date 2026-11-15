/**
 * Badge art and names. One badge is revealed each time the mystery meter
 * fills, in the order rewards.ts lists them. Drawn as inline SVG so the
 * challenge page never waits on an image request.
 */

import type { UiLanguage } from '../quiz/quizStore.js';
import { BADGE_IDS, type BadgeId } from '../rewards/rewards.js';

interface BadgeArt {
  name: Record<UiLanguage, string>;
  /** Disc colour. The glyph itself is always white. */
  colour: string;
  /** Path data on a 48 by 48 grid. */
  path: string;
}

const BADGES: Record<BadgeId, BadgeArt> = {
  star: {
    name: { en: 'Star', es: 'Estrella' },
    colour: '#f5a400',
    path: 'M24 6l5.3 11.6 12.7 1.5-9.4 8.7 2.5 12.5L24 34.1 12.9 40.3l2.5-12.5L6 19.1l12.7-1.5z',
  },
  bolt: {
    name: { en: 'Bolt', es: 'Rayo' },
    colour: '#7b3fe4',
    path: 'M27 4L10 27h11l-3 17 18-24H25z',
  },
  moon: {
    name: { en: 'Moon', es: 'Luna' },
    colour: '#2a5bd7',
    path: 'M32 6a18 18 0 1 0 10 28A16 16 0 0 1 32 6z',
  },
  diamond: {
    name: { en: 'Diamond', es: 'Diamante' },
    colour: '#0aa3b5',
    path: 'M24 4l16 20-16 20L8 24z',
  },
  summit: {
    name: { en: 'Summit', es: 'Cumbre' },
    colour: '#56707d',
    path: 'M4 40L18 14l8 12 5-7 13 21z',
  },
  sun: {
    name: { en: 'Sun', es: 'Sol' },
    colour: '#ef6c00',
    path: 'M24 14a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM22 2h4v8h-4zM22 38h4v8h-4zM2 22h8v4H2zM38 22h8v4h-8z',
  },
  leaf: {
    name: { en: 'Leaf', es: 'Hoja' },
    colour: '#0b8a5b',
    path: 'M40 6C20 6 8 16 8 30c0 4 1 8 3 11 3-12 10-20 20-25-8 7-13 15-15 26 2 1 4 1 6 1 14 0 20-14 18-37z',
  },
  shield: {
    name: { en: 'Shield', es: 'Escudo' },
    colour: '#3949ab',
    path: 'M24 4l16 6v12c0 10-7 18-16 22C15 40 8 32 8 22V10z',
  },
  drop: {
    name: { en: 'Drop', es: 'Gota' },
    colour: '#0288d1',
    path: 'M24 4s14 16 14 26a14 14 0 0 1-28 0C10 20 24 4 24 4z',
  },
  crown: {
    name: { en: 'Crown', es: 'Corona' },
    colour: '#c2185b',
    path: 'M6 36l-2-22 11 9 9-15 9 15 11-9-2 22z',
  },
  heart: {
    name: { en: 'Heart', es: 'Corazón' },
    colour: '#d90a17',
    path: 'M24 42S6 30 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 12-18 24-18 24z',
  },
  hex: {
    name: { en: 'Honeycomb', es: 'Panal' },
    colour: '#8d6e00',
    path: 'M24 4l17 10v20L24 44 7 34V14z',
  },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function badgeName(id: BadgeId, language: UiLanguage): string {
  return BADGES[id].name[language];
}

/** A round badge. `owned: false` draws the empty slot a badge will fill. */
export function renderBadge(id: BadgeId, owned: boolean, label: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = owned ? 'badge' : 'badge badge-locked';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', label);
  wrap.title = label;
  if (owned) wrap.style.setProperty('--badge', BADGES[id].colour);

  if (owned) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', BADGES[id].path);
    svg.appendChild(path);
    wrap.appendChild(svg);
  }
  return wrap;
}

export function allBadgeIds(): readonly BadgeId[] {
  return BADGE_IDS;
}
