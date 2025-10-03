"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, createWalletClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { FaTimes, FaCoins, FaGift } from "react-icons/fa";
import { decryptPrivateKeySecurely } from "./crypto.utils"; 
import { 
  GOVERNANCE_TOKEN_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
  GOVERNANCE_TOKEN_AIRDROP_AMOUNT
} from "@/lib/constants";

interface ClaimGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftCount: number;
  governanceTokenBalance: number;
}

export const ClaimGovernanceModal = ({ 
  isOpen, 
  onClose, 
  nftCount, 
  governanceTokenBalance 
}: ClaimGovernanceModalProps) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const { address: userAddress, isConnected } = useAccount();

  const reloadPage = () => {
    setIsReloading(true);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleClaim = async () => {
    console.log('[DEBUG] handleClaim avviato');
    if (!isConnected || !userAddress) {
      console.warn('[DEBUG] Wallet non connesso');
      toast.error('Connetti il wallet per procedere al claim');
      return;
    }

    setIsClaiming(true);
    
    try {
      console.log('[DEBUG] Controllo ENV');
      const passphrase = process.env.NEXT_PUBLIC_FOR_CLAIM as string;
      if (!passphrase || !process.env.NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY) {
        throw new Error('Configurazione ENV per il claim mancante.');
      }

      console.log('[DEBUG] Decifratura in corso...');
      const secureKey = await decryptPrivateKeySecurely(passphrase);
      
      if (!secureKey) {
        throw new Error('Errore nella decifratura della chiave (passphrase errata o formato invalido)');
      }

      console.log('[DEBUG] Chiave decifrata con successo, setup clients...');
      const result = await secureKey.use(async (privateKey) => {
        const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);
        const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });
        const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http() });

        console.log('[DEBUG] Verifica balance sender...');
        const senderBalance = await publicClient.readContract({
          address: GOVERNANCE_TOKEN_ADDRESS,
          abi: GOVERNANCE_TOKEN_ABI,
          functionName: "balanceOf",
          args: [account.address],
        }) as bigint;

        const amount = BigInt(GOVERNANCE_TOKEN_AIRDROP_AMOUNT);

        if (senderBalance < amount) {
          throw new Error(`Balance insufficiente sull'account sender (${account.address}): ${senderBalance} < ${amount}`);
        }
        console.log('[DEBUG] Balance sender sufficiente:', senderBalance.toString());

        console.log('[DEBUG] Invio transazione transfer a:', userAddress, 'amount:', amount.toString());
        const hash = await walletClient.writeContract({
          address: GOVERNANCE_TOKEN_ADDRESS,
          abi: GOVERNANCE_TOKEN_ABI,
          functionName: "transfer",
          args: [userAddress, amount],
        });

        console.log('[DEBUG] Transazione inviata, hash:', hash);
        await publicClient.waitForTransactionReceipt({ hash });
        
        console.log('[DEBUG] Transazione confermata! Procedendo con il reload...');
        return hash;
      });

      toast.success(`🎉 Claim completato! Hash: ${result.substring(0, 10)}...`);
      setHasClaimed(true);
      
      setTimeout(() => {
        console.log('[DEBUG] Ricaricamento pagina in corso...');
        reloadPage();
      }, 3000);

    } catch (error) {
      console.error('[DEBUG] Errore durante il claim:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast.error(`Errore durante il claim: ${errorMessage}`);
      setIsClaiming(false); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm" 
        onClick={!isClaiming && !hasClaimed ? onClose : undefined}
      />
      
      <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md mx-4 border-2 border-purple-500 animate-pulse-border">
        {!isClaiming && !hasClaimed && !isReloading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4 animate-bounce">
            <FaGift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            🎉 Congratulazioni Early Adopter! 🎉
          </h2>
        </div>

        <div className="text-center mb-8">
          <p className="text-gray-300 mb-4 leading-relaxed">
            Per premiare l'<span className="text-purple-400 font-semibold">Early Adoption</span>, 
            il Team ha deciso di <span className="text-yellow-400 font-semibold">Airdroppare</span> ai 
            primi acquirenti <span className="text-green-400 font-bold text-xl">100 token</span> di 
            governance della piattaforma!
          </p>
          
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <FaCoins className="text-yellow-400" />
              <span>NFT posseduti: <span className="text-purple-400 font-semibold">{nftCount}</span></span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <FaGift className="text-green-400" />
              <span>Governance Token attuali: <span className="text-green-400 font-semibold">{governanceTokenBalance}</span></span>
            </div>
          </div>

          {hasClaimed && (
            <div className="bg-green-600/20 border border-green-500 rounded-lg p-4 mb-4 animate-pulse">
              <p className="text-green-400 font-semibold">✅ Claim completato con successo!</p>
              <p className="text-green-300 text-sm mt-1">
                {isReloading ? 'Ricaricamento pagina...' : 'I token sono stati aggiunti al tuo wallet'}
              </p>
              {isReloading && (
                <div className="flex items-center justify-center mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          {!hasClaimed ? (
            <Button
              onClick={handleClaim}
              disabled={isClaiming}
              className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 ${isClaiming ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 shadow-lg hover:shadow-purple-500/50'}`}
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
            <Button disabled={true} className="w-full py-3 px-6 rounded-lg font-bold text-lg bg-green-600 cursor-not-allowed opacity-75">
              {isReloading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Ricaricamento...</span>
                </div>
              ) : ( '✨ Claim completato!' )}
            </Button>
          )}
        </div>

        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">* I token di governance ti permetteranno di partecipare alle decisioni della piattaforma</p>
          {hasClaimed && <p className="text-xs text-green-400 mt-1">La pagina si ricaricherà automaticamente per aggiornare i dati...</p>}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-border {
          0%, 100% { border-color: rgb(168 85 247); }
          50% { border-color: rgb(236 72 153); }
        }
        .animate-pulse-border { animation: pulse-border 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

