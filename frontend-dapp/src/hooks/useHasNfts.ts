// frontend-dapp/src/hooks/useHasNfts.ts

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { 
  SCIENTIFIC_CONTENT_NFT_ABI, 
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  ARBITRUM_SEPOLIA_CHAIN_ID 
} from "@/lib/constants";

export const useHasNfts = () => {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [hasNfts, setHasNfts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nftCount, setNftCount] = useState(0);

  useEffect(() => {
    const checkNftBalance = async () => {
      if (!address || !isConnected || !publicClient || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        setHasNfts(false);
        setNftCount(0);
        return;
      }

      setIsLoading(true);
      try {
        // Controlla il balance dell'utente
        const balance = await publicClient.readContract({
          address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          abi: SCIENTIFIC_CONTENT_NFT_ABI,
          functionName: "balanceOf",
          args: [address],
        });

        const balanceNumber = Number(balance);
        setNftCount(balanceNumber);
        setHasNfts(balanceNumber > 0);
      } catch (error) {
        console.error("Errore nel controllo balance NFT:", error);
        setHasNfts(false);
        setNftCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    checkNftBalance();
  }, [address, isConnected, publicClient, chainId]);

  return { hasNfts, nftCount, isLoading };
};