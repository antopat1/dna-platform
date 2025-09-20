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

  // Effetto per determinare il tema corretto in base alla pagina o al localStorage
  useEffect(() => {
    // Questo effetto viene eseguito solo sul client
    setMounted(true);

    // ********* LOGICA CORRETTA *********
    // PRIORITÀ 1: Se la pagina è /founder, forza sempre il tema chiaro all'inizio.
    if (pathname === '/founder') {
      setIsDarkMode(false);
      return; // Usciamo qui, ignorando il localStorage per questa pagina.
    }

    // PRIORITÀ 2: Per tutte le altre pagine, controlla il tema salvato.
    const savedTheme = localStorage.getItem('dna-theme');
    if (savedTheme) {
      // Se c'è un tema salvato, usa quello.
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Altrimenti, per tutte le altre pagine, il default è il tema scuro.
      setIsDarkMode(true);
    }
  }, [pathname]); // Esegui di nuovo se l'URL cambia.

  // Effetto per applicare le modifiche al DOM e salvare su localStorage
  useEffect(() => {
    // Questo effetto si occupa di salvare su localStorage e aggiornare la classe <html>
    if (mounted && isDarkMode !== null) {
      // Salva la preferenza nel localStorage
      localStorage.setItem('dna-theme', isDarkMode ? 'dark' : 'light');

      // Aggiorna la classe sul document.documentElement per il CSS globale
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

  // Previene l'hydration mismatch mostrando null finché il tema non è stato determinato sul client
  if (!mounted || isDarkMode === null) {
    return null; // o un componente di loading generico se preferisci
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

