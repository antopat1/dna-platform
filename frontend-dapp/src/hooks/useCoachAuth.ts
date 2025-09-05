// frontend-dapp/src/hooks/useCoachAuth.ts
import { useState, useCallback } from 'react';

interface CoachAuthState {
  isAuthenticated: boolean;
  isModalOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useCoachAuth = () => {
  const [state, setState] = useState<CoachAuthState>({
    isAuthenticated: false,
    isModalOpen: false,
    isLoading: false,
    error: null
  });

  const openModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      error: null
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      error: null
    }));
  }, []);

  const authenticate = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const validUsername = process.env.NEXT_PUBLIC_COACH_USERNAME;
    const validPassword = process.env.NEXT_PUBLIC_COACH_PASSWORD;

    if (username === validUsername && password === validPassword) {
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        isModalOpen: false
      }));
      
      // Store auth state in sessionStorage for persistence during session
      sessionStorage.setItem('coachAuth', 'true');
      
      // *** MODIFICA CHIAVE: Imposta un cookie di sessione per il middleware ***
      // Questo cookie non ha una data di scadenza, quindi verrà cancellato alla chiusura del browser.
      // `path=/` lo rende disponibile su tutto il sito.
      document.cookie = 'coachAuth=true; path=/; SameSite=Lax';

      return true;
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Credenziali non valide'
      }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setState({
      isAuthenticated: false,
      isModalOpen: false,
      isLoading: false,
      error: null
    });
    // Rimuovi sia sessionStorage che il cookie
    sessionStorage.removeItem('coachAuth');
    document.cookie = 'coachAuth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }, []);

  const checkAuthStatus = useCallback(() => {
    // Il controllo primario rimane su sessionStorage per reattività immediata lato client
    const isAuth = sessionStorage.getItem('coachAuth') === 'true';
    setState(prev => ({
      ...prev,
      isAuthenticated: isAuth
    }));
    return isAuth;
  }, []);

  return {
    ...state,
    openModal,
    closeModal,
    authenticate,
    logout,
    checkAuthStatus
  };
};