// frontend-dapp/src/components/ClaimGovernanceModal.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FaTimes, FaCoins, FaGift } from "react-icons/fa";

interface ClaimGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftCount: number;
}

export const ClaimGovernanceModal = ({ isOpen, onClose, nftCount }: ClaimGovernanceModalProps) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);

  const handleClaim = async () => {
    setIsClaiming(true);
    
    // Qui implementerai la logica per il claim effettivo
    // Per ora simulo un delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsClaiming(false);
    setHasClaimed(true);
    
    // Chiudi il modale dopo 3 secondi
    setTimeout(() => {
      setHasClaimed(false);
      onClose();
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md mx-4 border-2 border-purple-500 animate-pulse-border">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <FaTimes className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4 animate-bounce">
            <FaGift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            🎉 Congratulazioni Early Adopter! 🎉
          </h2>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <p className="text-gray-300 mb-4 leading-relaxed">
            Per premiare l'<span className="text-purple-400 font-semibold">Early Adoption</span>, 
            il Team ha deciso di <span className="text-yellow-400 font-semibold">Airdroppare</span> ai 
            primi acquirenti <span className="text-green-400 font-bold text-xl">100 token</span> di 
            governance della piattaforma!
          </p>
          
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <FaCoins className="text-yellow-400" />
              <span>NFT posseduti: <span className="text-purple-400 font-semibold">{nftCount}</span></span>
            </div>
          </div>

          {hasClaimed && (
            <div className="bg-green-600/20 border border-green-500 rounded-lg p-4 mb-4 animate-pulse">
              <p className="text-green-400 font-semibold">
                ✅ Claim completato con successo!
              </p>
              <p className="text-green-300 text-sm mt-1">
                I token sono stati aggiunti al tuo wallet
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          {!hasClaimed ? (
            <Button
              onClick={handleClaim}
              disabled={isClaiming}
              className={`
                w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300
                ${isClaiming 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 shadow-lg hover:shadow-purple-500/50'
                }
              `}
            >
              {isClaiming ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Claiming...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <FaGift className="w-5 h-5" />
                  <span>🚀 CLAIM ADESSO!</span>
                </div>
              )}
            </Button>
          ) : (
            <Button
              onClick={onClose}
              className="w-full py-3 px-6 rounded-lg font-bold text-lg bg-green-600 hover:bg-green-700"
            >
              ✨ Fantastico! Chiudi
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            * I token di governance ti permetteranno di partecipare alle decisioni della piattaforma
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-border {
          0%, 100% {
            border-color: rgb(168, 85, 247);
          }
          50% {
            border-color: rgb(236, 72, 153);
          }
        }
        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};