"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { FlashDesign } from "./data";

type Store = {
  favorites: Set<number>;
  featured: number | null;
  /**
   * The design whose booking dialog is open, as it was when the dialog opened. The dialog shows this copy until it
   * closes, so a refresh that changes the design or takes it off the page doesn't change or close it.
   */
  bookingFor: FlashDesign | null;
  toggleFavorite: (id: number) => void;
  feature: (id: number) => void;
  openBooking: (design: FlashDesign) => void;
  closeBooking: () => void;
};

const StoreContext = createContext<Store | null>(null);

function toggled(set: Set<number>, id: number) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Favourites stay UI-only; a booking goes through the booking dialog to Payload.
export function StoreProvider({
  initialFeatured,
  children,
}: {
  initialFeatured: number | null;
  children: React.ReactNode;
}) {
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set());
  const [featured, setFeatured] = useState(initialFeatured);
  const [bookingFor, setBookingFor] = useState<FlashDesign | null>(null);

  const toggleFavorite = useCallback((id: number) => setFavorites((s) => toggled(s, id)), []);
  const feature = useCallback((id: number) => setFeatured(id), []);
  const openBooking = useCallback((design: FlashDesign) => setBookingFor(design), []);
  const closeBooking = useCallback(() => setBookingFor(null), []);

  const value = useMemo(
    () => ({ favorites, featured, bookingFor, toggleFavorite, feature, openBooking, closeBooking }),
    [favorites, featured, bookingFor, toggleFavorite, feature, openBooking, closeBooking],
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
