'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCog, FaShieldAlt } from 'react-icons/fa';
import { useCoachAuth } from '@/context/CoachAuthProvider'; // Modificato l'import per usare il context
import { CoachAuthModal } from './CoachAuthModal';

export const CoachAuditButton: React.FC = () => {
  const router = useRouter();
  const {
    isAuthenticated,
    isModalOpen,
    isLoading,
    error,
    openModal,
    closeModal,
    authenticate,
    checkAuthStatus
  } = useCoachAuth();

  // Check auth status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Redirect to coach-setup when authenticated.
  // Questo useEffect ora reagirà allo stato globale del context.
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/coach-setup');
    }
  }, [isAuthenticated, router]);

  return (
    <>
      <button
        onClick={openModal}
        className="relative flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-medium rounded-lg transition-all duration-300 shadow-lg hover:shadow-purple-500/25 group overflow-hidden"
        title="Accesso Modalità Audit Coach"
      >
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-75 blur-sm group-hover:blur-md transition-all duration-300"></div>
        
        {/* Content */}
        <div className="relative flex items-center space-x-2">
          <div className="relative">
            <FaShieldAlt className="text-sm animate-pulse" />
            <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-ping"></div>
          </div>
          <span className="hidden sm:inline">Modalità Audit Coach</span>
          <span className="sm:hidden">Audit</span>
          <FaCog className="text-xs animate-spin-slow" />
        </div>

        {/* Glowing border effect */}
        <div className="absolute inset-0 rounded-lg border border-purple-400 opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
        
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-lg border border-purple-300 animate-pulse-ring opacity-30"></div>
      </button>

      <CoachAuthModal
        isOpen={isModalOpen}
        isLoading={isLoading}
        error={error}
        onClose={closeModal}
        onAuthenticate={authenticate}
      />

      <style jsx>{`
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        .animate-pulse-ring {
          animation: pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.1;
          }
          100% {
            transform: scale(1);
            opacity: 0.3;
          }
        }
      `}</style>
    </>
  );
};
