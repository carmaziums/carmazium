import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Two menus, exactly like carmazium.com:
 *  - 'site'      — the header ☰: the website main menu (Home, Buy Cars, …).
 *  - 'dashboard' — the bottom "More": the website dashboard sidebar.
 */
export type DrawerMode = 'site' | 'dashboard';

interface DrawerContextValue {
  isOpen: boolean;
  mode: DrawerMode;
  /** Bottom edge of the website header, so the site menu opens under it. */
  siteMenuTop: number;
  setSiteMenuTop: (y: number) => void;
  /** Called directly as an onPress handler too, so ignore non-string args. */
  openDrawer: (mode?: DrawerMode | unknown) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue>({
  isOpen: false,
  mode: 'dashboard',
  siteMenuTop: 0,
  setSiteMenuTop: () => {},
  openDrawer: () => {},
  closeDrawer: () => {},
});

export const DrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>('dashboard');
  const [siteMenuTop, setSiteMenuTopState] = useState(0);

  const openDrawer = useCallback((next?: DrawerMode | unknown) => {
    setMode(next === 'site' ? 'site' : 'dashboard');
    setIsOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);
  const setSiteMenuTop = useCallback((y: number) => {
    setSiteMenuTopState(prev => (Math.abs(prev - y) < 1 ? prev : y));
  }, []);

  return (
    <DrawerContext.Provider value={{ isOpen, mode, siteMenuTop, setSiteMenuTop, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  );
};

export const useDrawer = () => useContext(DrawerContext);
