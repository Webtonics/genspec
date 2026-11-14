import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Engineering: white sheet, black linework, red markup. SCADA: dark sheet, green linework, amber accents. */
export type DisplayMode = 'engineering' | 'scada';

type UiState = {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
  toggleMode: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: 'engineering',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((s) => ({ mode: s.mode === 'engineering' ? 'scada' : 'engineering' })),
    }),
    {
      name: 'genspec-ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
);

/**
 * Mirror the display mode onto <html data-mode="..."> so the CSS colour tokens
 * switch. Honours a ?mode=scada or ?mode=engineering query parameter, which is
 * handy for opening the demo straight into one mode.
 */
export function bindModeToDocument() {
  const fromUrl = new URLSearchParams(window.location.search).get('mode');
  if (fromUrl === 'scada' || fromUrl === 'engineering') useUiStore.getState().setMode(fromUrl);

  const apply = (mode: DisplayMode) => {
    document.documentElement.dataset.mode = mode;
  };
  apply(useUiStore.getState().mode);
  return useUiStore.subscribe((s) => apply(s.mode));
}
