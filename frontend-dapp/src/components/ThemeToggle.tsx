// frontend-dapp/src/components/ThemeToggle.tsx
'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext'; // Assicurati che il percorso sia corretto

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  if (isDarkMode === null) return null;

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 bg-gray-300 dark:bg-gray-600"
      aria-label="Toggle theme"
    >

      <span
        className={`${
          isDarkMode ? 'translate-x-6' : 'translate-x-1'
        } inline-block w-4 h-4 transform bg-white dark:bg-gray-200 rounded-full transition-transform duration-200 shadow-lg`}
      />

      <Sun
        className={`absolute left-1 w-3 h-3 text-yellow-500 transition-opacity duration-200 ${
          isDarkMode ? 'opacity-0' : 'opacity-100'
        }`}
      />
    
      <Moon
        className={`absolute right-1 w-3 h-3 text-gray-300 transition-opacity duration-200 ${
          isDarkMode ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </button>
  );
}

