import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TestCode } from '@/model/types';
import {
  type NitrogenRules,
  type PressureRules,
  type PumpPreset,
  type RuleSet,
  type TestCodeRule,
  makeDefaultRules,
} from '@/rules';
import { DEFAULT_TITLE_BLOCK, type TitleBlockSettings } from '@/rules/titleBlock';

type SettingsState = {
  /** The rule tables the calculations use. Starts as the shipped defaults in src/rules. */
  rules: RuleSet;
  /** Company and document numbering for every generated title block. */
  titleBlock: TitleBlockSettings;
  setTitleBlock: (patch: Partial<TitleBlockSettings>) => void;
  setTestCodeRule: (code: TestCode, patch: Partial<TestCodeRule>) => void;
  setPressureRules: (patch: Partial<PressureRules>) => void;
  setNitrogenRules: (patch: Partial<NitrogenRules>) => void;
  setPump: (id: string, patch: Partial<Omit<PumpPreset, 'id'>>) => void;
  /** Put every rule back to its shipped default. */
  resetRules: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      rules: makeDefaultRules(),
      titleBlock: { ...DEFAULT_TITLE_BLOCK },
      setTitleBlock: (patch) => set((s) => ({ titleBlock: { ...s.titleBlock, ...patch } })),

      setTestCodeRule: (code, patch) =>
        set((s) => ({
          rules: { ...s.rules, testCodes: { ...s.rules.testCodes, [code]: { ...s.rules.testCodes[code], ...patch } } },
        })),

      setPressureRules: (patch) => set((s) => ({ rules: { ...s.rules, pressure: { ...s.rules.pressure, ...patch } } })),

      setNitrogenRules: (patch) => set((s) => ({ rules: { ...s.rules, nitrogen: { ...s.rules.nitrogen, ...patch } } })),

      setPump: (id, patch) =>
        set((s) => ({
          rules: { ...s.rules, pumps: s.rules.pumps.map((p) => (p.id === id ? { ...p, ...patch } : p)) },
        })),

      resetRules: () => set({ rules: makeDefaultRules() }),
    }),
    {
      name: 'genspec-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ rules: s.rules, titleBlock: s.titleBlock }),
    },
  ),
);

export const useRules = () => useSettingsStore((s) => s.rules);
export const useTitleBlock = () => useSettingsStore((s) => s.titleBlock);
