// frontend-dapp/src/hooks/useHasNfts.ts

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { 
  SCIENTIFIC_CONTENT_NFT_ABI, 
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  GOVERNANCE_TOKEN_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
  ARBITRUM_SEPOLIA_CHAIN_ID 
} from "@/lib/constants";

export const useHasNfts = () => {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [hasNfts, setHasNfts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nftCount, setNftCount] = useState(0);
  const [governanceTokenBalance, setGovernanceTokenBalance] = useState(0);
  const [canClaim, setCanClaim] = useState(false);

  useEffect(() => {
    const checkBalances = async () => {
      if (!address || !isConnected || !publicClient || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        setHasNfts(false);
        setNftCount(0);
        setGovernanceTokenBalance(0);
        setCanClaim(false);
        return;
      }

      setIsLoading(true);
      try {
        const nftBalance = await publicClient.readContract({
          address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          abi: SCIENTIFIC_CONTENT_NFT_ABI,
          functionName: "balanceOf",
          args: [address],
        });

        const nftBalanceNumber = Number(nftBalance);
        setNftCount(nftBalanceNumber);
        setHasNfts(nftBalanceNumber > 0);


        const govTokenBalance = await publicClient.readContract({
          address: GOVERNANCE_TOKEN_ADDRESS,
          abi: GOVERNANCE_TOKEN_ABI,
          functionName: "balanceOf",
          args: [address],
        });

        const govTokenBalanceNumber = Number(govTokenBalance);
        setGovernanceTokenBalance(govTokenBalanceNumber);

        const canClaimNow = nftBalanceNumber > 0 && govTokenBalanceNumber === 0;
        setCanClaim(canClaimNow);

      } catch (error) {
        console.error("Errore nel controllo balance:", error);
        setHasNfts(false);
        setNftCount(0);
        setGovernanceTokenBalance(0);
        setCanClaim(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkBalances();
  }, [address, isConnected, publicClient, chainId]);

  return { 
    hasNfts, 
    nftCount, 
    governanceTokenBalance, 
    canClaim, 
    isLoading 
  };
};

