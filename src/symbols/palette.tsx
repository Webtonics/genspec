import { createContext, useContext } from 'react';
import type { DisplayMode } from '@/store/uiStore';

/**
 * Explicit colours for generated drawings. Symbols take colours from here rather
 * than CSS classes, so a downloaded SVG or PNG looks exactly like the screen.
 */
export type DiagramPalette = {
  background: string;
  /** Linework and equipment outlines. */
  line: string;
  /** Inside of symbols. */
  fill: string;
  text: string;
  muted: string;
  /** Temporary instruments (ISA bubbles). */
  instrument: string;
  /** Test section cloud and status highlights. */
  accent: string;
};

export const DIAGRAM_PALETTES: Record<DisplayMode, DiagramPalette> = {
  engineering: {
    background: '#FFFFFF',
    line: '#111111',
    fill: '#FFFFFF',
    text: '#111111',
    muted: '#5B6573',
    instrument: '#1F6FEB',
    accent: '#D7263D',
  },
  scada: {
    background: '#0B0F0E',
    line: '#00E87B',
    fill: '#0B0F0E',
    text: '#B8F5D6',
    muted: '#5E8A74',
    instrument: '#4CC9F0',
    accent: '#FFB020',
  },
};

/** Font for generated drawings, metric compatible with the layout's width table. */
export const DIAGRAM_FONT = 'Arial, Helvetica, sans-serif';

const PaletteContext = createContext<DiagramPalette>(DIAGRAM_PALETTES.engineering);

export const PaletteProvider = PaletteContext.Provider;

export const usePalette = () => useContext(PaletteContext);

/** Where a symbol sits. Every symbol is drawn around its own origin. */
export type Placement = { x?: number; y?: number; rotate?: number; scale?: number };

export function placement({ x = 0, y = 0, rotate = 0, scale = 1 }: Placement): string {
  return `translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ''}${scale !== 1 ? ` scale(${scale})` : ''}`;
}
