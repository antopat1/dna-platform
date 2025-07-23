// frontend-dapp/src/hooks/useMarketplaceNfts.ts

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useChainId } from "wagmi";
import { Address, getContract, formatEther } from "viem";
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
import { NFT, NftStatusInfo } from './useOwnedNfts';

type NftMetadataFromContract = {
  contentId: bigint;
  author: Address;
  randomSeed: bigint;
  hasSpecialContent: boolean;
  copyNumber: bigint;
  metadataURI: string;
};

type ContentFromRegistry = {
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

interface UseMarketplaceNftsResult {
  listedNfts: NFT[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useMarketplaceNfts = (): UseMarketplaceNftsResult => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [listedNfts, setListedNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketplaceNfts = useCallback(async () => {
    if (!publicClient || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
      setListedNfts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setListedNfts([]);

    try {
      const nftContract = getContract({ address: SCIENTIFIC_CONTENT_NFT_ADDRESS, abi: SCIENTIFIC_CONTENT_NFT_ABI, client: { public: publicClient } });
      const marketplaceContract = getContract({ address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI, client: { public: publicClient } });
      const registryContract = getContract({ address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS, abi: SCIENTIFIC_CONTENT_REGISTRY_ABI, client: { public: publicClient } });
      
      const totalSupply = await nftContract.read.totalSupply() as bigint;
      const limit = Math.min(Number(totalSupply), MAX_TOKEN_ID_TO_CHECK);

      const tokenIdsToCheck = Array.from({ length: limit }, (_, i) => BigInt(i + 1));

      const calls = tokenIdsToCheck.map(tokenId => ([
        { address: SCIENTIFIC_CONTENT_NFT_ADDRESS, abi: SCIENTIFIC_CONTENT_NFT_ABI, functionName: 'ownerOf', args: [tokenId] },
        { address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI, functionName: 'fixedPriceListings', args: [tokenId] },
        { address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI, functionName: 'auctions', args: [tokenId] },
      ])).flat();
      
      const multicallResults = await publicClient.multicall({ contracts: calls as any, allowFailure: true });
      const relevantNftsBaseData: Omit<NFT, 'title'|'description'|'contentIpfsHash'|'imageUrlFromMetadata'>[] = [];

      for (let i = 0; i < tokenIdsToCheck.length; i++) {
        const tokenId = tokenIdsToCheck[i];
        const ownerRes = multicallResults[i * 3];
        
        if (ownerRes.status !== 'success' || (ownerRes.result as Address).toLowerCase() !== SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS.toLowerCase()) {
          continue;
        }

        const owner = ownerRes.result as Address;
        const listingRes = multicallResults[i * 3 + 1];
        const auctionRes = multicallResults[i * 3 + 2];
        
        let status: NftStatusInfo | undefined = undefined;
        let seller: Address | undefined = undefined;

        if (listingRes.status === 'success') {
          const listing = listingRes.result as readonly [Address, bigint, bigint, boolean, bigint];
          if (listing[3]) { // isActive
            seller = listing[0];
            status = { type: 'forSale', price: formatEther(listing[2]), seller };
          }
        }
        
        if (!status && auctionRes.status === 'success') {
          const auction = auctionRes.result as readonly [Address, bigint, bigint, bigint, Address, bigint, bigint, boolean, boolean];
          const currentTime = Math.floor(Date.now() / 1000);
          if (auction[7] && Number(auction[6]) > currentTime) { // isActive and not ended
            seller = auction[0];
            status = { type: 'inAuction', minPrice: formatEther(auction[2]), endTime: Number(auction[6]), seller };
          }
        }
        
        if (status && seller) {
            const nftBaseMetadata = await nftContract.read.getNFTMetadata([tokenId]) as NftMetadataFromContract;
            if (nftBaseMetadata) {
                relevantNftsBaseData.push({ tokenId, owner, status, seller, ...nftBaseMetadata });
            }
        }
      }

      if (relevantNftsBaseData.length === 0) {
        setListedNfts([]);
        setIsLoading(false);
        return;
      }
      
      const finalNftsPromises = relevantNftsBaseData.map(async (baseData) => {
        let title, description, contentIpfsHash, imageUrlFromMetadata;
        try {
            const content = await registryContract.read.getContent([baseData.contentId]) as ContentFromRegistry;
            title = content.title;
            description = content.description;
            contentIpfsHash = content.ipfsHash;
            const metadataResponse = await axios.get(resolveIpfsLink(baseData.metadataURI));
            imageUrlFromMetadata = resolveIpfsLink(metadataResponse.data.image);
        } catch { /* Ignora errori */ }
        return { ...baseData, title, description, contentIpfsHash, imageUrlFromMetadata };
      });
      const finalNfts = await Promise.all(finalNftsPromises);
      setListedNfts(finalNfts);

    } catch (err: any) {
      console.error("Errore critico durante il fetching del marketplace:", err);
      setError(`Impossibile caricare i dati: ${err.message || 'Errore sconosciuto'}`);
      setListedNfts([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, chainId]);

  useEffect(() => {
    fetchMarketplaceNfts();
  }, [fetchMarketplaceNfts]);

  return { listedNfts, isLoading, error, refetch: fetchMarketplaceNfts };
}

