import { create } from 'zustand';
import type { MarkupType, Point } from '@/model/types';

export type Tool = 'select' | 'pan' | MarkupType;

/** Viewport-relative position (px) to keep fixed while zooming. */
export type ZoomAnchor = { x: number; y: number };

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 6;
const clampZoom = (z: number) => Math.min(Math.max(z, ZOOM_MIN), ZOOM_MAX);

type StudioState = {
  tool: Tool;
  selectedId: string | null;
  hoverId: string | null;
  pageNumber: number;
  zoom: number;
  zoomAnchor: ZoomAnchor | null;
  /** Bumped to ask the viewer to fit the page. */
  fitNonce: number;
  /** Points of a boundary or purge route being drawn. */
  draft: Point[];
  /** Pointer position on the page, in points. */
  cursor: Point | null;
  spaceHeld: boolean;
  showLegend: boolean;
  /** Section for new markups: undefined means the job's first section, null means unassigned. */
  newSectionId: string | null | undefined;
  /** Bumped to ask the viewer to scroll a markup into view. */
  focus: { id: string; nonce: number } | null;

  setTool: (tool: Tool) => void;
  select: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setPage: (page: number) => void;
  zoomTo: (zoom: number, anchor?: ZoomAnchor) => void;
  zoomBy: (factor: number, anchor?: ZoomAnchor) => void;
  requestFit: () => void;
  setDraft: (draft: Point[]) => void;
  setCursor: (cursor: Point | null) => void;
  setSpaceHeld: (held: boolean) => void;
  toggleLegend: () => void;
  setNewSection: (id: string | null) => void;
  focusMarkup: (id: string, page: number) => void;
  reset: () => void;
};

const initial = {
  tool: 'select' as Tool,
  selectedId: null,
  hoverId: null,
  pageNumber: 1,
  zoom: 1,
  zoomAnchor: null,
  draft: [],
  cursor: null,
  spaceHeld: false,
  newSectionId: undefined,
  focus: null,
};

/** Transient Markup studio state (not persisted): tool, selection, zoom, drafts. */
export const useStudio = create<StudioState>()((set, get) => ({
  ...initial,
  fitNonce: 0,
  showLegend: true,

  setTool: (tool) => set({ tool, draft: [] }),
  select: (selectedId) => set({ selectedId }),
  setHover: (hoverId) => set({ hoverId }),
  setPage: (pageNumber) => set({ pageNumber, selectedId: null, draft: [] }),
  zoomTo: (zoom, anchor) => set({ zoom: clampZoom(zoom), zoomAnchor: anchor ?? null }),
  zoomBy: (factor, anchor) => set({ zoom: clampZoom(get().zoom * factor), zoomAnchor: anchor ?? null }),
  requestFit: () => set({ fitNonce: get().fitNonce + 1 }),
  setDraft: (draft) => set({ draft }),
  setCursor: (cursor) => set({ cursor }),
  setSpaceHeld: (spaceHeld) => set({ spaceHeld }),
  toggleLegend: () => set({ showLegend: !get().showLegend }),
  setNewSection: (newSectionId) => set({ newSectionId }),
  focusMarkup: (id, page) => set({ selectedId: id, pageNumber: page, focus: { id, nonce: Date.now() } }),
  reset: () => set({ ...initial, fitNonce: get().fitNonce + 1 }),
}));
