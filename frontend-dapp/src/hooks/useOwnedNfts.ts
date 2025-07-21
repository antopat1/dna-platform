// frontend-dapp/src/hooks/useOwnedNfts.ts

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useAccount, useChainId } from "wagmi";
import { Address, getContract, formatEther, PublicClient } from "viem";
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

// NUOVI TIPI PER STATO NFT
export type NftStatusInfo =
  | { type: "inWallet" }
  | { type: "forSale"; price: string }
  | { type: "inAuction"; minPrice: string; endTime: number };

// --- INTERFACCE METADATI (invariate) ---
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

interface ExternalNFTMetadata {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
}

// --- INTERFACCIA NFT AGGIORNATA ---
export interface NFT {
  tokenId: bigint;
  owner: Address; // Proprietario attuale (può essere l'utente o il marketplace)
  status: NftStatusInfo; // Stato dettagliato
  contentId: bigint;
  author: Address;
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

export function useOwnedNfts(): UseOwnedNftsResult {
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
      // --- SETUP CONTRATTI ---
      const nftContract = getContract({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        client: { public: publicClient },
      });
      const marketplaceContract = getContract({
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        client: { public: publicClient },
      });
       const registryContract = getContract({
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        client: { public: publicClient },
      });

      const totalSupply = await nftContract.read.totalSupply();
      const limit = Math.min(Number(totalSupply), MAX_TOKEN_ID_TO_CHECK);

      // --- PASSO 1: TROVARE TUTTI GLI NFT RILEVANTI ---
      const relevantNftsData: { tokenId: bigint; owner: Address; status: NftStatusInfo }[] = [];

      const calls: Promise<any>[] = [];
      const tokenIdsToCheck = Array.from({ length: limit }, (_, i) => BigInt(i + 1));

      for (const tokenId of tokenIdsToCheck) {
        calls.push(nftContract.read.ownerOf([tokenId]));
        calls.push(marketplaceContract.read.fixedPriceListings([tokenId]));
        calls.push(marketplaceContract.read.auctions([tokenId]));
      }

      const results = await Promise.allSettled(calls);

      for (let i = 0; i < tokenIdsToCheck.length; i++) {
        const tokenId = tokenIdsToCheck[i];
        const ownerRes = results[i * 3];
        const listingRes = results[i * 3 + 1];
        const auctionRes = results[i * 3 + 2];

        if (ownerRes.status !== 'fulfilled') continue; // Se non possiamo determinare l'owner, saltiamo
        const owner = ownerRes.value as Address;
        
        let isRelevant = false;
        let status: NftStatusInfo = { type: 'inWallet' };

        // Caso 1: L'NFT è nel wallet dell'utente
        if (owner.toLowerCase() === address.toLowerCase()) {
          isRelevant = true;
          status = { type: 'inWallet' };
        }
        // Caso 2: L'NFT è di proprietà del marketplace
        else if (owner.toLowerCase() === SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS.toLowerCase()) {
            // Controlliamo se è in vendita a prezzo fisso dall'utente
            if (listingRes.status === 'fulfilled') {
                const listing = listingRes.value as readonly [`0x${string}`, bigint, bigint, boolean, bigint];
                if (listing[3] && listing[0].toLowerCase() === address.toLowerCase()) { // isActive and seller is user
                    isRelevant = true;
                    status = { type: 'forSale', price: formatEther(listing[2]) };
                }
            }
            // Controlliamo se è in asta dall'utente
            if (auctionRes.status === 'fulfilled' && !isRelevant) { // Check only if not already found
                const auction = auctionRes.value as readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, bigint, boolean, boolean];
                const currentTime = Math.floor(Date.now() / 1000);
                if (auction[7] && Number(auction[6]) > currentTime && auction[0].toLowerCase() === address.toLowerCase()) { // isActive, not ended, and seller is user
                     isRelevant = true;
                     status = { type: 'inAuction', minPrice: formatEther(auction[2]), endTime: Number(auction[6]) };
                }
            }
        }
        
        if (isRelevant) {
            relevantNftsData.push({ tokenId, owner, status });
        }
      }

      if (relevantNftsData.length === 0) {
        setOwnedNfts([]);
        setIsLoadingNfts(false);
        return;
      }

      // --- PASSO 2: RECUPERARE I METADATI PER GLI NFT RILEVANTI ---
      const nftMetadataPromises = relevantNftsData.map(data => nftContract.read.getNFTMetadata([data.tokenId]));
      const externalMetadataPromises = relevantNftsData.map(async (data) => {
        try {
            const uri = await nftContract.read.tokenURI([data.tokenId]);
            const resolvedUri = resolveIpfsLink(uri);
            const response = await fetch(resolvedUri);
            if (!response.ok) return null;
            return await response.json() as ExternalNFTMetadata;
        } catch {
            return null;
        }
      });

      const nftMetadataResults = await Promise.all(nftMetadataPromises);
      const externalMetadataResults = await Promise.all(externalMetadataPromises);

      const contentIdsToFetch = new Map<bigint, bigint>();
      nftMetadataResults.forEach((meta, i) => {
        if (meta) {
            contentIdsToFetch.set(relevantNftsData[i].tokenId, (meta as ScientificContentNFT_NFTMetadata).contentId);
        }
      });

      const uniqueContentIds = Array.from(new Set(contentIdsToFetch.values()));
      const registryMetadataPromises = uniqueContentIds.map(cid => registryContract.read.getContent([cid]));
      const registryMetadataResults = await Promise.allSettled(registryMetadataPromises);

      const registryMetadataMap = new Map<bigint, ScientificContentRegistry_ContentMetadata>();
      registryMetadataResults.forEach((res, i) => {
        if (res.status === 'fulfilled') {
            registryMetadataMap.set(uniqueContentIds[i], res.value as ScientificContentRegistry_ContentMetadata);
        }
      });

      // --- PASSO 3: COSTRUIRE L'ARRAY FINALE DI NFT ---
      const finalNfts: NFT[] = relevantNftsData.map((data, i) => {
        const nftMeta = nftMetadataResults[i] as ScientificContentNFT_NFTMetadata;
        const externalMeta = externalMetadataResults[i];
        const contentId = contentIdsToFetch.get(data.tokenId);
        const registryMeta = contentId ? registryMetadataMap.get(contentId) : undefined;

        return {
            ...data,
            contentId: nftMeta.contentId,
            author: nftMeta.author,
            randomSeed: nftMeta.randomSeed,
            hasSpecialContent: nftMeta.hasSpecialContent,
            copyNumber: nftMeta.copyNumber,
            metadataURI: nftMeta.metadataURI,
            title: registryMeta?.title || externalMeta?.name,
            description: registryMeta?.description || externalMeta?.description,
            contentIpfsHash: registryMeta?.ipfsHash,
            imageUrlFromMetadata: externalMeta?.image,
        };
      });

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
      setFetchError("Connetti il tuo wallet sulla rete Arbitrum Sepolia.");
    }
  }, [isConnected, address, publicClient, chainId, fetchOwnedNfts]);

  return {
    ownedNfts,
    isLoadingNfts,
    fetchError,
    refetchOwnedNfts: fetchOwnedNfts,
  };
}

