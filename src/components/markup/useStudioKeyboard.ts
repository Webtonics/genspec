import { useEffect } from 'react';
import { deleteSelected, finishDraft, rotateSelected, stepHistory } from './actions';
import { useStudio } from './studioStore';
import { TOOL_BY_KEY } from './tools';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

/** Markup studio shortcuts: tools, undo and redo, delete, escape, enter, zoom, space to pan. */
export function useStudioKeyboard(jobId: string) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useStudio.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        stepHistory(jobId, e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        stepHistory(jobId, 'redo');
        return;
      }
      if (mod || e.altKey) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (!s.spaceHeld) s.setSpaceHeld(true);
          return;
        case 'Delete':
        case 'Backspace':
          if (s.selectedId) {
            e.preventDefault();
            deleteSelected(jobId);
          }
          return;
        case 'Escape':
          if (s.draft.length) s.setDraft([]);
          else if (s.tool !== 'select') s.setTool('select');
          else s.select(null);
          return;
        case 'Enter':
          if (s.draft.length) {
            e.preventDefault();
            finishDraft(jobId);
          }
          return;
        case '+':
        case '=':
          s.zoomBy(1.25);
          return;
        case '-':
          s.zoomBy(0.8);
          return;
        case '0':
          s.requestFit();
          return;
      }

      if (key === 'r' && s.selectedId) {
        rotateSelected(jobId);
        return;
      }
      const tool = TOOL_BY_KEY[e.key.toUpperCase()];
      if (tool) s.setTool(tool);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') useStudio.getState().setSpaceHeld(false);
    };
    const onBlur = () => useStudio.getState().setSpaceHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [jobId]);
}
