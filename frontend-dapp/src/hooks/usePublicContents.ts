// frontend-dapp/src/hooks/usePublicContents.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { usePublicClient, useAccount } from "wagmi";
// Importa AbiEvent per la tipizzazione corretta
import { Abi, decodeEventLog, Address, encodeEventTopics, AbiEvent } from "viem";
import { toast } from "react-hot-toast";

import {
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";

export interface PublicContentData {
  contentId: bigint;
  title: string;
  description: string;
  maxCopies: bigint;
  mintedCopies: bigint;
  mainDocumentURI: string;
  originalDocumentFileCID: string | null;
  previewImageCID: string | null;
  firstMintMetadataJsonUri: string | null;
  mintPrice: bigint;
  isAvailable: boolean;
  author: Address;
}

interface NftJsonMetadata {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  originalDocumentFileCID?: string;
  previewImageFileCID?: string;
  templateId?: string;
}

// ******************************************************************
// Estrai la definizione specifica dell'AbiEvent 'NFTMinted'
const NFTMintedEventAbi = SCIENTIFIC_CONTENT_NFT_ABI.find(
  (item) => item.type === 'event' && item.name === 'NFTMinted'
) as AbiEvent; // Effettua il cast ad AbiEvent
// ******************************************************************

interface NFTMintedEventArgs {
  tokenId: bigint;
  contentId: bigint;
  owner: Address;
  isSpecial: boolean;
  copyNumber: bigint;
  metadataURI: string;
}

const resolveIpfsLink = (ipfsUri: string): string => {
  if (!ipfsUri) return "";
  if (ipfsUri.startsWith("ipfs://")) {
    const cid = ipfsUri.replace("ipfs://", "");
    return `https://${cid}.ipfs.dweb.link/`;
  }
  return ipfsUri;
};

export const usePublicContents = () => {
  const [registeredContents, setRegisteredContents] = useState<PublicContentData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: ARBITRUM_SEPOLIA_CHAIN_ID });

  const mintedEventsCache = useRef<Map<bigint, { count: bigint; firstMintMetadataURI: string | null }>>(new Map());
  const contentMetadataCache = useRef<Map<string, NftJsonMetadata>>(new Map());

  const fetchIpfsMetadata = useCallback(async (uri: string): Promise<NftJsonMetadata | null> => {
    if (!uri) return null;
    const resolvedUri = resolveIpfsLink(uri);

    if (contentMetadataCache.current.has(resolvedUri)) {
      return contentMetadataCache.current.get(resolvedUri)!;
    }

    try {
      const response = await fetch(resolvedUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch IPFS metadata from ${resolvedUri}: ${response.statusText}`);
      }
      const data: NftJsonMetadata = await response.json();
      contentMetadataCache.current.set(resolvedUri, data);
      return data;
    } catch (err) {
      console.error(`Error fetching IPFS metadata for ${uri}:`, err);
      return null;
    }
  }, []);

  const fetchRegisteredContents = useCallback(async () => {
    if (!publicClient || !isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
      setRegisteredContents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextContentId = await publicClient.readContract({
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
        functionName: "nextContentId",
      }) as bigint;

      const contentIdsToFetch: bigint[] = [];
      for (let i = BigInt(0); i < nextContentId; i++) {
        contentIdsToFetch.push(i);
      }

      // ******************************************************************
      // Soluzione per l'errore 'abi' does not exist in type 'AbiEvent'.
      // Passa direttamente l'AbiEvent estratto.
      const allMintLogs = await publicClient.getLogs({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        event: NFTMintedEventAbi, // Passa l'AbiEvent direttamente
        fromBlock: BigInt(0),
        toBlock: "latest",
      });
      // ******************************************************************

      mintedEventsCache.current.clear();
      const tempMintCounts = new Map<bigint, { count: bigint; firstMintMetadataURI: string | null }>();

      for (const log of allMintLogs) {
        try {
          const decoded = decodeEventLog({
            abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
            eventName: "NFTMinted",
            topics: log.topics,
            data: log.data,
          });

          // Esegui un type guard robusto per `NFTMintedEventArgs`
          if (
            decoded.eventName === "NFTMinted" &&
            decoded.args &&
            typeof decoded.args === 'object' &&
            'tokenId' in decoded.args && typeof (decoded.args as any).tokenId === 'bigint' &&
            'contentId' in decoded.args && typeof (decoded.args as any).contentId === 'bigint' &&
            'owner' in decoded.args && typeof (decoded.args as any).owner === 'string' &&
            'isSpecial' in decoded.args && typeof (decoded.args as any).isSpecial === 'boolean' &&
            'copyNumber' in decoded.args && typeof (decoded.args as any).copyNumber === 'bigint' &&
            'metadataURI' in decoded.args && typeof (decoded.args as any).metadataURI === 'string'
          ) {
            const args = decoded.args as NFTMintedEventArgs;

            const contentId = args.contentId;
            const metadataURI = args.metadataURI;

            let currentData = tempMintCounts.get(contentId) || { count: BigInt(0), firstMintMetadataURI: null };
            currentData.count++;
            if (currentData.firstMintMetadataURI === null) {
              currentData.firstMintMetadataURI = metadataURI;
            }
            tempMintCounts.set(contentId, currentData);
          } else {
            console.warn("Could not decode NFTMinted log correctly or missing args:", decoded, log);
          }
        } catch (decodeErr) {
          console.warn("Could not decode NFTMinted log:", decodeErr, log);
        }
      }
      mintedEventsCache.current = tempMintCounts;

      const contentsPromises = contentIdsToFetch.map(async (id) => {
        const contentDetailsTuple = await publicClient.readContract({
          address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
          abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
          functionName: "getContent",
          args: [id],
        }) as [`0x${string}`, string, string, bigint, bigint, string, bigint, boolean, bigint];

        const contentDetails = {
          author: contentDetailsTuple[0],
          title: contentDetailsTuple[1],
          description: contentDetailsTuple[2],
          maxCopies: contentDetailsTuple[3],
          mintedCopies: contentDetailsTuple[4],
          mainDocumentURI: contentDetailsTuple[5],
          mintPrice: contentDetailsTuple[6],
          isAvailable: contentDetailsTuple[7],
          registeredAt: contentDetailsTuple[8],
        };

        const { count: mintedCountFromEvents, firstMintMetadataURI } = mintedEventsCache.current.get(id) || { count: BigInt(0), firstMintMetadataURI: null };

        let previewImageCID: string | null = null;
        let originalDocumentFileCID: string | null = null;

        if (firstMintMetadataURI) {
          const metadata = await fetchIpfsMetadata(firstMintMetadataURI);
          if (metadata) {
            previewImageCID = metadata.previewImageFileCID?.replace("ipfs://", "") || null;
            originalDocumentFileCID = metadata.originalDocumentFileCID?.replace("ipfs://", "") || null;
          }
        }

        return {
          contentId: id,
          title: contentDetails.title,
          description: contentDetails.description,
          maxCopies: contentDetails.maxCopies,
          mintedCopies: mintedCountFromEvents,
          mainDocumentURI: contentDetails.mainDocumentURI,
          originalDocumentFileCID: originalDocumentFileCID,
          previewImageCID: previewImageCID,
          firstMintMetadataJsonUri: firstMintMetadataURI,
          mintPrice: contentDetails.mintPrice,
          isAvailable: contentDetails.isAvailable && mintedCountFromEvents < contentDetails.maxCopies,
          author: contentDetails.author,
        };
      });

      const results = await Promise.all(contentsPromises);
      setRegisteredContents(results);
    } catch (err: any) {
      console.error("Error fetching registered contents:", err);
      setError(err.message || "Failed to fetch registered contents.");
      toast.error("Errore nel caricamento dei contenuti registrati.");
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, isConnected, chainId, fetchIpfsMetadata]);

  useEffect(() => {
    fetchRegisteredContents();
    const interval = setInterval(fetchRegisteredContents, 20 * 1000);
    return () => clearInterval(interval);
  }, [fetchRegisteredContents]);

  return {
    registeredContents,
    isLoading,
    error,
    refreshContents: fetchRegisteredContents,
  };
};