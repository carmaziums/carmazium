import { create } from 'zustand';

/**
 * Pauses the page's vertical scrolling while a finger is on an embedded
 * interactive surface (the 3D damage viewer). Android's ScrollView intercepts
 * a vertical drag before the WebView can orbit the model, so without this
 * "drag to rotate" scrolled the whole page instead of turning the car.
 *
 * Screens that host the viewer read `useScrollLocked()` into their main
 * ScrollView's `scrollEnabled`.
 */
interface ScrollLockState {
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

export const useScrollLockStore = create<ScrollLockState>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));

export const useScrollLocked = () => useScrollLockStore((s) => s.locked);
