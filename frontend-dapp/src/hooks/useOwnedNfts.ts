// frontend-dapp/src/hooks/useOwnedNfts.ts

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useAccount, useChainId } from "wagmi";
import { Address, getContract, PublicClient } from "viem";
import {
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";
import { resolveIpfsLink } from "@/utils/ipfs"; // Assicurati che esista

// Definisco il tipo per i metadati dell'NFT come oggetto.
type ScientificContentNFT_NFTMetadata = {
  contentId: bigint;
  author: Address;
  randomSeed: bigint;
  hasSpecialContent: boolean;
  copyNumber: bigint;
  metadataURI: string; // Questo è l'URI IPFS che punta al JSON dei metadati dell'NFT
};

// Definisco il tipo per i metadati del contenuto dal Registry
type ScientificContentRegistry_ContentMetadata = {
  title: string;
  description: string;
  author: Address;
  contentHash: Address;
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint;
  ipfsHash: string; // Questo è l'IPFS hash del documento scientifico reale
  nftMintPrice: bigint;
};

// Interfaccia per i metadati NFT esterni (dal JSON IPFS)
interface ExternalNFTMetadata {
  name: string;
  description: string;
  image?: string; // URI IPFS per l'immagine di copertina dell'NFT
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  originalDocumentFileCID?: string;
  previewImageFileCID?: string;
}

export interface NFT {
  tokenId: bigint;
  owner: Address;
  contentId: bigint;
  author: Address;
  randomSeed: bigint;
  hasSpecialContent: boolean;
  copyNumber: bigint;
  metadataURI: string; // IPFS URI del token NFT (per metadata.json)
  // Campi aggiunti dal Registry
  title?: string;
  description?: string;
  contentIpfsHash?: string; // IPFS hash del contenuto scientifico reale
  // Nuovo campo per l'URL dell'immagine di copertina derivato dai metadati NFT
  imageUrlFromMetadata?: string; // L'URI IPFS dell'immagine
}

interface UseOwnedNftsResult {
  ownedNfts: NFT[];
  isLoadingNfts: boolean;
  fetchError: string | null;
  refetchOwnedNfts: () => void;
}

const REFATCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minuti

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
      setFetchError("Connettiti al tuo wallet sulla rete Arbitrum Sepolia.");
      setOwnedNfts([]);
      return;
    }

    const nftContractAddress: Address = SCIENTIFIC_CONTENT_NFT_ADDRESS;
    const registryContractAddress: Address = SCIENTIFIC_CONTENT_REGISTRY_ADDRESS;

    if (!nftContractAddress || !registryContractAddress) {
      setIsLoadingNfts(false);
      setFetchError(`Indirizzi contratto non configurati. Controlla le tue variabili d'ambiente (.env).`);
      setOwnedNfts([]);
      return;
    }

    setIsLoadingNfts(true);
    setFetchError(null);
    setOwnedNfts([]);

    try {
      const nftContract = getContract({
        address: nftContractAddress,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        client: publicClient,
      });

      const registryContract = getContract({
        address: registryContractAddress,
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        client: publicClient,
      });

      const totalSupply = (await nftContract.read.totalSupply()) as bigint;

      const tokenIds: bigint[] = [];
      for (let i = BigInt(1); i <= totalSupply; i++) {
        tokenIds.push(i);
      }

      const ownerPromises = tokenIds.map(tokenId =>
        nftContract.read.ownerOf([tokenId]) as Promise<Address>
      );
      const owners = await Promise.all(ownerPromises);

      const ownedTokenIds: bigint[] = [];
      const nftMetadataCallPromises: Promise<ScientificContentNFT_NFTMetadata | undefined>[] = [];

      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        const owner = owners[i];

        if (owner.toLowerCase() === address.toLowerCase()) {
          ownedTokenIds.push(tokenId);
          nftMetadataCallPromises.push(
            nftContract.read.getNFTMetadata([tokenId]) as Promise<ScientificContentNFT_NFTMetadata>
          );
        } else {
          nftMetadataCallPromises.push(Promise.resolve(undefined));
        }
      }

      const allNftMetadataResults = await Promise.all(nftMetadataCallPromises);

      const ownedNftsBaseData: Omit<NFT, 'title' | 'description' | 'contentIpfsHash' | 'imageUrlFromMetadata'>[] = [];
      const contentIdsToFetch: Map<bigint, bigint> = new Map(); // Mappa tokenId a contentId
      const externalMetadataPromises: Promise<{ tokenId: bigint; metadata: ExternalNFTMetadata } | undefined>[] = [];


      for (let i = 0; i < allNftMetadataResults.length; i++) {
        const tokenId = tokenIds[i];
        const nftMetadataResult = allNftMetadataResults[i];

        if (nftMetadataResult) {
          const contentId = nftMetadataResult.contentId;

          const nftBase: Omit<NFT, 'title' | 'description' | 'contentIpfsHash' | 'imageUrlFromMetadata'> = {
            tokenId: tokenId,
            owner: address,
            contentId: contentId,
            author: nftMetadataResult.author,
            randomSeed: nftMetadataResult.randomSeed,
            hasSpecialContent: nftMetadataResult.hasSpecialContent,
            copyNumber: nftMetadataResult.copyNumber,
            metadataURI: nftMetadataResult.metadataURI,
          };
          ownedNftsBaseData.push(nftBase);

          if (contentId > BigInt(0)) {
            contentIdsToFetch.set(tokenId, contentId);
          }

          // Fetch dei metadati esterni dall'URI IPFS
          externalMetadataPromises.push(
            (async () => {
              try {
                const resolvedUri = resolveIpfsLink(nftMetadataResult.metadataURI);
                const response = await fetch(resolvedUri);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const metadata = await response.json() as ExternalNFTMetadata;
                return { tokenId: tokenId, metadata: metadata };
              } catch (e) {
                console.warn(`[useOwnedNfts] WARNING: Impossibile recuperare metadati esterni per tokenId ${tokenId}:`, e);
                return undefined;
              }
            })()
          );
        } else {
          externalMetadataPromises.push(Promise.resolve(undefined)); // Placeholder
        }
      }

      const allExternalMetadataResults = await Promise.all(externalMetadataPromises);
      const externalMetadataMap = new Map<bigint, ExternalNFTMetadata>();
      for (const res of allExternalMetadataResults) {
        if (res) {
          externalMetadataMap.set(res.tokenId, res.metadata);
        }
      }

      const registryMetadataPromises = Array.from(contentIdsToFetch.values()).map(contentId =>
        registryContract.read.getContent([contentId]) as Promise<ScientificContentRegistry_ContentMetadata>
      );

      const registryMetadataResults = await Promise.allSettled(registryMetadataPromises);

      const contentIdToRegistryMetadataMap: Map<bigint, ScientificContentRegistry_ContentMetadata> = new Map();

      const contentIdsArray = Array.from(contentIdsToFetch.values());
      for (let i = 0; i < contentIdsArray.length; i++) {
        const contentId = contentIdsArray[i];
        const result = registryMetadataResults[i];
        if (result && result.status === 'fulfilled') {
          contentIdToRegistryMetadataMap.set(contentId, result.value);
        } else if (result && result.status === 'rejected') {
          console.warn(`[useOwnedNfts] WARNING: Impossibile recuperare i metadati dal Registry per contentId ${contentId}. Causa: ${result.reason.shortMessage || result.reason.message || String(result.reason)}`);
        }
      }

      const finalOwnedNfts: NFT[] = [];
      for (const nftBase of ownedNftsBaseData) {
        const contentRegistryMetadata = contentIdToRegistryMetadataMap.get(nftBase.contentId);
        const externalNftMetadata = externalMetadataMap.get(nftBase.tokenId);

        const finalNft: NFT = { ...nftBase };

        if (contentRegistryMetadata) {
          finalNft.title = contentRegistryMetadata.title;
          finalNft.description = contentRegistryMetadata.description;
          finalNft.contentIpfsHash = contentRegistryMetadata.ipfsHash;
        }

        // Usa l'immagine dai metadati esterni dell'NFT
        if (externalNftMetadata && externalNftMetadata.image) {
          finalNft.imageUrlFromMetadata = externalNftMetadata.image;
        }

        finalOwnedNfts.push(finalNft);
      }

      setOwnedNfts(finalOwnedNfts);
    } catch (err: any) {
      setFetchError(`Errore durante il caricamento degli NFT: ${err.shortMessage || err.message || String(err)}`);
    } finally {
      setIsLoadingNfts(false);
    }
  }, [address, isConnected, publicClient, chainId]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (isConnected && address && publicClient && chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
      fetchOwnedNfts();

      intervalId = setInterval(() => {
        fetchOwnedNfts();
      }, REFATCH_INTERVAL_MS);
    } else {
      setIsLoadingNfts(false);
      setOwnedNfts([]);
      if (!isConnected || !address) {
          setFetchError("Connetti il tuo wallet.");
      } else if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
          setFetchError("Cambia la tua rete in Arbitrum Sepolia.");
      } else {
          setFetchError("Servizio di rete non disponibile (publicClient o altro).");
      }

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, address, publicClient, chainId, fetchOwnedNfts]);

  return {
    ownedNfts,
    isLoadingNfts,
    fetchError,
    refetchOwnedNfts: fetchOwnedNfts,
  };
}
