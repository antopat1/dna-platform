// frontend-dapp/src/components/ClaimButton.tsx

"use client";

import { useState } from "react";
import { FaStar, FaGift } from "react-icons/fa";
import { useHasNfts } from "@/hooks/useHasNfts";
import { ClaimGovernanceModal } from "./ClaimGovernanceModal";

export const ClaimButton = () => {
  const { 
    hasNfts, 
    nftCount, 
    governanceTokenBalance, 
    canClaim, 
    isLoading 
  } = useHasNfts();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Non mostrare il bottone se:
  // - Sta caricando
  // - L'utente non ha NFT
  // - L'utente non può fare claim (ha già governance token)
  if (isLoading || !hasNfts || !canClaim) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative group flex items-center space-x-1 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 animate-pulse-glow"
      >
        {/* Icona principale */}
        <div className="relative">
          <FaStar className="w-3 h-3 text-white animate-spin-slow" />
          <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
        </div>
        
        {/* Testo */}
        <span className="text-white font-bold text-xs whitespace-nowrap hidden sm:inline">
          Diritto al Claim!
        </span>
        
        {/* Badge con numero NFT */}
        <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold animate-bounce">
          {nftCount}
        </div>

        {/* Effetti sparkle */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div className="absolute top-1 left-2 w-0.5 h-0.5 bg-white rounded-full animate-twinkle"></div>
          <div className="absolute bottom-2 right-3 w-0.5 h-0.5 bg-white rounded-full animate-twinkle animation-delay-500"></div>
          <div className="absolute top-3 right-1 w-0.5 h-0.5 bg-white rounded-full animate-twinkle animation-delay-1000"></div>
        </div>

        {/* Tooltip */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-40">
          <div className="text-center">
            <div className="font-semibold flex items-center space-x-1">
              <FaGift className="w-3 h-3" />
              <span>Early Adopter Reward</span>
            </div>
            <div className="text-gray-300">Clicca per il tuo airdrop!</div>
            <div className="text-gray-400 text-xs mt-1">
              NFT: {nftCount} | Gov Token: {governanceTokenBalance}
            </div>
          </div>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
        </div>
      </button>

      <ClaimGovernanceModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        nftCount={nftCount}
        governanceTokenBalance={governanceTokenBalance}
      />

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
          }
          50% {
            box-shadow: 0 0 15px rgba(234, 179, 8, 0.8);
          }
        }
        
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes twinkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        
        .animate-twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }
        
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        
        .animation-delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </>
  );
};
