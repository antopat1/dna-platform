// frontend-dapp/src/hooks/useOwnedNfts.ts

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useAccount, useChainId } from "wagmi";
import { Address, getContract, formatEther, Abi } from "viem";
import {
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
  SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  MAX_TOKEN_ID_TO_CHECK,
} from "@/lib/constants";
import { resolveIpfsLink } from "@/utils/ipfs";
import axios from 'axios';

// --- TIPI DI STATO E INTERFACCE ---

export type NftStatusInfo =
  | { type: "inWallet" }
  | { type: "forSale"; price: string; seller: Address }
  | { type: "inAuction"; minPrice: string; endTime: number; seller: Address };

type ScientificContentNFT_NFTMetadata = {
  contentId: bigint;
  author: Address;
  randomSeed: bigint;
  hasSpecialContent: boolean;
  copyNumber: bigint;
  metadataURI: string;
};

type ScientificContentRegistry_ContentMetadata = {
  title: string;
  description: string;
  author: Address;
  contentHash: Address;
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint;
  ipfsHash: string;
  nftMintPrice: bigint;
};

export interface NFT {
  tokenId: bigint;
  owner: Address; 
  status: NftStatusInfo;
  seller?: Address; // Il venditore ATTUALE, se listato. Diverso dall'autore.
  contentId: bigint;
  author: Address; // L'autore ORIGINALE del contenuto.
  randomSeed: bigint;
  hasSpecialContent: boolean;
  copyNumber: bigint;
  metadataURI: string;
  title?: string;
  description?: string;
  contentIpfsHash?: string;
  imageUrlFromMetadata?: string;
}

interface UseOwnedNftsResult {
  ownedNfts: NFT[];
  isLoadingNfts: boolean;
  fetchError: string | null;
  refetchOwnedNfts: () => void;
}

const REFATCH_INTERVAL_MS = 5 * 60 * 1000;

