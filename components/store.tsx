"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Store = {
  favorites: Set<string>;
  cart: Set<string>;
  featured: string;
  toggleFavorite: (id: string) => void;
  toggleCart: (id: string) => void;
  feature: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);

function toggled(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// UI-only state until checkout and accounts exist.
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [cart, setCart] = useState<Set<string>>(() => new Set());
  const [featured, setFeatured] = useState("027");

  const toggleFavorite = useCallback((id: string) => setFavorites((s) => toggled(s, id)), []);
  const toggleCart = useCallback((id: string) => setCart((s) => toggled(s, id)), []);
  const feature = useCallback((id: string) => setFeatured(id), []);

  const value = useMemo(
    () => ({ favorites, cart, featured, toggleFavorite, toggleCart, feature }),
    [favorites, cart, featured, toggleFavorite, toggleCart, feature],
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
