'use client';

import React, { createContext, useContext, useState, useCallback, PropsWithChildren, useEffect } from 'react';
import { useRouter } from 'next/navigation';


interface CoachAuthContextType {
  isAuthenticated: boolean;
  isModalOpen: boolean;
  isLoading: boolean;
  error: string | null;
  openModal: () => void;
  closeModal: () => void;
  authenticate: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuthStatus: () => boolean;
}


const CoachAuthContext = createContext<CoachAuthContextType | undefined>(undefined);


export const CoachAuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState({
    isAuthenticated: false,
    isModalOpen: false,
    isLoading: false,
    error: null as string | null
  });
  

  const router = useRouter();

  const openModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: true, error: null }));
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false, error: null }));
  }, []);

  const authenticate = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    await new Promise(resolve => setTimeout(resolve, 500));

    const validUsername = process.env.NEXT_PUBLIC_COACH_USERNAME;
    const validPassword = process.env.NEXT_PUBLIC_COACH_PASSWORD;

    if (username === validUsername && password === validPassword) {
      setState(prev => ({ ...prev, isAuthenticated: true, isLoading: false, isModalOpen: false }));
      sessionStorage.setItem('coachAuth', 'true');
      document.cookie = 'coachAuth=true; path=/; SameSite=Lax';
      return true;
    } else {
      setState(prev => ({ ...prev, isLoading: false, error: 'Credenziali non valide' }));
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
    sessionStorage.removeItem('coachAuth');
    document.cookie = 'coachAuth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    

    router.push('/');
  }, [router]);

  const checkAuthStatus = useCallback(() => {
    const isAuth = sessionStorage.getItem('coachAuth') === 'true';
    if (isAuth !== state.isAuthenticated) {
       setState(prev => ({ ...prev, isAuthenticated: isAuth }));
    }
    return isAuth;
  }, [state.isAuthenticated]);


  useEffect(() => {
    checkAuthStatus();
  }, []);


  const value: CoachAuthContextType = {
    ...state,
    openModal,
    closeModal,
    authenticate,
    logout,
    checkAuthStatus
  };

  return (
    <CoachAuthContext.Provider value={value}>
      {children}
    </CoachAuthContext.Provider>
  );
};


export const useCoachAuth = (): CoachAuthContextType => {
  const context = useContext(CoachAuthContext);
  if (context === undefined) {
    throw new Error('useCoachAuth must be used within a CoachAuthProvider');
  }
  return context;
};