export const useOwnedNfts = (): UseOwnedNftsResult => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [ownedNfts, setOwnedNfts] = useState<NFT[]>([]);
  const [isLoadingNfts, setIsLoadingNfts] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchOwnedNfts = useCallback(async () => {
    if (!publicClient || !address || !isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
      setIsLoadingNfts(false);
      setOwnedNfts([]);
      return;
    }

    setIsLoadingNfts(true);
    setFetchError(null);

    try {
      const nftContract = getContract({ address: SCIENTIFIC_CONTENT_NFT_ADDRESS, abi: SCIENTIFIC_CONTENT_NFT_ABI, client: { public: publicClient } });
      const marketplaceContract = getContract({ address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI, client: { public: publicClient } });
      const registryContract = getContract({ address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS, abi: SCIENTIFIC_CONTENT_REGISTRY_ABI, client: { public: publicClient } });

      const totalSupply = await nftContract.read.totalSupply() as bigint;
      const limit = Math.min(Number(totalSupply), MAX_TOKEN_ID_TO_CHECK);
      
      const tokenIdsToCheck = Array.from({ length: limit }, (_, i) => BigInt(i + 1));
      
      const calls = tokenIdsToCheck.flatMap(tokenId => ([
        { address: SCIENTIFIC_CONTENT_NFT_ADDRESS, abi: SCIENTIFIC_CONTENT_NFT_ABI, functionName: 'ownerOf', args: [tokenId] },
        { address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI, functionName: 'fixedPriceListings', args: [tokenId] },
        { address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI, functionName: 'auctions', args: [tokenId] },
      ]));

      const results = await publicClient.multicall({ contracts: calls as any, allowFailure: true });
      
      const relevantNftsBaseData: Omit<NFT, 'title'|'description'|'contentIpfsHash'|'imageUrlFromMetadata'>[] = [];
      
      for (let i = 0; i < tokenIdsToCheck.length; i++) {
        const tokenId = tokenIdsToCheck[i];
        const ownerRes = results[i * 3];
        const listingRes = results[i * 3 + 1];
        const auctionRes = results[i * 3 + 2];

        // --- CORREZIONE QUI ---
        if (ownerRes.status !== 'success') continue;
        const owner = ownerRes.result as Address;
        
        let isRelevant = false;
        let status: NftStatusInfo | undefined;
        let seller: Address | undefined;

        if (owner.toLowerCase() === address.toLowerCase()) {
          isRelevant = true;
          status = { type: 'inWallet' };
        } else if (owner.toLowerCase() === SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS.toLowerCase()) {
          let listingSeller: Address | undefined;
          let auctionSeller: Address | undefined;

          // --- CORREZIONE QUI ---
          if (listingRes.status === 'success') {
            const listing = listingRes.result as readonly [Address, bigint, bigint, boolean, bigint];
            if (listing[3]) listingSeller = listing[0];
          }

          // --- CORREZIONE QUI ---
          if (auctionRes.status === 'success') {
            const auction = auctionRes.result as readonly [Address, bigint, bigint, bigint, Address, bigint, bigint, boolean, boolean];
            const currentTime = Math.floor(Date.now() / 1000);
            if (auction[7] && Number(auction[6]) > currentTime) auctionSeller = auction[0];
          }
          
          if (listingSeller?.toLowerCase() === address.toLowerCase()) {
             isRelevant = true;
             seller = listingSeller;
             const listing = listingRes.result as readonly [Address, bigint, bigint, boolean, bigint];
             status = { type: 'forSale', price: formatEther(listing[2]), seller };
          } else if (auctionSeller?.toLowerCase() === address.toLowerCase()) {
             isRelevant = true;
             seller = auctionSeller;
             const auction = auctionRes.result as readonly [Address, bigint, bigint, bigint, Address, bigint, bigint, boolean, boolean];
             status = { type: 'inAuction', minPrice: formatEther(auction[2]), endTime: Number(auction[6]), seller };
          }
        }
        
        if (isRelevant && status) {
            const nftMeta = await nftContract.read.getNFTMetadata([tokenId]) as ScientificContentNFT_NFTMetadata;
            relevantNftsBaseData.push({ ...nftMeta, tokenId, owner, status, seller });
        }
      }

      if (relevantNftsBaseData.length === 0) {
        setOwnedNfts([]);
        setIsLoadingNfts(false);
        return;
      }
      
      const finalNftsPromises = relevantNftsBaseData.map(async (baseData) => {
        let title, description, contentIpfsHash, imageUrlFromMetadata;
        try {
            const content = await registryContract.read.getContent([baseData.contentId]) as ScientificContentRegistry_ContentMetadata;
            title = content.title;
            description = content.description;
            contentIpfsHash = content.ipfsHash;
            const metadataResponse = await axios.get(resolveIpfsLink(baseData.metadataURI));
            imageUrlFromMetadata = resolveIpfsLink(metadataResponse.data.image);
        } catch { /* Ignora errori metadati */ }
        return { ...baseData, title, description, contentIpfsHash, imageUrlFromMetadata };
      });
      
      const finalNfts = await Promise.all(finalNftsPromises);
      setOwnedNfts(finalNfts);

    } catch (err: any) {
      console.error("Errore fetch owned NFTs:", err);
      setFetchError(`Errore durante il caricamento degli NFT: ${err.shortMessage || err.message || String(err)}`);
    } finally {
      setIsLoadingNfts(false);
    }
  }, [address, isConnected, publicClient, chainId]);

  useEffect(() => {
    if (isConnected && address && publicClient && chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
      fetchOwnedNfts();
      const intervalId = setInterval(fetchOwnedNfts, REFATCH_INTERVAL_MS);
      return () => clearInterval(intervalId);
    } else {
      setIsLoadingNfts(false);
      setOwnedNfts([]);
    }
  }, [isConnected, address, publicClient, chainId, fetchOwnedNfts]);

  return {
    ownedNfts,
    isLoadingNfts,
    fetchError,
    refetchOwnedNfts: fetchOwnedNfts,
  };
};

