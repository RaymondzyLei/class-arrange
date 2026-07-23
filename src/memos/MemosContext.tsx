import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MemoNote, MemosState } from '@/types';
import { genId } from '@/utils/planSeed';
import {
  addNote,
  loadMemos,
  removeNote,
  saveMemos,
  updateNoteText,
} from './memos';

export interface MemosContextValue {
  notes: MemoNote[];
  addNote: (text: string) => void;
  updateNote: (id: string, text: string) => void;
  removeNote: (id: string) => void;
}

const MemosContext = createContext<MemosContextValue | null>(null);

interface MemosProviderProps {
  children: ReactNode;
}

export function MemosProvider({ children }: MemosProviderProps) {
  const [state, setState] = useState<MemosState>(() => loadMemos());
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  const addNoteCallback = useCallback((text: string) => {
    const next = addNote(latestStateRef.current, {
      id: genId(),
      text,
      updatedAt: Date.now(),
    });
    if (next === latestStateRef.current) return;
    latestStateRef.current = next;
    setState(next);
    saveMemos(next);
  }, []);

  const updateNote = useCallback((id: string, text: string) => {
    const next = updateNoteText(latestStateRef.current, id, text, Date.now());
    if (next === latestStateRef.current) return;
    latestStateRef.current = next;
    setState(next);
    saveMemos(next);
  }, []);

  const removeNoteCallback = useCallback((id: string) => {
    const next = removeNote(latestStateRef.current, id);
    if (next === latestStateRef.current) return;
    latestStateRef.current = next;
    setState(next);
    saveMemos(next);
  }, []);

  const value = useMemo<MemosContextValue>(
    () => ({
      notes: state.notes,
      addNote: addNoteCallback,
      updateNote,
      removeNote: removeNoteCallback,
    }),
    [addNoteCallback, removeNoteCallback, state.notes, updateNote],
  );

  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosContextValue {
  const context = useContext(MemosContext);
  if (!context) throw new Error('useMemos must be used within MemosProvider');
  return context;
}
