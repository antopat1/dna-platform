// frontend-dapp/src/hooks/useRegisteredContents.ts

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useChainId } from "wagmi";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
} from "@/lib/constants";
import { getContract, Abi, Address } from "viem";
import axios from "axios";
import { resolveIpfsLink } from "@/utils/ipfs";

type RegistryContent = {
  title: string;
  description: string;
  author: `0x${string}`;
  contentHash: `0x${string}`;
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint;
  ipfsHash: string;
  nftMintPrice: bigint;
};

export type DisplayContent = RegistryContent & {
  contentId: bigint;
  displayImageUrl?: string;
};

interface UseRegisteredContentsResult {
  registeredContents: DisplayContent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const REFETCH_INTERVAL = 60000;

export const useRegisteredContents = (): UseRegisteredContentsResult => {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [registeredContents, setRegisteredContents] = useState<DisplayContent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegisteredContents = useCallback(async () => {
    if (!publicClient || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) return;

    setError(null);

    try {
      const registryContract = getContract({ address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS, abi: SCIENTIFIC_CONTENT_REGISTRY_ABI, client: { public: publicClient } });
      const nftContract = getContract({ address: SCIENTIFIC_CONTENT_NFT_ADDRESS, abi: SCIENTIFIC_CONTENT_NFT_ABI, client: { public: publicClient } });

      const nextContentId = await registryContract.read.nextContentId() as bigint;
      if (nextContentId <= BigInt(1)) {
        setRegisteredContents([]);
        if (isLoading) setIsLoading(false);
        return;
      }

      const totalContents = Number(nextContentId) - 1;
      const contentIds = Array.from({ length: totalContents }, (_, i) => BigInt(i + 1));
      
      const contentCalls = contentIds.map(id => ({
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
        functionName: 'getContent',
        args: [id],
      }));

      const multicallResults = await publicClient.multicall({ contracts: contentCalls, allowFailure: true });
      
      let baseContents: DisplayContent[] = [];
      multicallResults.forEach((res, index) => {
        if (res.status === 'success' && res.result) {
          const content = res.result as RegistryContent;
          const contentId = contentIds[index];
          baseContents.push({ ...content, contentId });
        }
      });
      
      const enrichedPromises = baseContents.map(async (content) => {
        if (content.mintedCopies > BigInt(0)) {
            try {
                const tokenURI = await nftContract.read.tokenURIOfContent([content.contentId]) as string;
                const metadataResponse = await axios.get(resolveIpfsLink(tokenURI));
                const metadata = metadataResponse.data;

                let imageUrl = content.displayImageUrl;
                if (metadata.image) {
                    const imageUrlAttempt = resolveIpfsLink(metadata.image);
                    if (imageUrlAttempt.endsWith(".pdf") && metadata.previewImageFileCID) {
                        imageUrl = resolveIpfsLink(metadata.previewImageFileCID);
                    } else {
                        imageUrl = imageUrlAttempt;
                    }
                } else if (metadata.previewImageFileCID) {
                    imageUrl = resolveIpfsLink(metadata.previewImageFileCID);
                }
                return { ...content, displayImageUrl: imageUrl };

            } catch (e) {
                console.warn(`Metodo 1 fallito per contentId ${content.contentId}, provo con il fallback...`);
                try {
                    const totalSupply = await nftContract.read.totalSupply() as bigint;
                    for (let tokenId = BigInt(1); tokenId <= totalSupply; tokenId++) {
                        try {
                            const nftMetadata = await nftContract.read.getNFTMetadata([tokenId]) as { contentId: bigint, metadataURI: string };
                            if (nftMetadata.contentId === content.contentId) {
                                const metadataResponse = await axios.get(resolveIpfsLink(nftMetadata.metadataURI));
                                const metadata = metadataResponse.data;
                                if (metadata.image || metadata.previewImageFileCID) {
                                    let imageUrl = metadata.image ? resolveIpfsLink(metadata.image) : resolveIpfsLink(metadata.previewImageFileCID);
                                    return { ...content, displayImageUrl: imageUrl };
                                }
                                break;
                            }
                        } catch (innerLoopError) {
                            continue;
                        }
                    }
                } catch (fallbackError) {
                    console.error(`Fallback fallito per contentId ${content.contentId}`, fallbackError);
                }
            }
        }
        return content;
      });

      const fullyEnrichedContents = await Promise.all(enrichedPromises);
      setRegisteredContents(fullyEnrichedContents.reverse());

    } catch (err: any) {
      console.error("Errore nel recupero dei contenuti:", err);
      setError(`Impossibile caricare i contenuti: ${err.shortMessage || err.message}`);
    } finally {
        if (isLoading) setIsLoading(false);
    }
  }, [publicClient, chainId, isLoading]);

  useEffect(() => {
    if (publicClient && chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
      fetchRegisteredContents();
      const intervalId = setInterval(fetchRegisteredContents, REFETCH_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [publicClient, chainId, fetchRegisteredContents]);

  return { registeredContents, isLoading, error, refetch: fetchRegisteredContents };
};
