import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrawingRegister } from './types';

/** A drawing read, kept so reopening the studio does not call the AI again. */
export type CachedRegister = {
  /** Fingerprint of the drawing it was read from: a new upload makes it stale. */
  drawingKey: string;
  page: number;
  register: DrawingRegister;
  model: string;
  at: string;
};

type AiState = {
  /** Code for servers that set GENSPEC_ACCESS_CODE. Not the OpenAI key, which never reaches the browser. */
  accessCode: string;
  registers: Record<string, CachedRegister>;
  setAccessCode: (code: string) => void;
  saveRegister: (jobId: string, entry: CachedRegister) => void;
  clearRegister: (jobId: string, page: number) => void;
};

export const registerKey = (jobId: string, page: number) => `${jobId}:${page}`;

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      accessCode: '',
      registers: {},
      setAccessCode: (accessCode) => set({ accessCode: accessCode.trim() }),
      saveRegister: (jobId, entry) => set((s) => ({ registers: { ...s.registers, [registerKey(jobId, entry.page)]: entry } })),
      clearRegister: (jobId, page) =>
        set((s) => {
          const registers = { ...s.registers };
          delete registers[registerKey(jobId, page)];
          return { registers };
        }),
    }),
    { name: 'genspec-ai', version: 1 },
  ),
);

/** The saved read for this job page, if it came from the drawing now attached. */
export function useCachedRegister(jobId: string, page: number, drawingKey: string | undefined): CachedRegister | undefined {
  const entry = useAiStore((s) => s.registers[registerKey(jobId, page)]);
  return entry && entry.drawingKey === drawingKey ? entry : undefined;
}
