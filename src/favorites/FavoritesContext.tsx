import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ArrangementFavoritePreferences,
  FavoriteKind,
  FavoritesState,
} from '@/types';
import { loadFavorites, saveFavorites, toggleFavorite } from './favorites';

interface FavoritesContextValue {
  state: FavoritesState;
  planIds: ReadonlySet<string>;
  arrangementIds: ReadonlySet<string>;
  timeGroupKeys: ReadonlySet<string>;
  sectionIds: ReadonlySet<string>;
  arrangementPreferences: ArrangementFavoritePreferences;
  toggle: (kind: FavoriteKind, id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

interface FavoritesProviderProps {
  children: ReactNode;
  semesterKey: string;
}

export function FavoritesProvider({ children, semesterKey }: FavoritesProviderProps) {
  const [state, setState] = useState<FavoritesState>(() => loadFavorites(semesterKey));
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  useEffect(() => {
    const loaded = loadFavorites(semesterKey);
    latestStateRef.current = loaded;
    setState(loaded);
  }, [semesterKey]);

  const toggle = useCallback((kind: FavoriteKind, id: string) => {
    const next = toggleFavorite(latestStateRef.current, kind, id);
    if (next === latestStateRef.current) return;

    latestStateRef.current = next;
    setState(next);
    saveFavorites(semesterKey, next);
  }, [semesterKey]);

  const value = useMemo<FavoritesContextValue>(() => ({
    state,
    planIds: new Set(state.planIds),
    arrangementIds: new Set(state.arrangementIds),
    timeGroupKeys: new Set(state.timeGroupKeys),
    sectionIds: new Set(state.sectionIds),
    arrangementPreferences: {
      arrangementIds: state.arrangementIds,
      timeGroupKeys: state.timeGroupKeys,
      sectionIds: state.sectionIds,
    },
    toggle,
  }), [state, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
  return context;
}
