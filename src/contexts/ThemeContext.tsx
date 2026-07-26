import React, {createContext, useContext} from 'react';

import {theme as defaultTheme, Theme} from '../theme';

// The design system currently ships a single mode (Figma: "Mode 1").
// The provider indirection exists so a future light/dark switch is a one-line
// change here — screens keep calling useTheme() either way.
const ThemeContext = createContext<Theme>(defaultTheme);

export const ThemeProvider = ({children}: {children: React.ReactNode}) => {
  return (
    <ThemeContext.Provider value={defaultTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => useContext(ThemeContext);
