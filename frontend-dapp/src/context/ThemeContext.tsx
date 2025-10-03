// frontend-dapp/src/contexts/ThemeContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    if (pathname === '/founder') {
      setIsDarkMode(false);
      return; 
    }


    const savedTheme = localStorage.getItem('dna-theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(true);
    }
  }, [pathname]); 

  
  useEffect(() => {
    if (mounted && isDarkMode !== null) {
      localStorage.setItem('dna-theme', isDarkMode ? 'dark' : 'light');
      const root = document.documentElement;
      if (isDarkMode) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  }, [isDarkMode, mounted]);

  const toggleTheme = () => {
    if (isDarkMode === null) return;
    setIsDarkMode(prev => !prev);
  };


  if (!mounted || isDarkMode === null) {
    return null; 
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme deve essere usato all'interno di un ThemeProvider");
  }
  return context;
}

